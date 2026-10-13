"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { currentMember } from "@/lib/auth";
import { check, db } from "@/lib/db";
import { addToReco, answerCommon, proposeCommon } from "@/lib/potes";

export type ActionResult = { ok: true; message?: string } | { ok: false; message: string };

async function run(action: (memberId: string) => Promise<ActionResult | void>): Promise<ActionResult> {
  const member = await currentMember();
  if (!member) return { ok: false, message: "Ta session a expiré, reconnecte-toi." };
  try {
    const result = await action(member.spotify_id);
    revalidatePath("/", "layout");
    return result ?? { ok: true };
  } catch (error) {
    console.error("Action Potes :", error);
    return { ok: false, message: error instanceof Error ? error.message : "Erreur inconnue." };
  }
}

const memberId = z.string().min(1).max(64);
const uuid = z.string().uuid();
const trackId = z.string().regex(/^[A-Za-z0-9]{10,40}$/);

/** Accord : montrer mes bacs partagés aux potes (et voir les leurs). */
export async function setShareBacs(on: boolean): Promise<ActionResult> {
  return run(async (m) => {
    check(await db().from("members").update({ share_bacs: z.boolean().parse(on) }).eq("spotify_id", m), "Accord des potes");
  });
}

/** Un bac visible ou non des potes. */
export async function setBacShared(id: string, on: boolean): Promise<ActionResult> {
  return run(async (m) => {
    check(await db().from("bacs").update({ shared: z.boolean().parse(on) }).eq("id", uuid.parse(id)).eq("member_id", m), "Bac partagé");
  });
}

export async function toReco(tracks: string[]): Promise<ActionResult> {
  return run(async (m) => {
    const n = await addToReco(m, z.array(trackId).min(1).max(100).parse(tracks));
    return { ok: true, message: n > 0 ? `${n} titre${n > 1 ? "s" : ""} dans « Reco des potes ».` : "Déjà dans « Reco des potes »." };
  });
}

export async function offerCommon(pote: string): Promise<ActionResult> {
  return run(async (m) => {
    await proposeCommon(m, memberId.parse(pote));
    return { ok: true, message: "Proposition envoyée." };
  });
}

export async function replyCommon(id: string, accept: boolean): Promise<ActionResult> {
  return run(async (m) => {
    await answerCommon(m, uuid.parse(id), accept);
    return { ok: true, message: accept ? "Bac commun créé dans Spotify." : "Proposition refusée." };
  });
}
