import { resolveGenres } from "@/lib/enrichment";
import { classify } from "@/lib/classifier/engine";
import {
  addTrackToPlaylist,
  getAudioFeaturesBatch,
  getLikedSinceDate,
  type SavedTrackItem,
} from "@/lib/spotify/fetchers";
import { refreshAccessToken } from "@/lib/spotify/token";
import {
  getCronEnabledUsers,
  getClassifiedTrackIds,
  getPlaylistAssignedFeatures,
  getUserPlaylists,
  insertClassificationLog,
  saveLastCronReport,
  updatePlaylistCentroid,
  upsertLikedTracks,
  upsertTrack,
  updateLastSyncAt,
} from "@/lib/supabase/queries";
import type { ClassifierTrack, PlaylistCentroid } from "@/lib/types";

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

  const results: {
    userId: string;
    status: "ok" | "error";
    processed?: number;
    error?: string;
  }[] = [];

  for (const user of users) {
    try {
      const report = await processUser(user, since);
      const fullReport = { ran_at: new Date().toISOString(), ...report };
      await Promise.all([
        saveLastCronReport(user.id, fullReport),
        updateLastSyncAt(user.id),
      ]);
      results.push({ userId: user.spotify_id, status: "ok", processed: report.imported });
    } catch (err) {
      console.error(`[cron] user ${user.spotify_id} failed:`, err);
      results.push({ userId: user.spotify_id, status: "error", error: String(err) });
    }
  }

  return Response.json({ total_users: users.length, results });
}

async function processUser(
  user: { id: string; spotify_id: string },
  since: Date
): Promise<ProcessReport> {
  const report: ProcessReport = {
    imported: 0,
    already_existing: 0,
    enriched: 0,
    enrichment_failures: 0,
    classified_auto: 0,
    needs_review: 0,
    errors: [],
  };

  const token = await refreshAccessToken(user.spotify_id);
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

  let featuresMap = new Map<string, Awaited<ReturnType<typeof getAudioFeaturesBatch>>[number]>();
  try {
    const featuresList = await getAudioFeaturesBatch(tracksWithIsrc, token);
    featuresMap = new Map(featuresList.map((f) => [f.id, f]));
    report.enriched = featuresMap.size;
    report.enrichment_failures = tracksWithIsrc.length - featuresMap.size;
  } catch {
    report.enrichment_failures = tracksWithIsrc.length;
  }

  const affectedPlaylists = new Set<string>();

  for (const item of toProcess) {
    try {
      const result = await processTrack(item, user, token, playlists, featuresMap, affectedPlaylists);
      if (result.needsReview) report.needs_review++;
      else report.classified_auto++;
      report.imported++;
    } catch (err) {
      report.errors.push(`${item.track.id}: ${String(err)}`);
    }
  }

  for (const playlistId of affectedPlaylists) {
    await recalculateCentroid(user.id, playlistId);
  }

  return report;
}

async function processTrack(
  item: SavedTrackItem,
  user: { id: string; spotify_id: string },
  token: string,
  playlists: Awaited<ReturnType<typeof getUserPlaylists>>,
  featuresMap: Map<string, Awaited<ReturnType<typeof getAudioFeaturesBatch>>[number]>,
  affectedPlaylists: Set<string>
): Promise<{ needsReview: boolean }> {
  const features = featuresMap.get(item.track.id) ?? null;

  const genres = await resolveGenres(
    item.track.external_ids?.isrc,
    item.track.artists[0]?.name ?? "",
    item.track.name
  );

  const classifierTrack: ClassifierTrack = {
    spotify_track_id: item.track.id,
    spotify_added_at: item.added_at,
    name: item.track.name,
    artists: item.track.artists.map((a) => a.name),
  };

  const result = await classify(classifierTrack, features, genres, playlists);

  const { id: trackDbId } = await upsertTrack({
    user_id: user.id,
    spotify_track_id: item.track.id,
    spotify_added_at: item.added_at,
    name: item.track.name,
    artists: item.track.artists.map((a) => a.name),
    audio_features: features,
    genres,
    assigned_playlist: result.playlistId,
    classified_at: new Date().toISOString(),
    classification_level: result.level,
    needs_review: result.needsReview,
  });

  if (result.playlistId && result.confidence >= 0.60) {
    const playlist = playlists.find((p) => p.id === result.playlistId)!;
    await addTrackToPlaylist(token, playlist.spotify_playlist_id, item.track.id);
    affectedPlaylists.add(result.playlistId);
  }

  await insertClassificationLog({
    track_id: trackDbId,
    user_id: user.id,
    level_used: result.level,
    suggested: result.playlistId,
    confidence: result.confidence,
    reason: result.reason ?? null,
  });

  return { needsReview: result.needsReview };
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
