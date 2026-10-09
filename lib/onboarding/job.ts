import { createClient } from "@/lib/supabase/client";
import { updateOnboardingStatus } from "@/lib/supabase/queries";
import { refreshAccessToken } from "@/lib/spotify/token";
import { spotifyFetch } from "@/lib/spotify/rate-limiter";
import { upsertLikedTracks, updateTrackEnrichment } from "@/lib/supabase/queries";
import { resolveGenres } from "@/lib/enrichment";
import type { SavedTrackItem } from "@/lib/spotify/fetchers";

const ME_TRACKS_URL = "https://api.spotify.com/v1/me/tracks";
const ENRICH_BATCH = 50;

// ── Step 1a: Import paginé complet ────────────────────────────────────────────

async function importAllLikedSongs(dbUserId: string, token: string): Promise<void> {
  let url: string | null = `${ME_TRACKS_URL}?limit=50`;
  while (url) {
    const res = await spotifyFetch(url, token);
    if (!res.ok) throw new Error(`Spotify /me/tracks error: ${res.status}`);
    const data = (await res.json()) as { items: SavedTrackItem[]; next: string | null };
    const batch = data.items
      .filter((item) => item.track?.id)
      .map((item) => ({
        user_id: dbUserId,
        spotify_track_id: item.track.id,
        spotify_added_at: item.added_at ?? null,
        name: item.track.name,
        artists: item.track.artists.map((a) => a.name),
        artist_ids: item.track.artists.map((a) => a.id),
        isrc: item.track.external_ids?.isrc ?? null,
      }));
    await upsertLikedTracks(batch);
    url = data.next;
  }
}

// ── Step 1b: Import par sampling aléatoire ────────────────────────────────────

async function importSampledLikedSongs(
  dbUserId: string,
  token: string,
  sampleSize: number,
  periodMonths: number | null
): Promise<void> {
  // Fetch total count
  const countRes = await spotifyFetch(`${ME_TRACKS_URL}?limit=1`, token);
  if (!countRes.ok) throw new Error(`Spotify /me/tracks count error: ${countRes.status}`);
  const countData = (await countRes.json()) as { total: number };
  const total = countData.total;
  if (total === 0) return;

  const pageSize = 50;
  let startOffset = 0;

  // If period is defined, estimate start offset based on recency
  // Spotify returns tracks newest-first so offset 0 = most recent
  if (periodMonths) {
    const cutoff = Date.now() - periodMonths * 30 * 24 * 3600 * 1000;
    // Binary search: find the first page where added_at < cutoff
    let lo = 0;
    let hi = Math.floor(total / pageSize);
    while (lo < hi) {
      const mid = Math.floor((lo + hi) / 2);
      const res = await spotifyFetch(`${ME_TRACKS_URL}?limit=1&offset=${mid * pageSize}`, token);
      if (!res.ok) break;
      const d = (await res.json()) as { items: { added_at: string }[] };
      const addedAt = d.items[0]?.added_at ? new Date(d.items[0].added_at).getTime() : 0;
      if (addedAt >= cutoff) lo = mid + 1;
      else hi = mid;
    }
    startOffset = lo * pageSize;
  }

  const poolSize = Math.max(1, startOffset); // pages 0..startOffset-1 are in period
  const totalPages = Math.ceil(poolSize / pageSize);
  const pagesToFetch = Math.min(totalPages, Math.ceil(sampleSize / pageSize) * 2);

  // Pick random page offsets
  const allOffsets = Array.from({ length: totalPages }, (_, i) => i * pageSize);
  const shuffled = allOffsets.sort(() => Math.random() - 0.5).slice(0, pagesToFetch);

  const trackMap = new Map<string, SavedTrackItem>();
  for (const offset of shuffled) {
    const res = await spotifyFetch(`${ME_TRACKS_URL}?limit=${pageSize}&offset=${offset}`, token);
    if (!res.ok) continue;
    const data = (await res.json()) as { items: SavedTrackItem[] };
    for (const item of data.items) {
      if (item.track?.id && !trackMap.has(item.track.id)) {
        trackMap.set(item.track.id, item);
      }
      if (trackMap.size >= sampleSize) break;
    }
    if (trackMap.size >= sampleSize) break;
  }

  const batch = Array.from(trackMap.values()).slice(0, sampleSize).map((item) => ({
    user_id: dbUserId,
    spotify_track_id: item.track.id,
    spotify_added_at: item.added_at ?? null,
    name: item.track.name,
    artists: item.track.artists.map((a) => a.name),
    artist_ids: item.track.artists.map((a) => a.id),
    isrc: item.track.external_ids?.isrc ?? null,
  }));

  await upsertLikedTracks(batch);
}

// ── Step 2: Enrichissement ────────────────────────────────────────────────────

async function enrichBatch(dbUserId: string): Promise<number> {
  const supabase = createClient();
  const { data: rows } = await supabase
    .from("tracks")
    .select("spotify_track_id, isrc, name, artists")
    .eq("user_id", dbUserId)
    .not("isrc", "is", null)
    .is("enriched_at", null)
    .limit(ENRICH_BATCH);

  if (!rows || rows.length === 0) return 0;

  await Promise.all(
    rows.map(async (row) => {
      const artistName = Array.isArray(row.artists) ? (row.artists as string[])[0] : "";
      try {
        const genres = await resolveGenres(row.isrc ?? undefined, artistName, row.name ?? "");
        await updateTrackEnrichment(row.spotify_track_id, dbUserId, { genres, audio_features: null });
      } catch {
        await updateTrackEnrichment(row.spotify_track_id, dbUserId, { genres: [], audio_features: null });
      }
    })
  );

  return rows.length;
}

// ── Step 3: Classify check ────────────────────────────────────────────────────

async function countUnclassified(dbUserId: string): Promise<number> {
  const supabase = createClient();
  const { count } = await supabase
    .from("tracks")
    .select("*", { count: "exact", head: true })
    .eq("user_id", dbUserId)
    .is("classified_at", null)
    .eq("is_archived", false);
  return count ?? 0;
}

// ── Orchestrator ──────────────────────────────────────────────────────────────

export interface JobProgress {
  step: number;
  done: boolean;
  proposalReady?: boolean;
  error?: string;
}

export async function runOnboardingJob(
  spotifyId: string,
  dbUserId: string,
  startStep = 1
): Promise<JobProgress> {
  const supabase = createClient();

  // Dev personas with fake tokens → skip and mark done immediately
  if (spotifyId.startsWith("dev_")) {
    const { data: devUser } = await supabase
      .from("users")
      .select("access_token")
      .eq("id", dbUserId)
      .single();
    if (!devUser || devUser.access_token === "dev_token") {
      await supabase.from("users").update({ onboarding_step: 4, proposal_ready: true }).eq("id", dbUserId);
      await updateOnboardingStatus(dbUserId, "complete");
      return { step: 4, done: true };
    }
  }

  const { data: userRow } = await supabase
    .from("users")
    .select("onboarding_mode, onboarding_config")
    .eq("id", dbUserId)
    .single();

  const isImportMode = userRow?.onboarding_mode === "import"; // legacy compat
  const isAutoMode = userRow?.onboarding_mode === "auto";
  const config = (userRow?.onboarding_config ?? {}) as { sample_size?: number | null; period_months?: number | null };

  const deadline = Date.now() + 240_000;

  try {
    // ── Step 1 ──
    if (startStep <= 1 && !isImportMode) {
      await supabase.from("users").update({ onboarding_step: 1 }).eq("id", dbUserId);
      const token = await refreshAccessToken(spotifyId);

      if (isAutoMode && config.sample_size) {
        await importSampledLikedSongs(dbUserId, token, config.sample_size, config.period_months ?? null);
      } else {
        await importAllLikedSongs(dbUserId, token);
      }
    }

    if (Date.now() > deadline) return { step: 2, done: false };

    // ── Step 2 ──
    if (startStep <= 2) {
      await supabase.from("users").update({ onboarding_step: 2 }).eq("id", dbUserId);
      let enriched = 1;
      while (enriched > 0 && Date.now() < deadline) {
        enriched = await enrichBatch(dbUserId);
      }
      if (enriched > 0) return { step: 2, done: false }; // budget exhausted mid-enrich

      // Step 2 complete — set proposal_ready, stop before step 3 (user must validate taxonomy)
      if (isAutoMode) {
        await supabase.from("users").update({ proposal_ready: true }).eq("id", dbUserId);
        return { step: 2, done: false, proposalReady: true };
      }
    }

    if (Date.now() > deadline) return { step: 3, done: false };

    // ── Step 3 — only if explicitly triggered (startStep=3) ──
    if (startStep >= 3) {
      await supabase.from("users").update({ onboarding_step: 3 }).eq("id", dbUserId);
      const remaining = await countUnclassified(dbUserId);
      if (remaining > 0) return { step: 3, done: false };
    }

    // ── Done ──
    await supabase.from("users").update({ onboarding_step: 4 }).eq("id", dbUserId);
    await updateOnboardingStatus(dbUserId, "complete");
    return { step: 4, done: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { step: startStep, done: false, error: message };
  }
}
