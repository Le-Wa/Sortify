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
  /** Like retiré sur Spotify : le retirer des playlists Sortify, ou l'y garder. */
  unlike_action: "retirer" | "garder";
  last_sorted_at: string | null;
  /** Playlist « Arrivage de la semaine » dans Spotify (activée par défaut). */
  arrival_playlist: boolean;
  arrival_playlist_id: string | null;
  /** Power user : sa propre app Spotify (secret chiffré, lib/secrets.ts) ; null = l'app de Sortify. */
  spotify_client_id: string | null;
  spotify_client_secret_enc: string | null;
  /** Carte de bienvenue de l'Accueil fermée (montrée une seule fois). */
  welcomed_at: string | null;
  /** Bacs des potes : il montre ses bacs partagés et voit ceux des potes qui ont dit oui. */
  share_bacs: boolean;
  /** Playlist « Reco des potes » dans son Spotify. */
  reco_playlist_id: string | null;
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

/**
 * Membres qui passent par l'app Spotify de Sortify : ce sont eux que limite le mode développement de Spotify
 * (les power users ont leur propre app).
 */
export async function countSharedAppMembers(): Promise<number> {
  const { count, error } = await db().from("members").select("spotify_id", { count: "exact", head: true }).is("spotify_client_id", null);
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

export async function deleteMember(spotifyId: string): Promise<void> {
  check(await db().from("members").delete().eq("spotify_id", spotifyId), "Suppression du membre");
}

export async function saveTokens(spotifyId: string, tokens: SpotifyTokens): Promise<void> {
  check(await db().from("members").update(tokens).eq("spotify_id", spotifyId), "Mise à jour des tokens");
}

export async function updateSettings(
  spotifyId: string,
  settings: Partial<Pick<Member, "sort_paused" | "suggest_bacs" | "unlike_action" | "arrival_playlist">>,
): Promise<void> {
  check(await db().from("members").update(settings).eq("spotify_id", spotifyId), "Mise à jour des réglages");
}

// ── Invitations ────────────────────────────────────────────────────────────────

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const MAX_MEMBERS = 5; // limite Spotify en mode développement (5 utilisateurs par app)

export function normalizeCode(raw: string): string {
  const code = raw.trim().toUpperCase().replace(/[\s_]+/g, "");
  return code.replace(/^DISQ-?([A-Z0-9]{4}|[A-Z0-9]{6})$/, "DISQ-$1");
}

export async function createInvitation(createdBy: string): Promise<string> {
  // 6 caractères (32^6 ≈ 1 milliard) : impossible à deviner en essayant. Les anciens codes à 4 restent valables.
  const suffix = Array.from({ length: 6 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join("");
  const code = `DISQ-${suffix}`;
  check(await db().from("invitations").insert({ code, created_by: createdBy }), "Création du code");
  return code;
}

export interface Invitation {
  code: string;
  created_at: string;
}

/** Codes encore libres créés par ce membre, du plus récent au plus ancien. */
export async function openInvitations(createdBy: string): Promise<Invitation[]> {
  const data = check(
    await db()
      .from("invitations")
      .select("code, created_at")
      .eq("created_by", createdBy)
      .is("used_by", null)
      .order("created_at", { ascending: false }),
    "Lecture des codes",
  );
  return data as Invitation[];
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
