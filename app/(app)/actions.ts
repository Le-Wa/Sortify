"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { currentMember } from "@/lib/auth";
import { acceptAllPending, bacsOfTrack, pendingQueue, setTrackBacs } from "@/lib/daily";
import { kickJob, startJob } from "@/lib/jobs";
import { initialTri } from "@/lib/tri";

export type ActionResult = { ok: true; message?: string } | { ok: false; message: string };

async function run(action: (memberId: string) => Promise<ActionResult | void>): Promise<ActionResult> {
  const member = await currentMember();
  if (!member) return { ok: false, message: "Ta session a expiré, reconnecte-toi." };
  try {
    const result = await action(member.spotify_id);
    revalidatePath("/", "layout");
    return result ?? { ok: true };
  } catch (error) {
    console.error("Action du quotidien :", error);
    return { ok: false, message: error instanceof Error ? error.message : "Erreur inconnue." };
  }
}

const trackId = z.string().regex(/^[A-Za-z0-9]{10,40}$/);
const bacIds = z.array(z.string().uuid()).max(3);

/** « Nouveaux likes ? » : lance un tri tout de suite (ou suit celui qui tourne). */
export async function sortNow(): Promise<ActionResult> {
  return run(async (memberId) => {
    const job = await startJob(memberId, "tri", initialTri("bouton"));
    await kickJob(job.id);
  });
}

/** Décision dans « À trier » : ces bacs (vide = Divers). */
export async function decide(track: string, bacs: string[]): Promise<ActionResult> {
  return run(async (memberId) => {
    const id = trackId.parse(track);
    const chosen = bacIds.parse(bacs);
    const item = (await pendingQueue(memberId)).find((p) => p.track_id === id);
    if (!item) return { ok: false, message: "Ce titre a déjà été rangé." };
    const aiChoice = item.suggestions.slice(0, 1).map((s) => s.bac.id);
    const asProposed = chosen.length === aiChoice.length && chosen.every((b) => aiChoice.includes(b));
    await setTrackBacs(memberId, id, chosen, { source: asProposed ? "ia" : "correction", aiChoice });
  });
}

export async function acceptAll(): Promise<ActionResult> {
  return run(async (memberId) => {
    const n = await acceptAllPending(memberId);
    return { ok: true, message: `${n} titre${n > 1 ? "s" : ""} rangé${n > 1 ? "s" : ""}.` };
  });
}

/** « Corriger » depuis l'Accueil : le titre va dans exactement ces bacs. */
export async function correct(track: string, bacs: string[]): Promise<ActionResult> {
  return run(async (memberId) => {
    const id = trackId.parse(track);
    const current = await bacsOfTrack(memberId, id);
    await setTrackBacs(memberId, id, bacIds.parse(bacs), { source: "correction", aiChoice: current });
  });
}
