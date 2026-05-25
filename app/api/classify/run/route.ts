import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { classify } from "@/lib/classifier/engine";
import {
  getUserBySpotifyId,
  getUserPlaylists,
  getTracksForClassification,
  countTracksForClassification,
  upsertTrack,
  insertClassificationLog,
} from "@/lib/supabase/queries";
import { addTrackToPlaylist } from "@/lib/spotify/fetchers";
import { refreshAccessToken } from "@/lib/spotify/token";
import type { AudioFeatures, ClassifierTrack } from "@/lib/types";

const BATCH_SIZE_LLM = 5;   // smaller — each track may call Anthropic (~2s)
const BATCH_SIZE_FAST = 25; // larger — L1/L2 only, no API calls

export async function POST(req: Request): Promise<Response> {
  const session = await getServerSession(authOptions);
  if (!session?.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const dbUser = await getUserBySpotifyId(session.userId);
  if (!dbUser) return Response.json({ error: "User not found" }, { status: 404 });

  const body = await req.json().catch(() => ({})) as { skipLlm?: boolean };
  const skipLlm = body.skipLlm === true;

  const batchSize = skipLlm ? BATCH_SIZE_FAST : BATCH_SIZE_LLM;

  const [tracks, playlists, token] = await Promise.all([
    getTracksForClassification(dbUser.id, batchSize),
    getUserPlaylists(dbUser.id),
    refreshAccessToken(session.userId),
  ]);

  if (playlists.length === 0) {
    return Response.json({ error: "Aucune playlist configurée" }, { status: 400 });
  }

  const remaining = await countTracksForClassification(dbUser.id);

  let classified = 0;
  let needsReview = 0;
  const errors: string[] = [];
  const batchResults: Array<{ name: string; artist: string; playlist_name: string }> = [];

  for (const row of tracks) {
    const track: ClassifierTrack = {
      spotify_track_id: row.spotify_track_id,
      spotify_added_at: row.spotify_added_at,
      name: row.name ?? undefined,
      artists: row.artists ?? undefined,
      album_name: row.album_name,
    };

    try {
      const result = await classify(
        track,
        row.audio_features as AudioFeatures | null,
        row.genres ?? [],
        playlists,
        { skipLlm }
      );

      const { id: trackDbId } = await upsertTrack({
        user_id: dbUser.id,
        spotify_track_id: row.spotify_track_id,
        spotify_added_at: row.spotify_added_at,
        name: row.name ?? null,
        artists: row.artists ?? null,
        audio_features: row.audio_features as AudioFeatures | null,
        genres: row.genres ?? [],
        assigned_playlist: result.playlistId,
        extra_playlists: result.extraPlaylistIds,
        llm_suggestion: result.llmSuggestion,
        classified_at: new Date().toISOString(),
        classification_level: result.level,
        needs_review: result.needsReview,
      });

      await insertClassificationLog({
        track_id: trackDbId,
        user_id: dbUser.id,
        level_used: result.level,
        suggested: result.playlistId ?? result.llmSuggestion,
        confidence: result.confidence,
        reason: result.reason ?? null,
        playlists_detail: result.playlistsDetail.length > 0 ? result.playlistsDetail : null,
      });

      if (result.playlistId) {
        const allIds = [result.playlistId, ...result.extraPlaylistIds];
        for (const pid of allIds) {
          const playlist = playlists.find((p) => p.id === pid);
          if (playlist) {
            await addTrackToPlaylist(token, playlist.spotify_playlist_id, row.spotify_track_id);
          }
        }
      }

      const assignedPlaylist = result.playlistId
        ? playlists.find((p) => p.id === result.playlistId)
        : null;
      batchResults.push({
        name: (row.name ?? row.spotify_track_id) as string,
        artist: Array.isArray(row.artists) && (row.artists as string[]).length > 0
          ? (row.artists as string[])[0]
          : "",
        playlist_name: assignedPlaylist?.name ?? (result.needsReview ? "Inbox" : ""),
      });

      if (result.needsReview) needsReview++;
      else classified++;
    } catch (e) {
      errors.push(`${row.spotify_track_id}: ${String(e)}`);
    }
  }

  return Response.json({
    classified,
    needs_review: needsReview,
    batch_size: tracks.length,
    remaining: Math.max(0, remaining - tracks.length),
    total: remaining,
    results: batchResults,
    errors,
  });
}
