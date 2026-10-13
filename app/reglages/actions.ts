"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { z } from "zod";
import { THEME_COOKIE, THEMES } from "@/lib/theme";
import { setAnthropicKey } from "@/lib/own-keys";
import { notify, removePushSubscription, savePushSubscription } from "@/lib/push";
import { currentMember } from "@/lib/auth";
import { check, db } from "@/lib/db";
import { kickJob, latestJob, startJob } from "@/lib/jobs";
import { createInvitation, updateSettings } from "@/lib/members";
import { decideOldLikes, oldLikesStatus, requestOldLikes, startOldLikes } from "@/lib/old-likes";

export type ActionResult = { ok: true } | { ok: false; message: string };

const settingsSchema = z
  .object({
    sort_paused: z.boolean(),
    suggest_bacs: z.boolean(),
    unlike_action: z.enum(["retirer", "garder"]),
    arrival_playlist: z.boolean(),
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

/** Clé Anthropic personnelle (onboarding « power user ») : vérifiée puis enregistrée chiffrée ; null pour la retirer. */
export async function saveAnthropicKey(key: string | null): Promise<ActionResult> {
  const member = await currentMember();
  if (!member) return { ok: false, message: "Ta session a expiré, reconnecte-toi." };
  try {
    await setAnthropicKey(member.spotify_id, key === null ? null : z.string().max(300).parse(key));
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Clé non enregistrée." };
  }
  revalidatePath("/reglages");
  return { ok: true };
}

const subscriptionSchema = z.object({
  endpoint: z.string().url().max(1000),
  keys: z.object({ p256dh: z.string().max(200), auth: z.string().max(100) }),
});

/** Notifications du lundi : enregistre l'abonnement de cet appareil. */
export async function subscribePush(sub: unknown): Promise<ActionResult> {
  const member = await currentMember();
  if (!member) return { ok: false, message: "Ta session a expiré, reconnecte-toi." };
  const parsed = subscriptionSchema.safeParse(sub);
  if (!parsed.success) return { ok: false, message: "Abonnement invalide." };
  await savePushSubscription(member.spotify_id, parsed.data);
  return { ok: true };
}

export async function unsubscribePush(endpoint: string): Promise<ActionResult> {
  const member = await currentMember();
  if (!member) return { ok: false, message: "Ta session a expiré, reconnecte-toi." };
  await removePushSubscription(member.spotify_id, z.string().max(1000).parse(endpoint));
  return { ok: true };
}

/** Notification d'essai, sur tous les appareils abonnés. */
export async function testPush(): Promise<ActionResult> {
  const member = await currentMember();
  if (!member) return { ok: false, message: "Ta session a expiré, reconnecte-toi." };
  const sent = await notify(member.spotify_id, { title: "Sortify", body: "Les notifications marchent : rendez-vous lundi pour ton arrivage.", url: "/arrivages" });
  return sent > 0 ? { ok: true } : { ok: false, message: "Aucun appareil n'a reçu la notification : réactive-les sur ce téléphone." };
}

/** Apparence : auto (suit le téléphone), clair ou sombre ; gardée sur cet appareil. */
export async function saveTheme(theme: string): Promise<ActionResult> {
  const parsed = z.enum(THEMES).safeParse(theme);
  if (!parsed.success) return { ok: false, message: "Thème inconnu." };
  (await cookies()).set(THEME_COOKIE, parsed.data, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function newInvitation(): Promise<ActionResult> {
  const member = await currentMember();
  if (!member) return { ok: false, message: "Ta session a expiré, reconnecte-toi." };
  if (!member.is_owner) return { ok: false, message: "Seul le propriétaire de Sortify peut inviter." };
  // Même complète, l'app partagée n'empêche pas d'inviter : un pote peut entrer en power user avec sa propre app Spotify.
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

/** « Ranger mes anciens likes » : lance directement (propriétaire, clé personnelle) ou envoie la demande au propriétaire. */
export async function askOldLikes(): Promise<ActionResult> {
  const member = await currentMember();
  if (!member) return { ok: false, message: "Ta session a expiré, reconnecte-toi." };
  const status = await oldLikesStatus(member.spotify_id, member.is_owner);
  if (status.older === 0) return { ok: false, message: "Tous tes likes sont déjà dans Sortify." };
  if (status.job?.status === "running") return { ok: false, message: "C'est déjà en cours." };
  if (status.direct) await startOldLikes(member.spotify_id);
  else await requestOldLikes(member.spotify_id, status.older);
  revalidatePath("/reglages");
  return { ok: true };
}

/** Décision du propriétaire sur une demande d'anciens likes (Accueil). */
export async function decideOldLikesRequest(id: string, accept: boolean): Promise<ActionResult> {
  const member = await currentMember();
  if (!member) return { ok: false, message: "Ta session a expiré, reconnecte-toi." };
  if (!member.is_owner) return { ok: false, message: "Seul le propriétaire de Sortify peut décider." };
  await decideOldLikes(z.string().uuid().parse(id), accept);
  revalidatePath("/accueil");
  return { ok: true };
}
