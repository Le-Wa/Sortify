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
import type { AudioFeatures, ClassifierTrack } from "@/lib/types";

const BATCH_SIZE = 10;

export async function POST(req: Request): Promise<Response> {
  const session = await getServerSession(authOptions);
  if (!session?.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const dbUser = await getUserBySpotifyId(session.userId);
  if (!dbUser) return Response.json({ error: "User not found" }, { status: 404 });

  const body = await req.json().catch(() => ({})) as { skipLlm?: boolean };
  const skipLlm = body.skipLlm === true;

  const [tracks, playlists] = await Promise.all([
    getTracksForClassification(dbUser.id, BATCH_SIZE),
    getUserPlaylists(dbUser.id),
  ]);

  if (playlists.length === 0) {
    return Response.json({ error: "Aucune playlist configurée" }, { status: 400 });
  }

  const remaining = await countTracksForClassification(dbUser.id);

  let classified = 0;
  let needsReview = 0;
  const errors: string[] = [];

  for (const row of tracks) {
    const track: ClassifierTrack = {
      spotify_track_id: row.spotify_track_id,
      spotify_added_at: row.spotify_added_at,
      name: row.name ?? undefined,
      artists: row.artists ?? undefined,
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
        classified_at: new Date().toISOString(),
        classification_level: result.level,
        needs_review: result.needsReview,
      });

      await insertClassificationLog({
        track_id: trackDbId,
        user_id: dbUser.id,
        level_used: result.level,
        suggested: result.playlistId,
        confidence: result.confidence,
        reason: result.reason ?? null,
      });

      if (result.needsReview) {
        needsReview++;
      } else {
        classified++;
      }
    } catch (e) {
      errors.push(`${row.spotify_track_id}: ${String(e)}`);
    }
  }

  return Response.json({
    classified,
    needs_review: needsReview,
    batch_size: tracks.length,
    remaining: Math.max(0, remaining - tracks.length),
    errors,
  });
}
