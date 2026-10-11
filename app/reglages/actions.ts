"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { currentMember } from "@/lib/auth";
import { check, db } from "@/lib/db";
import { kickJob, latestJob, startJob } from "@/lib/jobs";
import { countMembers, createInvitation, MAX_MEMBERS, updateSettings } from "@/lib/members";

export type ActionResult = { ok: true } | { ok: false; message: string };

const settingsSchema = z
  .object({
    sort_paused: z.boolean(),
    suggest_bacs: z.boolean(),
    unlike_action: z.enum(["retirer", "garder"]),
  })
  .partial();

export async function saveSettings(input: z.input<typeof settingsSchema>): Promise<ActionResult> {
  const member = await currentMember();
  if (!member) return { ok: false, message: "Ta session a expiré, reconnecte-toi." };
  const parsed = settingsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Réglage invalide." };
  await updateSettings(member.spotify_id, parsed.data);
  revalidatePath("/reglages");
  return { ok: true };
}

export async function newInvitation(): Promise<ActionResult> {
  const member = await currentMember();
  if (!member) return { ok: false, message: "Ta session a expiré, reconnecte-toi." };
  if (!member.is_owner) return { ok: false, message: "Seul le propriétaire de Sortify peut inviter." };
  if ((await countMembers()) >= MAX_MEMBERS) return { ok: false, message: `Sortify est complet (${MAX_MEMBERS} comptes).` };
  await createInvitation(member.spotify_id);
  revalidatePath("/reglages");
  return { ok: true };
}

/** « Relancer l'analyse » : l'IA relit la bibliothèque ; ses propositions arrivent sur l'Accueil. */
export async function relaunchAnalysis(): Promise<ActionResult> {
  const member = await currentMember();
  if (!member) return { ok: false, message: "Ta session a expiré, reconnecte-toi." };
  const running = await latestJob(member.spotify_id, "reanalyse");
  if (running?.status === "running") return { ok: false, message: "L'analyse tourne déjà." };
  const job = await startJob(member.spotify_id, "reanalyse", { phase: "analyse", changes: 0 });
  await kickJob(job.id);
  return { ok: true };
}

/** « Supprimer mes données Sortify » : tout disparaît de Sortify ; les playlists restent dans Spotify. */
export async function deleteMyData(confirmation: string): Promise<ActionResult> {
  const member = await currentMember();
  if (!member) return { ok: false, message: "Ta session a expiré, reconnecte-toi." };
  if (confirmation !== "SUPPRIMER") return { ok: false, message: "Tape SUPPRIMER pour confirmer." };
  // Les tables V2 sont liées au membre en cascade (likes, bacs, placements, jobs…).
  check(await db().from("members").delete().eq("spotify_id", member.spotify_id), "Suppression des données");
  return { ok: true };
}
