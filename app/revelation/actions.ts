"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { alternativeFiche, customFiche, mergedFiche, type FicheContext } from "@/lib/ai/fiches";
import { currentMember } from "@/lib/auth";
import { getBac, insertFiches, listBacs, setExamples, type Bac } from "@/lib/bacs";
import { loadCorpus, sampleCorpus } from "@/lib/corpus";
import { startCreation } from "@/lib/creation";
import { check, db } from "@/lib/db";
import { revelationState } from "@/lib/revelation";

export type ActionResult = { ok: true } | { ok: false; message: string };

const SESSION_EXPIRED: ActionResult = { ok: false, message: "Ta session a expiré, reconnecte-toi." };

/** Exécute une action et transforme les erreurs en message lisible. */
async function run(action: (memberId: string) => Promise<ActionResult | void>): Promise<ActionResult> {
  const member = await currentMember();
  if (!member) return SESSION_EXPIRED;
  try {
    const result = await action(member.spotify_id);
    revalidatePath("/revelation");
    return result ?? { ok: true };
  } catch (error) {
    console.error("Action Proposition :", error);
    return { ok: false, message: error instanceof Error ? error.message : "Erreur inconnue." };
  }
}

async function editableBac(memberId: string, id: string): Promise<Bac> {
  const bac = await getBac(memberId, z.string().uuid().parse(id));
  if (!bac || bac.is_divers || bac.status === "active") throw new Error("Ce bac n'est plus modifiable.");
  return bac;
}

const context = (b: Bac): FicheContext => ({ name: b.name, pitch: b.pitch, axis: b.axis });

export async function setKept(id: string, keep: boolean): Promise<ActionResult> {
  return run(async (memberId) => {
    const bac = await editableBac(memberId, id);
    check(await db().from("bacs").update({ status: keep ? "proposed" : "removed" }).eq("id", bac.id), "Garder le bac");
  });
}

export async function renameBac(id: string, name: string): Promise<ActionResult> {
  return run(async (memberId) => {
    const clean = name.trim().replace(/\s+/g, " ");
    if (clean.length < 2 || clean.length > 40) return { ok: false, message: "Un nom de 2 à 40 caractères." };
    const bac = await editableBac(memberId, id);
    // Le nom court de la pochette ne correspond plus : la pochette s'ajuste au nouveau nom.
    check(await db().from("bacs").update({ name: clean, sleeve_name: null }).eq("id", bac.id), "Renommer le bac");
  });
}

/** Remplace la fiche par une autre idée de l'IA ; le bac sera re-rempli en arrière-plan. */
export async function otherIdea(id: string): Promise<ActionResult> {
  return run(async (memberId) => {
    const bac = await editableBac(memberId, id);
    const others = (await listBacs(memberId, ["proposed"])).filter((b) => b.id !== bac.id);
    const corpus = sampleCorpus(await loadCorpus(memberId));
    const fiche = await alternativeFiche(context(bac), others.map(context), corpus);
    check(
      await db()
        .from("bacs")
        .update({
          name: fiche.name,
          sleeve_name: fiche.sleeve_name,
          pitch: fiche.pitch,
          brief: fiche.brief,
          axis: fiche.axis,
          status: "proposed",
          needs_fill: true,
        })
        .eq("id", bac.id),
      "Autre idée",
    );
    check(await db().from("bac_examples").delete().eq("bac_id", bac.id), "Effacement des exemples");
    await setExamples(memberId, bac.id, fiche.examples.map((k) => corpus[k]?.track_id));
    await revelationState(memberId); // lance le remplissage
  });
}

/** Fusionne deux bacs : nouvelle fiche, titres des deux réunis, sans re-rangement. */
export async function mergeBacs(firstId: string, secondId: string): Promise<ActionResult> {
  return run(async (memberId) => {
    if (firstId === secondId) return { ok: false, message: "Choisis deux bacs différents." };
    const [a, b] = await Promise.all([editableBac(memberId, firstId), editableBac(memberId, secondId)]);
    const others = (await listBacs(memberId, ["proposed"])).filter((x) => x.id !== a.id && x.id !== b.id);
    const corpus = sampleCorpus(await loadCorpus(memberId));
    const fiche = await mergedFiche(context(a), context(b), others.map(context), corpus);

    const [merged] = await insertFiches(memberId, [fiche], corpus, {
      startPosition: Math.min(a.position, b.position),
      usedColors: others.map((o) => o.color),
      needsFill: false,
    });
    check(await db().from("bacs").update({ color: a.color }).eq("id", merged.id), "Couleur du bac fusionné");
    const rows = check(
      await db().from("placements").select("track_id, confidence").in("bac_id", [a.id, b.id]),
      "Lecture des placements",
    ) as { track_id: string; confidence: number | null }[];
    const best = new Map<string, number>();
    for (const r of rows) best.set(r.track_id, Math.max(best.get(r.track_id) ?? 0, r.confidence ?? 0));
    const union = [...best].map(([track_id, confidence]) => ({ bac_id: merged.id, member_id: memberId, track_id, confidence, source: "ia" }));
    for (let i = 0; i < union.length; i += 500) {
      check(await db().from("placements").insert(union.slice(i, i + 500)), "Placements du bac fusionné");
    }
    check(await db().from("bacs").delete().in("id", [a.id, b.id]), "Suppression des bacs fusionnés");
  });
}

/** « Il manque un bac ? » : bac sur mesure, rempli en arrière-plan. */
export async function addCustomBac(request: string): Promise<ActionResult> {
  return run(async (memberId) => {
    const text = request.trim();
    if (text.length < 3) return { ok: false, message: "Décris le bac en quelques mots." };
    const all = await listBacs(memberId, ["proposed", "removed"]);
    const kept = all.filter((b) => b.status === "proposed");
    const corpus = sampleCorpus(await loadCorpus(memberId));
    const fiche = await customFiche(text, kept.map(context), corpus);
    await insertFiches(memberId, [fiche], corpus, {
      startPosition: all.length,
      usedColors: all.map((b) => b.color),
      needsFill: true,
    });
    await revelationState(memberId);
  });
}

/** Valide la proposition et lance la création des playlists. */
export async function createBacs(): Promise<ActionResult> {
  return run(async (memberId) => {
    const bacs = await listBacs(memberId, ["proposed"]);
    if (bacs.some((b) => b.needs_fill)) return { ok: false, message: "Un bac est encore en train de se remplir, patiente un instant." };
    await startCreation(memberId);
  });
}
