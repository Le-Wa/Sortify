import { createClient } from "./client";
import type { AudioFeatures, PlaylistCentroid, PlaylistForClassifier, PlaylistRules } from "@/lib/types";

// ── Onboarding v2 — pending_auth ──────────────────────────────────────────────

export async function createPendingAuth(
  nonce: string,
  clientId: string,
  clientSecretEnc: string,
  invitedBy?: string
): Promise<void> {
  const supabase = createClient();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  const { error } = await supabase.from("pending_auth").insert({
    nonce,
    client_id: clientId,
    client_secret_enc: clientSecretEnc,
    state: "",
    invited_by: invitedBy ?? null,
    expires_at: expiresAt,
  });
  if (error) throw error;
}

export async function setPendingAuthState(nonce: string, state: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("pending_auth")
    .update({ state })
    .eq("nonce", nonce)
    .gt("expires_at", new Date().toISOString());
  if (error) throw error;
}

export async function getPendingAuthByNonce(nonce: string): Promise<{
  nonce: string;
  client_id: string;
  client_secret_enc: string;
  state: string;
  invited_by: string | null;
  expires_at: string;
} | null> {
  const supabase = createClient();
  const { data } = await supabase
    .from("pending_auth")
    .select("nonce, client_id, client_secret_enc, state, invited_by, expires_at")
    .eq("nonce", nonce)
    .gt("expires_at", new Date().toISOString())
    .single();
  return data ?? null;
}

export async function getPendingAuthByState(state: string): Promise<{
  nonce: string;
  client_id: string;
  client_secret_enc: string;
  invited_by: string | null;
} | null> {
  const supabase = createClient();
  const { data } = await supabase
    .from("pending_auth")
    .select("nonce, client_id, client_secret_enc, invited_by")
    .eq("state", state)
    .gt("expires_at", new Date().toISOString())
    .single();
  return data ?? null;
}

export async function deletePendingAuth(nonce: string): Promise<void> {
  const supabase = createClient();
  await supabase.from("pending_auth").delete().eq("nonce", nonce);
}

// ── Onboarding v2 — invite_codes ──────────────────────────────────────────────

export async function getInviteCode(codeHash: string): Promise<{
  id: string;
  inviter_id: string;
  used_by: string | null;
  expires_at: string;
} | null> {
  const supabase = createClient();
  const { data } = await supabase
    .from("invite_codes")
    .select("id, inviter_id, used_by, expires_at")
    .eq("code_hash", codeHash)
    .single();
  return data ?? null;
}

export async function getActiveInviteCount(inviterId: string): Promise<number> {
  const supabase = createClient();
  const { count } = await supabase
    .from("invite_codes")
    .select("id", { count: "exact", head: true })
    .eq("inviter_id", inviterId)
    .is("used_by", null)
    .gt("expires_at", new Date().toISOString());
  return count ?? 0;
}

export async function createInviteCode(
  inviterId: string,
  codeHash: string
): Promise<void> {
  const supabase = createClient();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const { error } = await supabase.from("invite_codes").insert({
    inviter_id: inviterId,
    code_hash: codeHash,
    expires_at: expiresAt,
  });
  if (error) throw error;
}

export async function markInviteCodeUsed(codeHash: string, usedBy: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("invite_codes")
    .update({ used_by: usedBy })
    .eq("code_hash", codeHash)
    .is("used_by", null);
  if (error) throw error;
}

// ── Onboarding v2 — users ─────────────────────────────────────────────────────

export async function getUserWithOnboarding(spotifyId: string): Promise<{
  id: string;
  spotify_id: string;
  email: string | null;
  onboarding_status: string;
  onboarding_step: number;
  onboarding_mode: string | null;
  spotify_client_id: string | null;
  spotify_client_secret_enc: string | null;
  invited_by: string | null;
} | null> {
  const supabase = createClient();
  const { data } = await supabase
    .from("users")
    .select(
      "id, spotify_id, email, onboarding_status, onboarding_step, onboarding_mode, spotify_client_id, spotify_client_secret_enc, invited_by"
    )
    .eq("spotify_id", spotifyId)
    .single();
  return data ?? null;
}

export async function upsertUserFromByok(params: {
  spotifyId: string;
  email: string | null;
  displayName: string | null;
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  clientId: string;
  clientSecretEnc: string;
  invitedBy?: string;
}): Promise<{ id: string; onboarding_status: string }> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("users")
    .upsert(
      {
        spotify_id: params.spotifyId,
        email: params.email,
        access_token: params.accessToken,
        refresh_token: params.refreshToken,
        expires_at: params.expiresAt,
        spotify_client_id: params.clientId,
        spotify_client_secret_enc: params.clientSecretEnc,
        invited_by: params.invitedBy ?? null,
        onboarding_status: "in_progress",
      },
      { onConflict: "spotify_id", ignoreDuplicates: false }
    )
    .select("id, onboarding_status")
    .single();
  if (error) throw error;
  return data as { id: string; onboarding_status: string };
}

export async function updateOnboardingStatus(
  userId: string,
  status: "pending" | "in_progress" | "complete",
  step?: number,
  mode?: string
): Promise<void> {
  const supabase = createClient();
  const update: Record<string, unknown> = { onboarding_status: status };
  if (step !== undefined) update.onboarding_step = step;
  if (mode !== undefined) update.onboarding_mode = mode;
  const { error } = await supabase.from("users").update(update).eq("id", userId);
  if (error) throw error;
}

// ── Users ─────────────────────────────────────────────────────────────────────

export async function getCronEnabledUsers(): Promise<
  { id: string; spotify_id: string }[]
> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("users")
    .select("id, spotify_id")
    .eq("cron_enabled", true);
  if (error) throw error;
  return data ?? [];
}

// ── Tracks ────────────────────────────────────────────────────────────────────

/** Returns the spotify_track_ids that are already classified among the given list. */
export async function getClassifiedTrackIds(
  userId: string,
  spotifyTrackIds: string[]
): Promise<string[]> {
  if (spotifyTrackIds.length === 0) return [];
  const supabase = createClient();
  const { data } = await supabase
    .from("tracks")
    .select("spotify_track_id")
    .eq("user_id", userId)
    .in("spotify_track_id", spotifyTrackIds)
    .not("classified_at", "is", null);
  return (data ?? []).map((r) => r.spotify_track_id as string);
}

export interface UpsertTrackData {
  user_id: string;
  spotify_track_id: string;
  spotify_added_at: string | null;
  name: string | null;
  artists: string[] | null;
  audio_features: Partial<AudioFeatures> | null;
  genres: string[];
  assigned_playlist: string | null;
  extra_playlists: string[];
  llm_suggestion: string | null;
  classified_at: string;
  classification_level: number;
  needs_review: boolean;
}

export async function upsertTrack(data: UpsertTrackData): Promise<{ id: string }> {
  const supabase = createClient();
  const { data: result, error } = await supabase
    .from("tracks")
    .upsert(data, { onConflict: "user_id,spotify_track_id" })
    .select("id")
    .single();
  if (error) throw error;
  return result as { id: string };
}

/** Returns audio_features for all tracks assigned to a playlist (for centroid calc). */
export async function getPlaylistAssignedFeatures(
  userId: string,
  playlistId: string
): Promise<(Partial<AudioFeatures> | null)[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("tracks")
    .select("audio_features")
    .eq("user_id", userId)
    .eq("assigned_playlist", playlistId)
    .not("audio_features", "is", null);
  if (error) throw error;
  return (data ?? []).map((r) => r.audio_features as Partial<AudioFeatures>);
}

// ── Playlists ─────────────────────────────────────────────────────────────────

export interface PlaylistRow {
  id: string;
  spotify_playlist_id: string;
  name: string;
  description: string | null;
  enabled: boolean;
  priority: number;
  llm_help_text: string | null;
  learned_at: string | null;
  color: string | null;
}

export type PlaylistPatchData = Partial<{
  name: string;
  description: string | null;
  enabled: boolean;
  llm_help_text: string | null;
  rules: PlaylistRules;
  learned_at: string | null;
  color: string | null;
}>;

export async function updatePlaylist(
  playlistId: string,
  userId: string,
  data: PlaylistPatchData
): Promise<PlaylistRow | null> {
  const supabase = createClient();
  const { data: result, error } = await supabase
    .from("playlists")
    .update(data)
    .eq("id", playlistId)
    .eq("user_id", userId)
    .select("id, spotify_playlist_id, name, description, enabled, priority, llm_help_text, learned_at, color")
    .single();
  if (error) throw error;
  return result as PlaylistRow | null;
}

export async function reassignPlaylistTracksToInbox(
  playlistId: string,
  userId: string
): Promise<number> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("tracks")
    .update({ assigned_playlist: null, needs_review: true })
    .eq("user_id", userId)
    .eq("assigned_playlist", playlistId)
    .select("id");
  if (error) throw error;
  return (data ?? []).length;
}

export async function removeFromExtraPlaylists(
  playlistId: string,
  userId: string
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.rpc("remove_playlist_from_extras", {
    p_playlist_id: playlistId,
    p_user_id: userId,
  });
  if (error) throw error;
}

export async function reorderPlaylists(
  userId: string,
  items: { id: string; priority: number }[]
): Promise<void> {
  if (items.length === 0) return;
  const supabase = createClient();
  await Promise.all(
    items.map(async ({ id, priority }) => {
      const { error } = await supabase
        .from("playlists")
        .update({ priority })
        .eq("id", id)
        .eq("user_id", userId);
      if (error) throw error;
    })
  );
}

export async function deactivatePlaylist(
  playlistId: string,
  userId: string
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("playlists")
    .update({ enabled: false })
    .eq("id", playlistId)
    .eq("user_id", userId);
  if (error) throw error;
}

/** Returns all playlists for a user — active and inactive. Used by the management UI. */
export async function getAllPlaylists(userId: string): Promise<PlaylistRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("playlists")
    .select("id, spotify_playlist_id, name, description, enabled, priority, llm_help_text, learned_at, color")
    .eq("user_id", userId)
    .order("priority", { ascending: true });
  if (error) throw error;
  return (data ?? []) as PlaylistRow[];
}

export async function getUserPlaylists(
  userId: string
): Promise<PlaylistForClassifier[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("playlists")
    .select("id, spotify_playlist_id, name, description, rules, centroid, priority, llm_help_text")
    .eq("user_id", userId)
    .eq("enabled", true);
  if (error) throw error;
  return (data ?? []) as PlaylistForClassifier[];
}

export async function insertPlaylist(data: {
  user_id: string;
  spotify_playlist_id: string;
  name: string;
  description: string | null;
  centroid: PlaylistCentroid | null;
  rules: PlaylistRules;
  priority?: number;
  llm_help_text?: string | null;
}): Promise<{ id: string }> {
  const supabase = createClient();
  const { data: result, error } = await supabase
    .from("playlists")
    .upsert(
      { ...data, enabled: true, priority: data.priority ?? 0 },
      { onConflict: "user_id,spotify_playlist_id" }
    )
    .select("id")
    .single();
  if (error) throw error;
  return result as { id: string };
}

export async function updatePlaylistCentroid(
  playlistId: string,
  centroid: PlaylistCentroid | null
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("playlists")
    .update({ centroid })
    .eq("id", playlistId);
  if (error) throw error;
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

export interface DashboardTrackRow {
  id: string;
  assigned_playlist: string | null;
  classified_at: string | null;
  needs_review: boolean;
  is_archived: boolean;
  spotify_added_at: string | null;
  audio_features: Partial<AudioFeatures> | null;
}

/** Fetches all tracks for a user with the fields needed by the dashboard. */
export async function getDashboardTracks(userId: string): Promise<DashboardTrackRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("tracks")
    .select(
      "id, assigned_playlist, classified_at, needs_review, is_archived, spotify_added_at, audio_features"
    )
    .eq("user_id", userId);
  if (error) throw error;
  return (data ?? []) as DashboardTrackRow[];
}

// ── Inbox ─────────────────────────────────────────────────────────────────────

export async function getUserBySpotifyId(
  spotifyId: string
): Promise<{ id: string } | null> {
  const supabase = createClient();
  const { data } = await supabase
    .from("users")
    .select("id")
    .eq("spotify_id", spotifyId)
    .single();
  return data;
}

export async function getUserSettings(
  spotifyId: string
): Promise<{ id: string; cron_enabled: boolean; import_since: number | null } | null> {
  const supabase = createClient();
  const { data } = await supabase
    .from("users")
    .select("id, cron_enabled, import_since")
    .eq("spotify_id", spotifyId)
    .single();
  return data;
}

export async function getUserOnboarding(
  spotifyId: string
): Promise<{ id: string; onboarding_completed: boolean; cron_enabled: boolean } | null> {
  const supabase = createClient();
  const { data } = await supabase
    .from("users")
    .select("id, onboarding_completed, cron_enabled")
    .eq("spotify_id", spotifyId)
    .single();
  return data;
}

export async function updateOnboardingData(
  userId: string,
  data: { onboarding_completed?: boolean; import_since?: number | null; cron_enabled?: boolean }
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("users").update(data).eq("id", userId);
  if (error) throw error;
}

export interface InboxTrackRow {
  id: string;
  spotify_track_id: string;
  name: string | null;
  artists: string[] | null;
  spotify_added_at: string | null;
  genres: string[] | null;
  classification_level: number | null;
  needs_review: boolean;
  assigned_playlist: string | null;
  playlists: {
    id: string;
    name: string;
    spotify_playlist_id: string;
  } | null;
}

export async function getInboxTracks(
  userId: string,
  since: Date
): Promise<InboxTrackRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("tracks")
    .select(
      "id, spotify_track_id, name, artists, spotify_added_at, genres, classification_level, needs_review, assigned_playlist, playlists!assigned_playlist(id, name, spotify_playlist_id)"
    )
    .eq("user_id", userId)
    .eq("is_archived", false)
    .or("needs_review.eq.true,classified_at.is.null")
    .gte("spotify_added_at", since.toISOString())
    .order("spotify_added_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return (data ?? []) as unknown as InboxTrackRow[];
}


// ── Playlists — stats & detail ────────────────────────────────────────────────

export interface PlaylistStats {
  total: number;
  synced: number;
  not_synced: number;
}

export async function getPlaylistsStats(
  userId: string
): Promise<Record<string, PlaylistStats>> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("tracks")
    .select("assigned_playlist, extra_playlists, pushed_to_spotify")
    .eq("user_id", userId)
    .eq("is_archived", false)
    .or("assigned_playlist.not.is.null,extra_playlists.neq.{}");
  if (error) throw error;

  const stats: Record<string, PlaylistStats> = {};
  const add = (id: string, synced: boolean) => {
    if (!stats[id]) stats[id] = { total: 0, synced: 0, not_synced: 0 };
    stats[id].total++;
    if (synced) stats[id].synced++;
    else stats[id].not_synced++;
  };

  for (const row of data ?? []) {
    const synced = row.pushed_to_spotify !== null;
    if (row.assigned_playlist) add(row.assigned_playlist as string, synced);
    for (const pid of (row.extra_playlists as string[] | null) ?? []) {
      add(pid, synced);
    }
  }
  return stats;
}

export async function getPlaylistDetail(
  playlistId: string,
  userId: string
): Promise<{ id: string; spotify_playlist_id: string; name: string; description: string | null; color: string | null; enabled: boolean } | null> {
  const supabase = createClient();
  const { data } = await supabase
    .from("playlists")
    .select("id, spotify_playlist_id, name, description, color, enabled")
    .eq("id", playlistId)
    .eq("user_id", userId)
    .single();
  return data;
}

export interface PlaylistTrackRow {
  id: string;
  spotify_track_id: string;
  name: string | null;
  artist_name: string | null;
  artists: string[] | null;
  album_name: string | null;
  spotify_added_at: string | null;
  genres: string[] | null;
  classification_level: number | null;
  pushed_to_spotify: string | null;
  assigned_playlist: string | null;
  extra_playlists: string[];
}

export async function getPlaylistTracksAssigned(
  playlistId: string,
  userId: string
): Promise<PlaylistTrackRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("tracks")
    .select(
      "id, spotify_track_id, name, artist_name, artists, album_name, spotify_added_at, genres, classification_level, pushed_to_spotify, assigned_playlist, extra_playlists"
    )
    .eq("user_id", userId)
    .eq("is_archived", false)
    .or(`assigned_playlist.eq.${playlistId},extra_playlists.cs.{${playlistId}}`)
    .order("spotify_added_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as PlaylistTrackRow[];
}

export interface PlaylistTrackForLearn {
  name: string | null;
  artists: string[] | null;
  artist_name: string | null;
  genres: string[] | null;
  audio_features: Record<string, number> | null;
}

export async function getPlaylistTracksForLearn(
  playlistId: string,
  userId: string
): Promise<PlaylistTrackForLearn[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("tracks")
    .select("name, artists, artist_name, genres, audio_features")
    .eq("user_id", userId)
    .eq("is_archived", false)
    .or(`assigned_playlist.eq.${playlistId},extra_playlists.cs.{${playlistId}}`);
  if (error) throw error;
  return (data ?? []) as PlaylistTrackForLearn[];
}

export async function getUnsyncedPlaylistTracks(
  playlistId: string,
  userId: string
): Promise<{ id: string; spotify_track_id: string }[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("tracks")
    .select("id, spotify_track_id")
    .eq("user_id", userId)
    .eq("is_archived", false)
    .is("pushed_to_spotify", null)
    .or(`assigned_playlist.eq.${playlistId},extra_playlists.cs.{${playlistId}}`);
  if (error) throw error;
  return (data ?? []) as { id: string; spotify_track_id: string }[];
}

// ── Archive (is_archived = true) ──────────────────────────────────────────────

export interface ArchivedTrackRow {
  id: string;
  spotify_track_id: string;
  name: string | null;
  artist_name: string | null;
  artists: string[] | null;
  album_name: string | null;
  genres: string[] | null;
  spotify_added_at: string | null;
}

export async function getArchivedTracks(userId: string): Promise<ArchivedTrackRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("tracks")
    .select(
      "id, spotify_track_id, name, artist_name, artists, album_name, genres, spotify_added_at"
    )
    .eq("user_id", userId)
    .eq("is_archived", true)
    .order("spotify_added_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as ArchivedTrackRow[];
}

export async function unarchiveTrack(trackId: string, userId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("tracks")
    .update({
      is_archived: false,
      assigned_playlist: null,
      classified_at: null,
      needs_review: true,
    })
    .eq("id", trackId)
    .eq("user_id", userId);
  if (error) throw error;
}

// ── Inbox v2 ──────────────────────────────────────────────────────────────────

export interface InboxTrackRowV2 {
  id: string;
  spotify_track_id: string;
  name: string | null;
  artist_name: string | null;
  artists: string[] | null;
  album_name: string | null;
  isrc: string | null;
  spotify_added_at: string | null;
  genres: string[] | null;
  enrichment_source: string | null;
  audio_features: Partial<AudioFeatures> | null;
  llm_suggestion: string | null;
  classified_at: string | null;
  suggestion_playlist: { id: string; name: string; spotify_playlist_id: string; color: string | null } | null;
}

export async function getInboxTracksNeedsReview(
  userId: string,
  playlistId?: string
): Promise<InboxTrackRowV2[]> {
  const supabase = createClient();
  let query = supabase
    .from("tracks")
    .select(
      "id, spotify_track_id, name, artist_name, artists, album_name, isrc, spotify_added_at, genres, enrichment_source, audio_features, llm_suggestion, classified_at, suggestion_playlist:playlists!llm_suggestion(id, name, spotify_playlist_id, color)"
    )
    .eq("user_id", userId)
    .eq("is_archived", false)
    .or("needs_review.eq.true,classified_at.is.null");

  if (playlistId) {
    query = query.eq("llm_suggestion", playlistId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as unknown as InboxTrackRowV2[];
}

export async function getLatestLogByTrackIds(
  trackIds: string[],
  userId: string
): Promise<Record<string, { confidence: number; reason: string | null }>> {
  if (trackIds.length === 0) return {};
  const supabase = createClient();
  const { data } = await supabase
    .from("classification_log")
    .select("track_id, confidence, reason, created_at")
    .in("track_id", trackIds)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  const map: Record<string, { confidence: number; reason: string | null }> = {};
  for (const row of data ?? []) {
    const id = row.track_id as string;
    if (!(id in map)) {
      map[id] = { confidence: row.confidence as number, reason: row.reason as string | null };
    }
  }
  return map;
}

export async function updateTrackInboxCorrect(
  trackId: string,
  userId: string,
  playlistIds: string[]
): Promise<void> {
  const [primary, ...extras] = playlistIds;
  const supabase = createClient();
  const { error } = await supabase
    .from("tracks")
    .update({
      assigned_playlist: primary,
      extra_playlists: extras,
      llm_suggestion: null,
      needs_review: false,
      classified_at: new Date().toISOString(),
    })
    .eq("id", trackId)
    .eq("user_id", userId);
  if (error) throw error;
}

export async function updateTrackInboxArchive(
  trackId: string,
  userId: string
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("tracks")
    .update({ is_archived: true, needs_review: false })
    .eq("id", trackId)
    .eq("user_id", userId);
  if (error) throw error;
}

export async function addTrackToExtraPlaylist(
  trackId: string,
  userId: string,
  playlistId: string
): Promise<void> {
  const supabase = createClient();
  const { data, error: fetchError } = await supabase
    .from("tracks")
    .select("extra_playlists")
    .eq("id", trackId)
    .eq("user_id", userId)
    .single();
  if (fetchError || !data) throw fetchError ?? new Error("Track not found");
  const extras = ((data as { extra_playlists: string[] }).extra_playlists ?? []);
  if (extras.includes(playlistId)) return;
  const { error } = await supabase
    .from("tracks")
    .update({ extra_playlists: [...extras, playlistId] })
    .eq("id", trackId)
    .eq("user_id", userId);
  if (error) throw error;
}

export async function removeTrackFromPlaylist(
  trackId: string,
  userId: string,
  playlistId: string
): Promise<void> {
  const supabase = createClient();
  const { data, error: fetchError } = await supabase
    .from("tracks")
    .select("assigned_playlist, extra_playlists")
    .eq("id", trackId)
    .eq("user_id", userId)
    .single();
  if (fetchError || !data) throw fetchError ?? new Error("Track not found");

  if ((data as { assigned_playlist: string | null }).assigned_playlist === playlistId) {
    const { error } = await supabase
      .from("tracks")
      .update({ assigned_playlist: null, pushed_to_spotify: null, needs_review: true })
      .eq("id", trackId)
      .eq("user_id", userId);
    if (error) throw error;
  } else {
    const newExtras = ((data as { extra_playlists: string[] }).extra_playlists ?? []).filter(
      (id) => id !== playlistId
    );
    const { error } = await supabase
      .from("tracks")
      .update({ extra_playlists: newExtras, pushed_to_spotify: null })
      .eq("id", trackId)
      .eq("user_id", userId);
    if (error) throw error;
  }
}

export async function moveTrackToPlaylist(
  trackId: string,
  userId: string,
  playlistId: string
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("tracks")
    .update({ assigned_playlist: playlistId, pushed_to_spotify: null })
    .eq("id", trackId)
    .eq("user_id", userId);
  if (error) throw error;
}

export async function setPushedToSpotify(
  trackId: string,
  userId: string
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("tracks")
    .update({ pushed_to_spotify: new Date().toISOString() })
    .eq("id", trackId)
    .eq("user_id", userId);
  if (error) throw error;
}

export async function insertInboxLog(entry: {
  track_id: string;
  user_id: string;
  suggested: string | null;
  corrected_to: string | null;
  confidence: number;
  reason: string | null;
}): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("classification_log").insert({
    ...entry,
    level_used: 0,
  });
  if (error) throw error;
}

// ── Classify confirmation ─────────────────────────────────────────────────────

export async function getTrackForConfirmation(
  trackId: string,
  userId: string
): Promise<{ id: string; spotify_track_id: string; genres: string[] | null; llm_suggestion: string | null; extra_playlists: string[] } | null> {
  const supabase = createClient();
  const { data } = await supabase
    .from("tracks")
    .select("id, spotify_track_id, genres, llm_suggestion, extra_playlists")
    .eq("id", trackId)
    .eq("user_id", userId)
    .single();
  return data as typeof data & { extra_playlists: string[] };
}

export async function getPlaylistForConfirmation(
  playlistId: string,
  userId: string
): Promise<{ id: string; spotify_playlist_id: string; rules: PlaylistRules } | null> {
  const supabase = createClient();
  const { data } = await supabase
    .from("playlists")
    .select("id, spotify_playlist_id, rules")
    .eq("id", playlistId)
    .eq("user_id", userId)
    .single();
  return data as typeof data & { rules: PlaylistRules } | null;
}

export async function confirmTrackAssignment(params: {
  trackId: string;
  userId: string;
  finalPlaylistId: string;
  suggestedPlaylistId: string;
  correctedTo: string | null;
}): Promise<void> {
  const { trackId, userId, finalPlaylistId, suggestedPlaylistId, correctedTo } = params;
  const supabase = createClient();

  await supabase
    .from("tracks")
    .update({ assigned_playlist: finalPlaylistId, needs_review: false })
    .eq("id", trackId)
    .eq("user_id", userId);

  await supabase.from("classification_log").insert({
    track_id: trackId,
    user_id: userId,
    level_used: 0,
    suggested: suggestedPlaylistId,
    confidence: 1.0,
    reason: correctedTo ? "Manual correction" : "Manual confirmation",
    corrected_to: correctedTo,
  });
}

export async function mergeGenresIntoPlaylistRules(
  playlistId: string,
  trackGenres: string[],
  currentRules: PlaylistRules
): Promise<void> {
  const updatedIncludes = [
    ...new Set([...currentRules.genres.include, ...trackGenres]),
  ];
  const supabase = createClient();
  await supabase
    .from("playlists")
    .update({
      rules: {
        ...currentRules,
        genres: { ...currentRules.genres, include: updatedIncludes },
      },
    })
    .eq("id", playlistId);
}

// ── Archive ───────────────────────────────────────────────────────────────────

export interface UnorganizedTrackRow {
  id: string;
  spotify_track_id: string;
  name: string | null;
  artists: string[] | null;
  artist_ids: string[] | null;
  isrc: string | null;
  spotify_added_at: string | null;
}

export async function getUnorganizedTracks(
  userId: string
): Promise<UnorganizedTrackRow[]> {
  // Show everything beyond the inbox window (> 7 days) — not just > 6 months
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const supabase = createClient();
  const { data, error } = await supabase
    .from("tracks")
    .select("id, spotify_track_id, name, artists, artist_ids, isrc, spotify_added_at")
    .eq("user_id", userId)
    .is("assigned_playlist", null)
    .eq("is_archived", false)
    .lt("spotify_added_at", cutoff.toISOString())
    .order("spotify_added_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as UnorganizedTrackRow[];
}

export async function getUnclassifiedArchiveTracks(
  userId: string
): Promise<UnorganizedTrackRow[]> {
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const supabase = createClient();
  const { data, error } = await supabase
    .from("tracks")
    .select("id, spotify_track_id, name, artists, artist_ids, isrc, spotify_added_at")
    .eq("user_id", userId)
    .is("assigned_playlist", null)
    .is("classified_at", null)
    .eq("is_archived", false)
    .lt("spotify_added_at", cutoff.toISOString())
    .order("spotify_added_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as UnorganizedTrackRow[];
}

export async function upsertLikedTracks(
  tracks: Array<{
    user_id: string;
    spotify_track_id: string;
    spotify_added_at: string | null;
    name: string;
    artists: string[];
    artist_ids: string[];
    isrc: string | null;
    artist_name?: string | null;
    album_name?: string | null;
  }>
): Promise<void> {
  if (tracks.length === 0) return;
  const supabase = createClient();
  const { error } = await supabase.from("tracks").upsert(
    tracks.map((t) => ({
      ...t,
      audio_features: null,
      genres: [],
      assigned_playlist: null,
      classified_at: null,
      classification_level: null,
      needs_review: false,
      is_archived: false,
      is_liked: true,
    })),
    { onConflict: "user_id,spotify_track_id", ignoreDuplicates: true }
  );
  if (error) throw error;
}

export async function getNullNameTracks(
  userId: string
): Promise<{ id: string; spotify_track_id: string }[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("tracks")
    .select("id, spotify_track_id")
    .eq("user_id", userId)
    .is("name", null);
  if (error) throw error;
  return (data ?? []) as { id: string; spotify_track_id: string }[];
}

export async function updateTrackMeta(
  spotifyTrackId: string,
  userId: string,
  meta: { name: string; artist_name: string | null; album_name: string | null; isrc: string | null }
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("tracks")
    .update(meta)
    .eq("spotify_track_id", spotifyTrackId)
    .eq("user_id", userId);
  if (error) throw error;
}

export async function archiveTrack(
  trackId: string,
  userId: string
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("tracks")
    .update({ is_archived: true })
    .eq("id", trackId)
    .eq("user_id", userId);
  if (error) throw error;
}

// ── Admin logs v2 (paginated, filterable) ─────────────────────────────────────

export interface AdminLogsFilter {
  playlistId?: string;
  correctionsOnly?: boolean;
  from?: string;
  to?: string;
  level?: number;
  classifierVersion?: "v1" | "v2";
}

export interface AdminLogV2Row {
  id: string;
  track_id: string;
  track_name: string | null;
  artist_name: string | null;
  enriched: boolean;
  level_used: number;
  suggested: string | null;
  confidence: number;
  reason: string | null;
  corrected_to: string | null;
  playlists_detail: { id: string; name: string; confidence: number }[] | null;
  classifier_version: "v1" | "v2";
  created_at: string;
}

export async function getAdminLogsV2(
  userId: string,
  filters: AdminLogsFilter,
  page: number,
  perPage: number
): Promise<{ logs: AdminLogV2Row[]; total: number }> {
  const supabase = createClient();
  const offset = (page - 1) * perPage;

  let query = supabase
    .from("classification_log")
    .select("id, track_id, level_used, suggested, confidence, reason, corrected_to, playlists_detail, classifier_version, created_at", {
      count: "exact",
    })
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .range(offset, offset + perPage - 1);

  if (filters.playlistId) query = query.eq("suggested", filters.playlistId);
  if (filters.correctionsOnly) query = query.not("corrected_to", "is", null);
  if (filters.from) query = query.gte("created_at", filters.from);
  if (filters.to) {
    const toTs = filters.to.includes("T") ? filters.to : `${filters.to}T23:59:59.999Z`;
    query = query.lte("created_at", toTs);
  }
  if (filters.level !== undefined) query = query.eq("level_used", filters.level);
  if (filters.classifierVersion) query = query.eq("classifier_version", filters.classifierVersion);

  const { data: logRows, count, error } = await query;
  if (error) throw error;

  const trackIds = [...new Set((logRows ?? []).map((r) => r.track_id as string))];
  let trackMap = new Map<string, { name: string | null; artist_name: string | null; artists: string[] | null; enriched_at: string | null }>();

  if (trackIds.length > 0) {
    const { data: trackRows } = await supabase
      .from("tracks")
      .select("id, name, artist_name, artists, enriched_at")
      .in("id", trackIds);
    trackMap = new Map(
      (trackRows ?? []).map((t) => [
        t.id as string,
        {
          name: t.name as string | null,
          artist_name: t.artist_name as string | null,
          artists: t.artists as string[] | null,
          enriched_at: t.enriched_at as string | null,
        },
      ])
    );
  }

  const logs: AdminLogV2Row[] = (logRows ?? []).map((row) => {
    const track = trackMap.get(row.track_id as string);
    return {
      id: row.id as string,
      track_id: row.track_id as string,
      track_name: track?.name ?? null,
      artist_name: track?.artist_name ?? (track?.artists?.[0] ?? null),
      enriched: track?.enriched_at !== null && track?.enriched_at !== undefined,
      level_used: row.level_used as number,
      suggested: row.suggested as string | null,
      confidence: row.confidence as number,
      reason: row.reason as string | null,
      corrected_to: row.corrected_to as string | null,
      playlists_detail: (row.playlists_detail as { id: string; name: string; confidence: number }[] | null) ?? null,
      classifier_version: (row.classifier_version as "v1" | "v2") ?? "v1",
      created_at: row.created_at as string,
    };
  });

  return { logs, total: count ?? 0 };
}

// ── Classifier stats (raw data for quality metrics) ───────────────────────────

export interface ClassifierStatsRaw {
  tracks: { needs_review: boolean; is_archived: boolean; assigned_playlist: string | null }[];
  logs: {
    track_id: string;
    level_used: number;
    suggested: string | null;
    corrected_to: string | null;
    confidence: number;
    created_at: string;
  }[];
}

export async function getClassifierStats(userId: string): Promise<ClassifierStatsRaw> {
  const supabase = createClient();
  const [tracksRes, logsRes] = await Promise.all([
    supabase
      .from("tracks")
      .select("needs_review, is_archived, assigned_playlist")
      .eq("user_id", userId)
      .not("classified_at", "is", null),
    supabase
      .from("classification_log")
      .select("track_id, level_used, suggested, corrected_to, confidence, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: true }),
  ]);
  if (tracksRes.error) throw tracksRes.error;
  if (logsRes.error) throw logsRes.error;

  return {
    tracks: (tracksRes.data ?? []) as ClassifierStatsRaw["tracks"],
    logs: (logsRes.data ?? []) as ClassifierStatsRaw["logs"],
  };
}

// ── Cron report ───────────────────────────────────────────────────────────────

export async function getUserCronData(
  userId: string
): Promise<{ last_sync_at: string | null; last_cron_report: Record<string, unknown> | null } | null> {
  const supabase = createClient();
  const { data } = await supabase
    .from("users")
    .select("last_sync_at, last_cron_report")
    .eq("id", userId)
    .single();
  return data as { last_sync_at: string | null; last_cron_report: Record<string, unknown> | null } | null;
}

export async function saveLastCronReport(
  userId: string,
  report: Record<string, unknown>
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("users")
    .update({ last_cron_report: report })
    .eq("id", userId);
  if (error) throw error;
}

// ── Classification log ────────────────────────────────────────────────────────

export async function insertClassificationLog(entry: {
  track_id: string;
  user_id: string;
  level_used: number;
  suggested: string | null;
  confidence: number;
  reason: string | null;
  playlists_detail?: { id: string; name: string; confidence: number }[] | null;
  classifier_version?: "v1" | "v2";
}): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("classification_log").insert(entry);
  if (error) throw error;
}

// ── Admin logs ────────────────────────────────────────────────────────────────

export interface AdminLogRow {
  id: string;
  name: string | null;
  artists: string[] | null;
  genres: string[] | null;
  audio_features: Partial<AudioFeatures> | null;
  needs_review: boolean;
  assigned_playlist: string | null;
  playlist_name: string | null;
  level_used: number | null;
  confidence: number | null;
  reason: string | null;
  corrected_to: string | null;
  classified_at: string | null;
}

export async function getAdminLogs(
  userId: string,
  filters: { needsReview?: boolean; playlistId?: string }
): Promise<AdminLogRow[]> {
  const supabase = createClient();

  type LogEntry = {
    level_used: number;
    confidence: number;
    reason: string | null;
    corrected_to: string | null;
    created_at: string;
  };
  type RawRow = {
    id: string;
    name: string | null;
    artists: string[] | null;
    genres: string[] | null;
    audio_features: Partial<AudioFeatures> | null;
    needs_review: boolean;
    assigned_playlist: string | null;
    classified_at: string | null;
    playlists: { name: string } | null;
    classification_log: LogEntry[];
  };

  let query = supabase
    .from("tracks")
    .select(
      "id, name, artists, genres, audio_features, needs_review, assigned_playlist, classified_at, playlists!assigned_playlist(name), classification_log(level_used, confidence, reason, corrected_to, created_at)"
    )
    .eq("user_id", userId)
    .not("classified_at", "is", null)
    .order("classified_at", { ascending: false })
    .limit(200);

  if (filters.needsReview !== undefined) {
    query = query.eq("needs_review", filters.needsReview);
  }
  if (filters.playlistId) {
    query = query.eq("assigned_playlist", filters.playlistId);
  }

  const { data, error } = await query;
  if (error) throw error;

  return (data as unknown as RawRow[]).map((row) => {
    const latestLog = (row.classification_log ?? [])
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0] ?? null;
    return {
      id: row.id,
      name: row.name,
      artists: row.artists,
      genres: row.genres,
      audio_features: row.audio_features,
      needs_review: row.needs_review,
      assigned_playlist: row.assigned_playlist,
      playlist_name: (row.playlists as { name: string } | null)?.name ?? null,
      level_used: latestLog?.level_used ?? null,
      confidence: latestLog?.confidence ?? null,
      reason: latestLog?.reason ?? null,
      corrected_to: latestLog?.corrected_to ?? null,
      classified_at: row.classified_at,
    };
  });
}

// ── Dashboard stats ───────────────────────────────────────────────────────────

export interface DashboardCounts {
  imported: number;
  in_playlists: number;
  not_in_playlist: number;
  needs_review: number;
  archived: number;
  last_sync_at: string | null;
  cron_enabled: boolean;
}

export async function getDashboardCounts(userId: string): Promise<DashboardCounts> {
  const supabase = createClient();

  const [imported, inPlaylists, notInPlaylist, needsReview, archived, userRow] =
    await Promise.all([
      supabase
        .from("tracks")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId),
      supabase
        .from("tracks")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .not("assigned_playlist", "is", null)
        .eq("is_archived", false),
      supabase
        .from("tracks")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .is("assigned_playlist", null)
        .eq("is_archived", false),
      supabase
        .from("tracks")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("is_archived", false)
        .or("needs_review.eq.true,classified_at.is.null"),
      supabase
        .from("tracks")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("is_archived", true),
      supabase
        .from("users")
        .select("last_sync_at, cron_enabled")
        .eq("id", userId)
        .single(),
    ]);

  return {
    imported: imported.count ?? 0,
    in_playlists: inPlaylists.count ?? 0,
    not_in_playlist: notInPlaylist.count ?? 0,
    needs_review: needsReview.count ?? 0,
    archived: archived.count ?? 0,
    last_sync_at: (userRow.data as { last_sync_at: string | null } | null)?.last_sync_at ?? null,
    cron_enabled: (userRow.data as { cron_enabled: boolean } | null)?.cron_enabled ?? false,
  };
}

export async function updateLastSyncAt(userId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("users")
    .update({ last_sync_at: new Date().toISOString() })
    .eq("id", userId);
  if (error) throw error;
}

export async function updateCronEnabled(userId: string, enabled: boolean): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("users")
    .update({ cron_enabled: enabled })
    .eq("id", userId);
  if (error) throw error;
}

// ── Import helpers ────────────────────────────────────────────────────────────

/** Returns the subset of spotifyTrackIds that already exist in the DB for this user. */
export async function getExistingTrackIds(
  userId: string,
  spotifyTrackIds: string[]
): Promise<string[]> {
  if (spotifyTrackIds.length === 0) return [];
  const supabase = createClient();
  const { data } = await supabase
    .from("tracks")
    .select("spotify_track_id")
    .eq("user_id", userId)
    .in("spotify_track_id", spotifyTrackIds);
  return (data ?? []).map((r) => r.spotify_track_id as string);
}

/** Updates genres, audio_features and enriched_at for a single track. */
export async function updateTrackEnrichment(
  spotifyTrackId: string,
  userId: string,
  data: { genres: string[]; audio_features: AudioFeatures | null }
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("tracks")
    .update({
      genres: data.genres,
      audio_features: data.audio_features,
      enriched_at: new Date().toISOString(),
    })
    .eq("spotify_track_id", spotifyTrackId)
    .eq("user_id", userId);
  if (error) throw error;
}

// ── Classify run ──────────────────────────────────────────────────────────────

export interface TrackForClassification {
  id: string;
  spotify_track_id: string;
  spotify_added_at: string | null;
  name: string | null;
  artists: string[] | null;
  album_name: string | null;
  isrc: string | null;
  audio_features: AudioFeatures | null;
  genres: string[] | null;
}

export async function getTracksForClassification(
  userId: string,
  limit = 10
): Promise<TrackForClassification[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("tracks")
    .select("id, spotify_track_id, spotify_added_at, name, artists, album_name, isrc, audio_features, genres")
    .eq("user_id", userId)
    .is("classified_at", null)
    .eq("is_archived", false)
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as unknown as TrackForClassification[];
}

export async function countTracksForClassification(userId: string): Promise<number> {
  const supabase = createClient();
  const { count } = await supabase
    .from("tracks")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .is("classified_at", null)
    .eq("is_archived", false);
  return count ?? 0;
}

/** Deletes all tracks (and their classification logs) for a user. Used by the full-reset admin endpoint. */
export async function deleteAllUserTracks(userId: string): Promise<number> {
  const supabase = createClient();

  // Must delete logs first — FK classification_log_track_id_fkey references tracks.id
  const { data: trackIds, error: fetchError } = await supabase
    .from("tracks")
    .select("id")
    .eq("user_id", userId);
  if (fetchError) throw fetchError;

  if (trackIds && trackIds.length > 0) {
    const ids = trackIds.map((r) => r.id as string);
    const { error: logError } = await supabase
      .from("classification_log")
      .delete()
      .in("track_id", ids);
    if (logError) throw logError;
  }

  const { count, error } = await supabase
    .from("tracks")
    .delete({ count: "exact" })
    .eq("user_id", userId);
  if (error) throw error;
  return count ?? 0;
}

// ── Sync helpers (unlike + manual-removal detection) ─────────────────────────

/** Returns all liked DB tracks with their assigned playlist's Spotify ID (for unlike detection). */
export async function getLikedTracksWithPlaylist(userId: string): Promise<
  { spotify_track_id: string; spotify_playlist_id: string | null }[]
> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("tracks")
    .select(
      "spotify_track_id, playlists!assigned_playlist(spotify_playlist_id)"
    )
    .eq("user_id", userId)
    .eq("is_liked", true);
  if (error) throw error;
  return (data ?? []).map((r) => ({
    spotify_track_id: r.spotify_track_id as string,
    spotify_playlist_id:
      (
        r.playlists as unknown as
          | { spotify_playlist_id: string }
          | null
      )?.spotify_playlist_id ?? null,
  }));
}

/** Returns all spotify_track_ids in DB where is_liked = true. */
export async function getLikedSpotifyTrackIds(userId: string): Promise<string[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("tracks")
    .select("spotify_track_id")
    .eq("user_id", userId)
    .eq("is_liked", true);
  if (error) throw error;
  return (data ?? []).map((r) => r.spotify_track_id as string);
}

/**
 * Marks tracks as unliked: is_liked = false, is_archived = true, assigned_playlist = null.
 * Keeps the rows in DB for history.
 */
export async function markTracksUnliked(
  userId: string,
  spotifyTrackIds: string[]
): Promise<void> {
  if (spotifyTrackIds.length === 0) return;
  const supabase = createClient();
  const { error } = await supabase
    .from("tracks")
    .update({ is_liked: false, is_archived: true, assigned_playlist: null })
    .eq("user_id", userId)
    .in("spotify_track_id", spotifyTrackIds);
  if (error) throw error;
}

/**
 * Returns tracks assigned to a given playlist that are still liked.
 * Used to compare against the live Spotify playlist state.
 */
export async function getTracksAssignedToPlaylist(
  userId: string,
  playlistId: string
): Promise<{ id: string; spotify_track_id: string }[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("tracks")
    .select("id, spotify_track_id")
    .eq("user_id", userId)
    .eq("assigned_playlist", playlistId)
    .eq("is_liked", true);
  if (error) throw error;
  return (data ?? []) as { id: string; spotify_track_id: string }[];
}

/**
 * Records that the user manually removed tracks from a playlist on Spotify.
 * Appends the playlist to manually_removed_playlists[] and clears assigned_playlist.
 */
// ── Profile ───────────────────────────────────────────────────────────────────

export interface ProfileTrackRow {
  id: string;
  name: string | null;
  artists: string[] | null;
  genres: string[] | null;
  spotify_added_at: string | null;
  assigned_playlist: string | null;
  classified_at: string | null;
}

export async function getProfileTracks(userId: string): Promise<ProfileTrackRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("tracks")
    .select("id, name, artists, genres, spotify_added_at, assigned_playlist, classified_at")
    .eq("user_id", userId)
    .eq("is_archived", false)
    .not("classified_at", "is", null)
    .order("spotify_added_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as ProfileTrackRow[];
}

export async function markManuallyRemovedFromPlaylist(
  trackDbIds: string[],
  playlistId: string
): Promise<void> {
  if (trackDbIds.length === 0) return;
  const supabase = createClient();
  const { error } = await supabase.rpc("mark_manually_removed_from_playlist", {
    p_track_ids: trackDbIds,
    p_playlist_id: playlistId,
  });
  if (error) throw error;
}
