"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { adjustFiche } from "@/lib/ai/fiches";
import { currentMember } from "@/lib/auth";
import { detachBac, letSleep, moveBac, refreshBriefs, removeTrack, restyleBac, updateBac } from "@/lib/bac-admin";
import { getBac, listBacs } from "@/lib/bacs";
import { bacsOfTrack, setTrackBacs } from "@/lib/daily";
import { kickJob, startJob } from "@/lib/jobs";
import { newBacProgress, recoverProgress } from "@/lib/new-bac";
import { acceptSuggestion, refuseSuggestion, suggestFromDivers } from "@/lib/suggestions";
import { placeManyFromDivers as placeMany } from "@/lib/divers";
import { withUsage } from "@/lib/ai-usage";
import { MAX_BACS_PER_TRACK } from "@/lib/limits";
import { applyOrder, djPreview, type DjPreview } from "@/lib/dj";

export type ActionResult = { ok: true; message?: string } | { ok: false; message: string };

async function run(action: (memberId: string) => Promise<ActionResult | void>): Promise<ActionResult> {
  const member = await currentMember();
  if (!member) return { ok: false, message: "Ta session a expiré, reconnecte-toi." };
  try {
    const result = await withUsage(member.spotify_id, "bacs", () => action(member.spotify_id));
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
export async function restyle(id: string, look: { name: string; shape: string; color: string; outline: boolean }): Promise<ActionResult> {
  return run(async (m) => {
    const { sent, renamed } = await restyleBac(m, uuid.parse(id), {
      name: z.string().max(60).parse(look.name),
      shape: z.string().max(20).parse(look.shape),
      color: z.string().max(9).parse(look.color),
      outline: z.boolean().parse(look.outline),
    });
    // Les autres fiches citent ce bac par son nom dans leurs frontières.
    if (renamed) refreshBriefsLater(m);
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
      await withUsage(memberId, "fiches", () => refreshBriefs(memberId));
    } catch (error) {
      console.error("Frontières des fiches non rafraîchies :", error);
    }
  });
}

/** « Nouveau bac » : décrit librement ; l'IA le crée en tâche de fond (suivi par /api/bac). */
export async function createBac(description: string): Promise<ActionResult> {
  return run(async (m) => {
    const text = description.trim();
    if (text.length < 3) return { ok: false, message: "Décris le bac en quelques mots." };
    const job = await startJob(m, "bac", newBacProgress(text.slice(0, 500)));
    await kickJob(job.id);
  });
}

/** Récupère un bac mis de côté à la création : il est rempli dans toute la bibliothèque et sa playlist créée. */
export async function recover(id: string): Promise<ActionResult> {
  return run(async (m) => {
    const job = await startJob(m, "bac", await recoverProgress(m, uuid.parse(id)));
    await kickJob(job.id);
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
    const chosen = z.array(uuid).min(1).max(MAX_BACS_PER_TRACK).parse(bacIds);
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

/** « Ce bac dort » → « Laisser dormir » : la carte revient dans 8 semaines si rien ne change. */
export async function sleepOn(id: string): Promise<ActionResult> {
  return run((memberId) => letSleep(memberId, z.string().uuid().parse(id)));
}

/** Aperçu de l'ordre DJ (rien n'est écrit). */
export async function previewDj(id: string): Promise<{ ok: true; preview: DjPreview } | { ok: false; message: string }> {
  const member = await currentMember();
  if (!member) return { ok: false, message: "Ta session a expiré, reconnecte-toi." };
  try {
    return { ok: true, preview: await djPreview(member.spotify_id, z.string().uuid().parse(id)) };
  } catch (error) {
    console.error("Aperçu de l'ordre DJ :", error);
    return { ok: false, message: error instanceof Error ? error.message : "Erreur inconnue." };
  }
}

/** Ordre de la playlist : réécrite dans Spotify, et gardé pour les prochains tris. */
export async function setPlayOrder(id: string, order: "dj" | "recents"): Promise<ActionResult> {
  return run(async (memberId) => {
    await applyOrder(memberId, z.string().uuid().parse(id), z.enum(["dj", "recents"]).parse(order));
    return { ok: true, message: order === "dj" ? "Playlist réordonnée façon DJ dans Spotify." : "Les plus récents sont de nouveau en haut." };
  });
}

/** Divers : ranger plusieurs titres d'un coup (filtre, artiste, sélection). */
export async function placeManyFromDivers(tracks: string[], bacIds: string[]): Promise<ActionResult> {
  return run(async (m) => {
    const ids = z.array(trackId).min(1).max(2000).parse(tracks);
    const chosen = z.array(uuid).min(1).max(MAX_BACS_PER_TRACK).parse(bacIds);
    const n = await placeMany(m, ids, chosen);
    return { ok: true, message: `${n} titre${n > 1 ? "s" : ""} rangé${n > 1 ? "s" : ""}.` };
  });
}

/** « Fais-moi des bacs avec Divers » : l'IA cherche tout de suite jusqu'à 2 groupes qui méritent leur bac. */
export async function bacsFromDivers(): Promise<ActionResult> {
  return run(async (m) => {
    const n = await suggestFromDivers(m, { onDemand: true });
    return n > 0
      ? { ok: true, message: n > 1 ? "2 nouveaux bacs proposés." : "Un nouveau bac proposé." }
      : { ok: true, message: "Pas de groupe assez net pour l'instant : range à la main, ou réessaie quand Divers aura grandi." };
  });
}
