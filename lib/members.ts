import "server-only";
import { randomInt } from "node:crypto";
import { check, db } from "./db";

export interface Member {
  spotify_id: string;
  display_name: string | null;
  email: string | null;
  access_token: string;
  refresh_token: string;
  expires_at: number;
  is_owner: boolean;
  sort_hour: number;
  sort_paused: boolean;
  suggest_bacs: boolean;
  last_sorted_at: string | null;
  created_at: string;
}

export interface SpotifyTokens {
  access_token: string;
  refresh_token: string;
  expires_at: number;
}

export async function getMember(spotifyId: string): Promise<Member | null> {
  const data = check(
    await db().from("members").select("*").eq("spotify_id", spotifyId).maybeSingle(),
    "Lecture du membre",
  );
  return (data as Member | null) ?? null;
}

export async function countMembers(): Promise<number> {
  const { count, error } = await db().from("members").select("spotify_id", { count: "exact", head: true });
  if (error) throw new Error(`Comptage des membres : ${error.message}`);
  return count ?? 0;
}

export async function createMember(input: {
  spotifyId: string;
  displayName: string | null;
  email: string | null;
  tokens: SpotifyTokens;
  isOwner: boolean;
}): Promise<void> {
  check(
    await db().from("members").insert({
      spotify_id: input.spotifyId,
      display_name: input.displayName,
      email: input.email,
      ...input.tokens,
      is_owner: input.isOwner,
    }),
    "Création du membre",
  );
}

export async function saveTokens(spotifyId: string, tokens: SpotifyTokens): Promise<void> {
  check(await db().from("members").update(tokens).eq("spotify_id", spotifyId), "Mise à jour des tokens");
}

export async function updateSettings(
  spotifyId: string,
  settings: Partial<Pick<Member, "sort_hour" | "sort_paused" | "suggest_bacs">>,
): Promise<void> {
  check(await db().from("members").update(settings).eq("spotify_id", spotifyId), "Mise à jour des réglages");
}

// ── Invitations ────────────────────────────────────────────────────────────────

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const MAX_MEMBERS = 25; // limite Spotify en mode développement

export function normalizeCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, "");
}

export async function createInvitation(createdBy: string): Promise<string> {
  const suffix = Array.from({ length: 4 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join("");
  const code = `DISQ-${suffix}`;
  check(await db().from("invitations").insert({ code, created_by: createdBy }), "Création du code");
  return code;
}

export async function isInvitationUsable(code: string): Promise<boolean> {
  const data = check(
    await db().from("invitations").select("used_by").eq("code", normalizeCode(code)).maybeSingle(),
    "Lecture du code",
  );
  return data !== null && (data as { used_by: string | null }).used_by === null;
}

/** Marque le code comme utilisé. Renvoie false si quelqu'un l'a utilisé entre-temps. */
export async function consumeInvitation(code: string, spotifyId: string): Promise<boolean> {
  const data = check(
    await db()
      .from("invitations")
      .update({ used_by: spotifyId, used_at: new Date().toISOString() })
      .eq("code", normalizeCode(code))
      .is("used_by", null)
      .select("code"),
    "Utilisation du code",
  );
  return (data as unknown[]).length === 1;
}
