/**
 * Onboarding background job — idempotent, checkpointed via onboarding_step.
 *
 * Steps:
 *   1 = importing liked songs
 *   2 = enriching tracks
 *   3 = classifying tracks
 *   4 = done
 */

import { createClient } from "@/lib/supabase/client";
import { updateOnboardingStatus } from "@/lib/supabase/queries";
import { refreshAccessToken } from "@/lib/spotify/token";
import { spotifyFetch } from "@/lib/spotify/rate-limiter";
import { upsertLikedTracks, updateTrackEnrichment } from "@/lib/supabase/queries";
import { resolveGenres } from "@/lib/enrichment";
import { getAudioFeaturesBatch } from "@/lib/spotify/fetchers";
import type { SavedTrackItem } from "@/lib/spotify/fetchers";

const ME_TRACKS_URL = "https://api.spotify.com/v1/me/tracks";
const ENRICH_BATCH = 50;
const CLASSIFY_BATCH = 10;
const CLASSIFY_URL_BASE = "/api/classify/run";

// ── Step 1: Import liked songs ─────────────────────────────────────────────────

async function importLikedSongs(userId: string, dbUserId: string, token: string): Promise<void> {
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

// ── Step 2: Enrich tracks ──────────────────────────────────────────────────────

async function enrichBatch(dbUserId: string, spotifyId: string): Promise<number> {
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
      const artistName = Array.isArray(row.artists) ? row.artists[0] : "";
      try {
        const genres = await resolveGenres(row.isrc ?? undefined, artistName, row.name ?? "");
        await updateTrackEnrichment(row.spotify_track_id, dbUserId, {
          genres,
          audio_features: null,
        });
      } catch {
        // Mark as attempted even on failure
        await updateTrackEnrichment(row.spotify_track_id, dbUserId, {
          genres: [],
          audio_features: null,
        });
      }
    })
  );

  return rows.length;
}

// ── Step 3: Classify tracks ────────────────────────────────────────────────────

async function classifyBatch(dbUserId: string): Promise<{ classified: number; remaining: number }> {
  const supabase = createClient();
  const { data: tracks } = await supabase
    .from("tracks")
    .select("id")
    .eq("user_id", dbUserId)
    .is("classified_at", null)
    .eq("is_archived", false)
    .limit(1);

  const { count: remaining } = await supabase
    .from("tracks")
    .select("*", { count: "exact", head: true })
    .eq("user_id", dbUserId)
    .is("classified_at", null)
    .eq("is_archived", false);

  return { classified: 0, remaining: remaining ?? 0 };
}

// ── Orchestrator ───────────────────────────────────────────────────────────────

export interface JobProgress {
  step: number;
  done: boolean;
  error?: string;
}

export async function runOnboardingJob(
  spotifyId: string,
  dbUserId: string,
  startStep = 1
): Promise<JobProgress> {
  const supabase = createClient();
  const deadline = Date.now() + 240_000; // 240s budget (60s safety margin)

  try {
    // ── Step 1: Import liked songs ──
    if (startStep <= 1) {
      await supabase.from("users").update({ onboarding_step: 1 }).eq("id", dbUserId);
      const token = await refreshAccessToken(spotifyId);
      await importLikedSongs(spotifyId, dbUserId, token);
    }

    if (Date.now() > deadline) {
      return { step: 2, done: false };
    }

    // ── Step 2: Enrich tracks ──
    if (startStep <= 2) {
      await supabase.from("users").update({ onboarding_step: 2 }).eq("id", dbUserId);
      let enriched = 1;
      while (enriched > 0 && Date.now() < deadline) {
        enriched = await enrichBatch(dbUserId, spotifyId);
      }
    }

    if (Date.now() > deadline) {
      return { step: 3, done: false };
    }

    // ── Step 3: Classify ──
    if (startStep <= 3) {
      await supabase.from("users").update({ onboarding_step: 3 }).eq("id", dbUserId);
      // Classification is driven via the existing /api/classify/run endpoint
      // Called in a loop by the job trigger route
      const { remaining } = await classifyBatch(dbUserId);
      if (remaining > 0) {
        return { step: 3, done: false };
      }
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
