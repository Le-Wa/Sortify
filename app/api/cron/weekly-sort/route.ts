import { after } from "next/server";
import { resolveGenres } from "@/lib/enrichment";
import { classifyBatch } from "@/lib/classifier/engine";
import {
  addTracksToPlaylist,
  getAllLikedTrackIds,
  getAudioFeaturesBatch,
  getLikedSinceDate,
  getPlaylistTracks,
  removeTracksFromPlaylist,
  type SavedTrackItem,
} from "@/lib/spotify/fetchers";
import { refreshAccessToken } from "@/lib/spotify/token";
import {
  getCronEnabledUsers,
  getClassifiedTrackIds,
  getLikedTracksWithPlaylist,
  getPlaylistAssignedFeatures,
  getTracksAssignedToPlaylist,
  getUserPlaylists,
  insertClassificationLog,
  markManuallyRemovedFromPlaylist,
  markTracksUnliked,
  saveLastCronReport,
  updatePlaylistCentroid,
  upsertLikedTracks,
  upsertTrack,
  updateLastSyncAt,
} from "@/lib/supabase/queries";
import type { ClassificationResult, ClassifierTrack, PlaylistCentroid } from "@/lib/types";
import type { AudioFeatures } from "@/lib/enrichment/reccobeats";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

type CentroidDim = keyof Omit<PlaylistCentroid, "sample_size">;
const CENTROID_DIMS: CentroidDim[] = [
  "energy",
  "danceability",
  "valence",
  "acousticness",
  "instrumentalness",
];

interface ProcessReport {
  imported: number;
  already_existing: number;
  unliked: number;
  manually_removed: number;
  enriched: number;
  enrichment_failures: number;
  classified_auto: number;
  needs_review: number;
  errors: string[];
}

export async function GET(request: Request): Promise<Response> {
  if (request.headers.get("Authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const since = new Date(Date.now() - SEVEN_DAYS_MS);
  const users = await getCronEnabledUsers();

  after(async () => {
    for (const user of users) {
      try {
        const report = await processUser(user, since);
        const fullReport = { ran_at: new Date().toISOString(), ...report };
        await Promise.all([
          saveLastCronReport(user.id, fullReport),
          updateLastSyncAt(user.id),
        ]);
      } catch (err) {
        console.error(`[cron] user ${user.spotify_id} failed:`, err);
      }
    }
  });

  return Response.json({ status: "queued", total_users: users.length });
}

async function processUser(
  user: { id: string; spotify_id: string },
  since: Date
): Promise<ProcessReport> {
  const report: ProcessReport = {
    imported: 0,
    already_existing: 0,
    unliked: 0,
    manually_removed: 0,
    enriched: 0,
    enrichment_failures: 0,
    classified_auto: 0,
    needs_review: 0,
    errors: [],
  };

  const token = await refreshAccessToken(user.spotify_id);

  // ── Step 2: Unlike detection ─────────────────────────────────────────────────
  try {
    const [spotifyLikedIds, dbLikedTracks] = await Promise.all([
      getAllLikedTrackIds(token),
      getLikedTracksWithPlaylist(user.id),
    ]);
    const spotifySet = new Set(spotifyLikedIds);
    const unliked = dbLikedTracks.filter(
      (t) => !spotifySet.has(t.spotify_track_id)
    );
    if (unliked.length > 0) {
      // Remove from Spotify playlists grouped by playlist to minimise API calls
      const byPlaylist = new Map<string, string[]>();
      for (const t of unliked) {
        if (!t.spotify_playlist_id) continue;
        const list = byPlaylist.get(t.spotify_playlist_id) ?? [];
        list.push(t.spotify_track_id);
        byPlaylist.set(t.spotify_playlist_id, list);
      }
      await Promise.all(
        [...byPlaylist.entries()].map(([pid, ids]) =>
          removeTracksFromPlaylist(token, pid, ids)
        )
      );
      await markTracksUnliked(
        user.id,
        unliked.map((t) => t.spotify_track_id)
      );
      report.unliked = unliked.length;
    }
  } catch (err) {
    report.errors.push(`unlike-detection: ${String(err)}`);
  }

  // ── Step 3: Manual-removal detection ────────────────────────────────────────
  try {
    const playlists = await getUserPlaylists(user.id);
    await Promise.all(
      playlists.map(async (playlist) => {
        const [liveIds, dbTracks] = await Promise.all([
          getPlaylistTracks(token, playlist.spotify_playlist_id),
          getTracksAssignedToPlaylist(user.id, playlist.id),
        ]);
        const liveSet = new Set(liveIds);
        const removed = dbTracks.filter((t) => !liveSet.has(t.spotify_track_id));
        if (removed.length > 0) {
          await markManuallyRemovedFromPlaylist(
            removed.map((t) => t.id),
            playlist.id
          );
          report.manually_removed += removed.length;
        }
      })
    );
  } catch (err) {
    report.errors.push(`manual-removal-detection: ${String(err)}`);
  }

  // ── Step 1: Import new liked tracks ─────────────────────────────────────────
  const likedItems = await getLikedSinceDate(token, since);
  if (likedItems.length === 0) return report;

  await upsertLikedTracks(
    likedItems.map((item) => ({
      user_id: user.id,
      spotify_track_id: item.track.id,
      spotify_added_at: item.added_at,
      name: item.track.name,
      artists: item.track.artists.map((a) => a.name),
      artist_ids: item.track.artists.map((a) => a.id),
      isrc: item.track.external_ids?.isrc ?? null,
      artist_name: item.track.artists[0]?.name ?? null,
      album_name: item.track.album.name,
    }))
  );

  const spotifyIds = likedItems.map((i) => i.track.id);
  const alreadyClassified = new Set(await getClassifiedTrackIds(user.id, spotifyIds));
  const toProcess = likedItems.filter((i) => !alreadyClassified.has(i.track.id));

  report.already_existing = likedItems.length - toProcess.length;

  if (toProcess.length === 0) return report;

  const playlists = await getUserPlaylists(user.id);
  if (playlists.length === 0) return report;

  const tracksWithIsrc = toProcess
    .filter((i) => i.track.external_ids?.isrc)
    .map((i) => ({ id: i.track.id, isrc: i.track.external_ids!.isrc! }));

  // Deezer (genres) and ReccoBeats (audio features) run in parallel across all tracks
  const [featuresResult, genresResult] = await Promise.allSettled([
    getAudioFeaturesBatch(tracksWithIsrc, token),
    Promise.all(
      toProcess.map((item) =>
        resolveGenres(
          item.track.external_ids?.isrc,
          item.track.artists[0]?.name ?? "",
          item.track.name
        )
      )
    ),
  ]);

  const featuresMap = new Map<string, AudioFeatures & { id: string }>();
  if (featuresResult.status === "fulfilled") {
    for (const f of featuresResult.value) featuresMap.set(f.id, f);
    report.enriched = featuresMap.size;
    report.enrichment_failures = tracksWithIsrc.length - featuresMap.size;
  } else {
    report.enrichment_failures = tracksWithIsrc.length;
    console.error("[cron] audio features batch failed:", featuresResult.reason);
  }

  const genresList: string[][] =
    genresResult.status === "fulfilled"
      ? genresResult.value
      : toProcess.map(() => []);

  // Batch classify all tracks in a single pass (10 per LLM call)
  const batchInputs = toProcess.map((item, i) => ({
    track: {
      spotify_track_id: item.track.id,
      spotify_added_at: item.added_at,
      name: item.track.name,
      artists: item.track.artists.map((a) => a.name),
    } as ClassifierTrack,
    audioFeatures: featuresMap.get(item.track.id) ?? null,
    genres: genresList[i] ?? [],
  }));

  let classifyResults: ClassificationResult[];
  try {
    classifyResults = await classifyBatch(batchInputs, playlists);
  } catch (err) {
    report.errors.push(`classifyBatch failed: ${String(err)}`);
    return report;
  }

  // Collect spotify track IDs to push per playlist (one fetch per playlist, not per track)
  const tracksByPlaylist = new Map<string, string[]>();

  for (let i = 0; i < toProcess.length; i++) {
    const item = toProcess[i];
    const result = classifyResults[i];

    try {
      const { id: trackDbId } = await upsertTrack({
        user_id: user.id,
        spotify_track_id: item.track.id,
        spotify_added_at: item.added_at,
        name: item.track.name,
        artists: item.track.artists.map((a) => a.name),
        audio_features: batchInputs[i].audioFeatures,
        genres: batchInputs[i].genres,
        assigned_playlist: result.playlistId,
        extra_playlists: result.extraPlaylistIds,
        llm_suggestion: result.llmSuggestion,
        classified_at: new Date().toISOString(),
        classification_level: result.level,
        needs_review: result.needsReview,
      });

      if (result.playlistId && result.confidence >= 0.60) {
        const existing = tracksByPlaylist.get(result.playlistId) ?? [];
        existing.push(item.track.id);
        tracksByPlaylist.set(result.playlistId, existing);
      }

      await insertClassificationLog({
        track_id: trackDbId,
        user_id: user.id,
        level_used: result.level,
        suggested: result.playlistId ?? result.llmSuggestion,
        confidence: result.confidence,
        reason: result.reason ?? null,
        playlists_detail: result.playlistsDetail.length > 0 ? result.playlistsDetail : null,
      });

      if (result.needsReview) report.needs_review++;
      else report.classified_auto++;
      report.imported++;
    } catch (err) {
      report.errors.push(`${item.track.id}: ${String(err)}`);
    }
  }

  // One Spotify fetch per playlist instead of one per track
  for (const [playlistId, spotifyTrackIds] of tracksByPlaylist) {
    const playlist = playlists.find((p) => p.id === playlistId)!;
    await addTracksToPlaylist(token, playlist.spotify_playlist_id, spotifyTrackIds);
    await recalculateCentroid(user.id, playlistId);
  }

  return report;
}

async function recalculateCentroid(userId: string, playlistId: string): Promise<void> {
  const featureRows = await getPlaylistAssignedFeatures(userId, playlistId);
  if (featureRows.length === 0) return;

  const sums: Record<CentroidDim, number> = {
    energy: 0,
    danceability: 0,
    valence: 0,
    acousticness: 0,
    instrumentalness: 0,
  };
  let count = 0;

  for (const af of featureRows) {
    if (!af) continue;
    for (const dim of CENTROID_DIMS) {
      sums[dim] += (af as Record<CentroidDim, number>)[dim] ?? 0;
    }
    count++;
  }

  if (count === 0) return;

  const centroid: PlaylistCentroid = {
    energy: sums.energy / count,
    danceability: sums.danceability / count,
    valence: sums.valence / count,
    acousticness: sums.acousticness / count,
    instrumentalness: sums.instrumentalness / count,
    sample_size: count,
  };

  await updatePlaylistCentroid(playlistId, centroid);
}
