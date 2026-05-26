import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { refreshAccessToken } from "@/lib/spotify/token";
import { addTrackToPlaylist } from "@/lib/spotify/fetchers";
import {
  getUserBySpotifyId,
  getInboxTracksNeedsReview,
  getLatestLogByTrackIds,
  getPlaylistForConfirmation,
  updateTrackInboxCorrect,
  setPushedToSpotify,
  insertInboxLog,
} from "@/lib/supabase/queries";

export async function POST(req: Request): Promise<Response> {
  const session = await getServerSession(authOptions);
  if (!session?.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const dbUser = await getUserBySpotifyId(session.userId);
  if (!dbUser) return Response.json({ error: "User not found" }, { status: 404 });

  const Body = z.object({ min_confidence: z.number().optional() });
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  const minConfidence = parsed.success ? (parsed.data.min_confidence ?? 0.55) : 0.55;

  const rows = await getInboxTracksNeedsReview(dbUser.id);
  const trackIds = rows.map((r) => r.id);
  const logMap = await getLatestLogByTrackIds(trackIds, dbUser.id);

  const eligible = rows.filter((row) => {
    const confidence = logMap[row.id]?.confidence ?? null;
    return confidence !== null && confidence >= minConfidence && row.llm_suggestion !== null;
  });

  if (eligible.length === 0) {
    return Response.json({ validated: 0, errors: [] });
  }

  const token = await refreshAccessToken(session.userId);
  let validated = 0;
  const errors: string[] = [];

  for (const row of eligible) {
    try {
      const suggestionId = row.llm_suggestion!;
      const playlist = await getPlaylistForConfirmation(suggestionId, dbUser.id);
      if (!playlist) {
        errors.push(`Track ${row.id}: playlist not found`);
        continue;
      }

      let spotifySuccess = false;
      try {
        await addTrackToPlaylist(token, playlist.spotify_playlist_id, row.spotify_track_id);
        spotifySuccess = true;
      } catch (err) {
        console.error(`Spotify push failed for track ${row.id}:`, err);
      }

      await updateTrackInboxCorrect(row.id, dbUser.id, [suggestionId]);
      if (spotifySuccess) await setPushedToSpotify(row.id, dbUser.id);

      await insertInboxLog({
        track_id: row.id,
        user_id: dbUser.id,
        suggested: suggestionId,
        corrected_to: null,
        confidence: logMap[row.id]?.confidence ?? 1.0,
        reason: "Batch validation",
      });

      validated++;
    } catch (err) {
      errors.push(`Track ${row.id}: ${String(err)}`);
    }
  }

  return Response.json({ validated, errors });
}
