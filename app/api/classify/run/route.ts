import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { classify } from "@/lib/classifier/engine";
import { classifyV2 } from "@/lib/classifier/engine-v2";
import {
  getUserBySpotifyId,
  getUserPlaylists,
  getTracksForClassification,
  countTracksForClassification,
  upsertTrack,
  insertClassificationLog,
} from "@/lib/supabase/queries";
import { addTracksToPlaylist } from "@/lib/spotify/fetchers";
import { refreshAccessToken } from "@/lib/spotify/token";
import type { AudioFeatures, ClassifierTrack } from "@/lib/types";

const BATCH_SIZE_LLM = 5;   // smaller — each track may call Anthropic (~2s)
const BATCH_SIZE_FAST = 25; // larger — L1/L2 only, no API calls

export async function POST(req: Request): Promise<Response> {
  const session = await getServerSession(authOptions);
  if (!session?.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const dbUser = await getUserBySpotifyId(session.userId);
  if (!dbUser) return Response.json({ error: "User not found" }, { status: 404 });

  const RunBody = z.object({
    skipLlm: z.boolean().optional(),
    classifierVersion: z.enum(["v1", "v2"]).optional(),
  });
  const parsed = RunBody.safeParse(await req.json().catch(() => ({})));
  const skipLlm = parsed.success ? (parsed.data.skipLlm ?? false) : false;
  const classifierVersion: "v1" | "v2" = parsed.success ? (parsed.data.classifierVersion ?? "v1") : "v1";

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
  const tracksByPlaylist = new Map<string, string[]>();

  for (const row of tracks) {
    const track: ClassifierTrack = {
      spotify_track_id: row.spotify_track_id,
      spotify_added_at: row.spotify_added_at,
      name: row.name ?? undefined,
      artists: row.artists ?? undefined,
      album_name: row.album_name,
    };

    try {
      const result = classifierVersion === "v2"
        ? await classifyV2(track, row.audio_features as AudioFeatures | null, row.genres ?? [], playlists)
        : await classify(track, row.audio_features as AudioFeatures | null, row.genres ?? [], playlists, { skipLlm });

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
        classifier_version: classifierVersion,
      });

      if (result.playlistId) {
        const allIds = [result.playlistId, ...result.extraPlaylistIds];
        for (const pid of allIds) {
          const ids = tracksByPlaylist.get(pid) ?? [];
          ids.push(row.spotify_track_id);
          tracksByPlaylist.set(pid, ids);
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

  for (const [playlistId, trackIds] of tracksByPlaylist) {
    const playlist = playlists.find((p) => p.id === playlistId);
    if (playlist) {
      await addTracksToPlaylist(token, playlist.spotify_playlist_id, trackIds);
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
