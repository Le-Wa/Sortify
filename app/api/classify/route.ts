import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { addTrackToPlaylist } from "@/lib/spotify/fetchers";
import { refreshAccessToken } from "@/lib/spotify/token";
import {
  getUserBySpotifyId,
  getTrackForConfirmation,
  getPlaylistForConfirmation,
  confirmTrackAssignment,
  mergeGenresIntoPlaylistRules,
} from "@/lib/supabase/queries";

export async function PATCH(req: Request): Promise<Response> {
  const session = await getServerSession(authOptions);
  if (!session?.userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const Body = z.object({
    trackId: z.string(),
    playlistId: z.string(),
    correctedTo: z.string().optional(),
  });
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return Response.json({ error: "Missing trackId or playlistId" }, { status: 400 });
  const { trackId, playlistId, correctedTo } = parsed.data;

  const dbUser = await getUserBySpotifyId(session.userId);
  if (!dbUser) return Response.json({ error: "User not found" }, { status: 404 });

  // Verify track ownership
  const track = await getTrackForConfirmation(trackId, dbUser.id);
  if (!track) return Response.json({ error: "Track not found" }, { status: 404 });

  // The final destination playlist (original suggestion or user correction)
  const finalPlaylistId = correctedTo ?? playlistId;

  // Verify target playlist ownership
  const targetPlaylist = await getPlaylistForConfirmation(finalPlaylistId, dbUser.id);
  if (!targetPlaylist) {
    return Response.json({ error: "Playlist not found" }, { status: 404 });
  }

  // Refresh Spotify token and add track to the playlist
  const token = await refreshAccessToken(session.userId);
  await addTrackToPlaylist(token, targetPlaylist.spotify_playlist_id, track.spotify_track_id);

  // Persist confirmation
  await confirmTrackAssignment({
    trackId,
    userId: dbUser.id,
    finalPlaylistId,
    suggestedPlaylistId: playlistId,
    correctedTo: correctedTo ?? null,
  });

  // Feedback loop: when the user corrects a track, merge its genres into
  // the target playlist's include list so future classifications improve
  if (correctedTo && (track.genres ?? []).length > 0) {
    await mergeGenresIntoPlaylistRules(
      correctedTo,
      track.genres!,
      targetPlaylist.rules
    );
  }

  return Response.json({ ok: true });
}
