import { spotifyFetch } from "./rate-limiter";
import { getAudioFeatures } from "@/lib/enrichment/reccobeats";
import type { AudioFeatures } from "@/lib/enrichment/reccobeats";
import type { SpotifyTrack } from "@/lib/types";

const BASE = "https://api.spotify.com/v1";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface SpotifyArtistRef {
  id: string;
  name: string;
}

export interface SavedTrackItem {
  added_at: string;
  track: {
    id: string;
    name: string;
    artists: SpotifyArtistRef[];
    album: { id: string; name: string; images: { url: string }[] };
    duration_ms: number;
    popularity: number;
    external_ids: { isrc?: string };
  };
}

// ── Internal helper ────────────────────────────────────────────────────────────

async function assertOk(res: Response, ctx: string): Promise<void> {
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`${ctx} — HTTP ${res.status}: ${body}`);
  }
}

// ── Public fetchers ────────────────────────────────────────────────────────────

/**
 * Returns all liked tracks added strictly after `date`, in newest-first order.
 * Stops paginating as soon as it encounters a track older than the cutoff.
 */
export async function getLikedSinceDate(
  token: string,
  date: Date
): Promise<SavedTrackItem[]> {
  const collected: SavedTrackItem[] = [];
  let url: string | null = `${BASE}/me/tracks?limit=50`;

  while (url) {
    const res = await spotifyFetch(url, token);
    await assertOk(res, "getLikedSinceDate");

    const data = (await res.json()) as {
      items: SavedTrackItem[];
      next: string | null;
    };

    for (const item of data.items) {
      if (new Date(item.added_at) < date) return collected;
      collected.push(item);
    }

    url = data.next;
  }

  return collected;
}

/**
 * Returns all track IDs currently in a playlist (handles pagination).
 * Uses the `fields` param to fetch only what's needed.
 */
export async function getPlaylistTracks(
  token: string,
  spotifyPlaylistId: string
): Promise<string[]> {
  const trackIds: string[] = [];
  let url: string | null =
    `${BASE}/playlists/${spotifyPlaylistId}/items` +
    `?fields=next,items(track(id))&limit=100`;

  while (url) {
    const res = await spotifyFetch(url, token);
    await assertOk(res, "getPlaylistTracks");

    const data = (await res.json()) as {
      next: string | null;
      items: { track: { id: string } | null }[];
    };

    for (const item of data.items) {
      if (item.track?.id) trackIds.push(item.track.id);
    }

    url = data.next;
  }

  return trackIds;
}

/**
 * Fetches audio features for a batch of tracks via ReccoBeats (no auth required).
 * Falls back to per-track ISRC lookups; tracks with no ISRC are skipped.
 */
export async function getAudioFeaturesBatch(
  tracks: Array<{ id: string; isrc: string }>,
  _token?: string
): Promise<Array<AudioFeatures & { id: string }>> {
  const results: Array<AudioFeatures & { id: string }> = [];
  await Promise.all(
    tracks.map(async (t) => {
      const features = await getAudioFeatures(t.isrc);
      if (features) results.push({ ...features, id: t.id });
    })
  );
  return results;
}

/**
 * Returns the genre array for a single artist.
 */
export async function getArtistGenres(
  artistId: string,
  token: string
): Promise<string[]> {
  const res = await spotifyFetch(`${BASE}/artists/${artistId}`, token);
  if (!res.ok) return [];
  const data = (await res.json()) as { genres: string[] };
  return data.genres;
}

/**
 * Fetches track metadata for an arbitrary list of IDs (individual calls, 5 at a time).
 */
export async function getSpotifyTracks(
  trackIds: string[],
  token: string
): Promise<Map<string, SpotifyTrack>> {
  if (trackIds.length === 0) return new Map();

  const result = new Map<string, SpotifyTrack>();
  const CONCURRENCY = 5;
  const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

  for (let i = 0; i < trackIds.length; i += CONCURRENCY) {
    const batch = trackIds.slice(i, i + CONCURRENCY);
    const tracks = await Promise.all(
      batch.map(async (id) => {
        const res = await spotifyFetch(`${BASE}/tracks/${id}`, token);
        if (!res.ok) return null;
        return (await res.json()) as SpotifyTrack;
      })
    );
    for (const track of tracks) {
      if (track) result.set(track.id, track);
    }
    if (i + CONCURRENCY < trackIds.length) await sleep(200);
  }

  return result;
}

export interface SpotifyUserPlaylist {
  id: string;
  name: string;
  description: string | null;
  images: { url: string }[];
  tracks: { total: number };
}

/**
 * Returns all playlists owned or followed by the current user (handles pagination).
 */
export async function getUserSpotifyPlaylists(
  token: string
): Promise<SpotifyUserPlaylist[]> {
  const collected: SpotifyUserPlaylist[] = [];
  let url: string | null = `${BASE}/me/playlists?limit=50`;

  while (url) {
    const res = await spotifyFetch(url, token);
    await assertOk(res, "getUserSpotifyPlaylists");

    const data = (await res.json()) as {
      items: SpotifyUserPlaylist[];
      next: string | null;
    };

    collected.push(...data.items);
    url = data.next;
  }

  return collected;
}

/**
 * Adds a track to a playlist only if it isn't already present.
 * Fetches the full playlist track list first to guard against duplicates.
 */
export async function addTrackToPlaylist(
  token: string,
  spotifyPlaylistId: string,
  trackId: string
): Promise<void> {
  const existing = await getPlaylistTracks(token, spotifyPlaylistId);
  if (existing.includes(trackId)) return;

  const res = await spotifyFetch(
    `${BASE}/playlists/${spotifyPlaylistId}/items`,
    token,
    3,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uris: [`spotify:track:${trackId}`] }),
    }
  );
  await assertOk(res, "addTrackToPlaylist");
}

/**
 * Adds multiple tracks to a playlist efficiently:
 * fetches existing tracks once, deduplicates, then POSTs in batches of 100.
 * Use this instead of looping addTrackToPlaylist when syncing many tracks
 * to the same playlist — avoids O(N) playlist fetches.
 */
export async function addTracksToPlaylist(
  token: string,
  spotifyPlaylistId: string,
  trackIds: string[]
): Promise<void> {
  if (trackIds.length === 0) return;

  const existing = new Set(await getPlaylistTracks(token, spotifyPlaylistId));
  const toAdd = trackIds.filter((id) => !existing.has(id));

  if (toAdd.length === 0) return;

  const BATCH = 100;
  for (let i = 0; i < toAdd.length; i += BATCH) {
    const batch = toAdd.slice(i, i + BATCH);
    const res = await spotifyFetch(
      `${BASE}/playlists/${spotifyPlaylistId}/items`,
      token,
      3,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uris: batch.map((id) => `spotify:track:${id}`) }),
      }
    );
    await assertOk(res, "addTracksToPlaylist");
  }
}
