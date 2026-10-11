"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { adjustFiche } from "@/lib/ai/fiches";
import { currentMember } from "@/lib/auth";
import { createCustomBac, detachBac, moveBac, refreshBriefs, removeTrack, restyleBac, updateBac } from "@/lib/bac-admin";
import { getBac, listBacs } from "@/lib/bacs";
import { bacsOfTrack, setTrackBacs } from "@/lib/daily";
import { acceptSuggestion, refuseSuggestion } from "@/lib/suggestions";

export type ActionResult = { ok: true; message?: string } | { ok: false; message: string };

async function run(action: (memberId: string) => Promise<ActionResult | void>): Promise<ActionResult> {
  const member = await currentMember();
  if (!member) return { ok: false, message: "Ta session a expiré, reconnecte-toi." };
  try {
    const result = await action(member.spotify_id);
    revalidatePath("/", "layout");
    return result ?? { ok: true };
  } catch (error) {
    console.error("Action Bacs :", error);
    return { ok: false, message: error instanceof Error ? error.message : "Erreur inconnue." };
  }
}

const uuid = z.string().uuid();
const trackId = z.string().regex(/^[A-Za-z0-9]{10,40}$/);

export async function move(id: string, direction: -1 | 1): Promise<ActionResult> {
  return run((m) => moveBac(m, uuid.parse(id), direction === -1 ? -1 : 1));
}

export async function setAutoFill(id: string, on: boolean): Promise<ActionResult> {
  return run((m) => updateBac(m, uuid.parse(id), { auto_fill: on }));
}

export async function editBrief(id: string, brief: string): Promise<ActionResult> {
  return run(async (m) => {
    const text = brief.trim();
    if (text.length < 10) return { ok: false, message: "Décris le bac en une ou deux phrases au moins." };
    await updateBac(m, uuid.parse(id), { brief: text.slice(0, 2000) });
  });
}

/** Personnalisation de la pochette (forme, couleur), renvoyée à Spotify. */
export async function restyle(id: string, shape: string, color: string, outline: boolean): Promise<ActionResult> {
  return run(async (m) => {
    const sent = await restyleBac(m, uuid.parse(id), { shape: z.string().max(20).parse(shape), color: z.string().max(9).parse(color), outline: z.boolean().parse(outline) });
    return sent ? { ok: true } : { ok: false, message: "Pochette enregistrée, mais Spotify ne l'a pas encore prise : on réessaiera au prochain tri." };
  });
}

/** « Demande à l'IA de l'ajuster » */
export async function adjust(id: string, instruction: string): Promise<ActionResult> {
  return run(async (m) => {
    const text = instruction.trim();
    if (text.length < 3) return { ok: false, message: "Dis à l'IA ce qu'il faut changer." };
    const bac = await getBac(m, uuid.parse(id));
    if (!bac || bac.status !== "active") return { ok: false, message: "Ce bac n'existe plus." };
    const others = (await listBacs(m, ["active"])).filter((b) => b.id !== bac.id);
    const fiche = await adjustFiche(
      { name: bac.name, pitch: bac.pitch, axis: bac.axis, brief: bac.brief },
      text,
      others.map((b) => ({ name: b.name, pitch: b.pitch, axis: b.axis })),
    );
    await updateBac(m, bac.id, fiche);
    return { ok: true, message: "Fiche ajustée. Elle servira dès le prochain tri." };
  });
}

export async function removeFromBac(bacId: string, track: string): Promise<ActionResult> {
  return run((m) => removeTrack(m, uuid.parse(bacId), trackId.parse(track)));
}

/** Après un changement dans la liste des bacs, les fiches voisines sont remises à jour en arrière-plan. */
function refreshBriefsLater(memberId: string) {
  after(async () => {
    try {
      await refreshBriefs(memberId);
    } catch (error) {
      console.error("Frontières des fiches non rafraîchies :", error);
    }
  });
}

/** « Nouveau bac » : décrit librement, créé par l'IA avec sa playlist. */
export async function createBac(description: string): Promise<ActionResult> {
  return run(async (m) => {
    const text = description.trim();
    if (text.length < 3) return { ok: false, message: "Décris le bac en quelques mots." };
    const { bac, count } = await createCustomBac(m, text.slice(0, 500));
    refreshBriefsLater(m);
    return { ok: true, message: `« ${bac.name} » est créé avec ${count} titre${count > 1 ? "s" : ""}, et sa playlist est dans Spotify.` };
  });
}

export async function detach(id: string): Promise<ActionResult> {
  return run(async (m) => {
    await detachBac(m, uuid.parse(id));
    refreshBriefsLater(m);
  });
}

/** Divers : ranger un titre à la main. */
export async function placeFromDivers(track: string, bacIds: string[]): Promise<ActionResult> {
  return run(async (m) => {
    const id = trackId.parse(track);
    const chosen = z.array(uuid).min(1).max(3).parse(bacIds);
    await setTrackBacs(m, id, chosen, { source: "manuel", aiChoice: await bacsOfTrack(m, id) });
  });
}

export async function accept(id: string): Promise<ActionResult> {
  return run(async (m) => {
    const message = await acceptSuggestion(m, uuid.parse(id));
    refreshBriefsLater(m);
    return { ok: true, message };
  });
}

export async function refuse(id: string): Promise<ActionResult> {
  return run((m) => refuseSuggestion(m, uuid.parse(id)));
}
