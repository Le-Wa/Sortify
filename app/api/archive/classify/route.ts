import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { classify } from "@/lib/classifier/engine";
import {
  getUserBySpotifyId,
  getUserPlaylists,
  getUnorganizedTracks,
  upsertTrack,
  insertClassificationLog,
  updatePlaylistCentroid,
  getPlaylistAssignedFeatures,
} from "@/lib/supabase/queries";
import { resolveGenres as resolveTrackGenres } from "@/lib/enrichment";
import {
  getAudioFeaturesBatch,
  addTrackToPlaylist,
} from "@/lib/spotify/fetchers";
import { refreshAccessToken } from "@/lib/spotify/token";
import type { ClassifierTrack, PlaylistCentroid } from "@/lib/types";

const BATCH_SIZE = 5;

type CentroidDim = keyof Omit<PlaylistCentroid, "sample_size">;
const CENTROID_DIMS: CentroidDim[] = [
  "energy", "danceability", "valence", "acousticness", "instrumentalness",
];

async function recalculateCentroid(userId: string, playlistId: string): Promise<void> {
  const featureRows = await getPlaylistAssignedFeatures(userId, playlistId);
  if (featureRows.length === 0) return;
  const sums: Record<CentroidDim, number> = {
    energy: 0, danceability: 0, valence: 0, acousticness: 0, instrumentalness: 0,
  };
  let count = 0;
  for (const af of featureRows) {
    if (!af) continue;
    for (const dim of CENTROID_DIMS) sums[dim] += (af as Record<CentroidDim, number>)[dim] ?? 0;
    count++;
  }
  if (count === 0) return;
  await updatePlaylistCentroid(playlistId, {
    energy: sums.energy / count,
    danceability: sums.danceability / count,
    valence: sums.valence / count,
    acousticness: sums.acousticness / count,
    instrumentalness: sums.instrumentalness / count,
    sample_size: count,
  });
}

export async function POST(): Promise<Response> {
  const session = await getServerSession(authOptions);
  if (!session?.userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dbUser = await getUserBySpotifyId(session.userId);
  if (!dbUser) return Response.json({ error: "User not found" }, { status: 404 });

  const [allRows, playlists, token] = await Promise.all([
    getUnorganizedTracks(dbUser.id),
    getUserPlaylists(dbUser.id),
    refreshAccessToken(session.userId),
  ]);

  if (allRows.length === 0) {
    return Response.json({ batchProcessed: 0, batchClassified: 0, batchNeedsReview: 0, batchFailed: 0, remaining: 0 });
  }
  if (playlists.length === 0) {
    return Response.json({ error: "Aucune playlist configurée" }, { status: 400 });
  }

  const batch = allRows.slice(0, BATCH_SIZE);
  const remaining = allRows.length - batch.length;

  // ISRC and artist_ids stored during import — no Spotify metadata call needed
  const tracksWithIsrc = batch
    .filter((r) => r.isrc)
    .map((r) => ({ id: r.spotify_track_id, isrc: r.isrc! }));

  console.log("[classify] batch:", batch.length, "withIsrc:", tracksWithIsrc.length, "sample isrc:", tracksWithIsrc[0]?.isrc ?? "none");

  const featuresList = await getAudioFeaturesBatch(tracksWithIsrc, token);
  const featuresMap = new Map(featuresList.map((f) => [f.id, f]));

  console.log("[classify] features fetched:", featuresList.length);

  let batchClassified = 0;
  let batchNeedsReview = 0;
  let batchFailed = 0;
  const affectedPlaylists = new Set<string>();

  for (const row of batch) {
    const features = featuresMap.get(row.spotify_track_id) ?? null;

    const genres = await resolveTrackGenres(row.isrc ?? undefined, row.artists?.[0] ?? "", row.name ?? "");

    const classifierTrack: ClassifierTrack = {
      spotify_track_id: row.spotify_track_id,
      spotify_added_at: row.spotify_added_at,
      name: row.name ?? undefined,
      artists: row.artists ?? undefined,
    };

    const result = await classify(classifierTrack, features, genres, playlists, { skipLlm: true });

    const { id: trackDbId } = await upsertTrack({
      user_id: dbUser.id,
      spotify_track_id: row.spotify_track_id,
      spotify_added_at: row.spotify_added_at,
      name: row.name ?? null,
      artists: row.artists ?? null,
      audio_features: features,
      genres,
      assigned_playlist: result.playlistId,
      classified_at: new Date().toISOString(),
      classification_level: result.level,
      needs_review: result.needsReview,
    });

    if (result.playlistId && result.confidence >= 0.60) {
      const playlist = playlists.find((p) => p.id === result.playlistId)!;
      await addTrackToPlaylist(token, playlist.spotify_playlist_id, row.spotify_track_id);
      affectedPlaylists.add(result.playlistId);
      batchClassified++;
    } else {
      batchNeedsReview++;
    }

    await insertClassificationLog({
      track_id: trackDbId,
      user_id: dbUser.id,
      level_used: result.level,
      suggested: result.playlistId,
      confidence: result.confidence,
      reason: result.reason ?? null,
    });
  }

  for (const playlistId of affectedPlaylists) {
    await recalculateCentroid(dbUser.id, playlistId);
  }

  return Response.json({ batchProcessed: batch.length, batchClassified, batchNeedsReview, batchFailed, remaining });
}
