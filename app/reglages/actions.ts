"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { currentMember } from "@/lib/auth";
import { countMembers, createInvitation, MAX_MEMBERS, updateSettings } from "@/lib/members";

export type ActionResult = { ok: true } | { ok: false; message: string };

const settingsSchema = z
  .object({
    sort_hour: z.number().int().min(0).max(23),
    sort_paused: z.boolean(),
    suggest_bacs: z.boolean(),
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
