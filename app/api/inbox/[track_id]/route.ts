import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { refreshAccessToken } from "@/lib/spotify/token";
import { addTrackToPlaylist } from "@/lib/spotify/fetchers";
import {
  getUserBySpotifyId,
  getTrackForConfirmation,
  getPlaylistForConfirmation,
  updateTrackInboxValidate,
  updateTrackInboxCorrect,
  updateTrackInboxArchive,
  setPushedToSpotify,
  insertInboxLog,
  getLatestLogByTrackIds,
} from "@/lib/supabase/queries";

type Params = Promise<{ track_id: string }>;

export async function PATCH(
  req: Request,
  { params }: { params: Params }
): Promise<Response> {
  const session = await getServerSession(authOptions);
  if (!session?.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const dbUser = await getUserBySpotifyId(session.userId);
  if (!dbUser) return Response.json({ error: "User not found" }, { status: 404 });

  const { track_id } = await params;
  const body = (await req.json()) as { action?: string; playlist_id?: string };
  const { action } = body;

  if (!action || !["validate", "correct", "archive"].includes(action)) {
    return Response.json({ error: "Invalid action" }, { status: 400 });
  }

  const track = await getTrackForConfirmation(track_id, dbUser.id);
  if (!track) return Response.json({ error: "Track not found" }, { status: 404 });

  if (action === "archive") {
    await updateTrackInboxArchive(track_id, dbUser.id);
    return Response.json({ success: true, track_id, action });
  }

  let targetPlaylistId: string;
  if (action === "validate") {
    if (!track.assigned_playlist) {
      return Response.json({ error: "No suggested playlist for this track" }, { status: 400 });
    }
    targetPlaylistId = track.assigned_playlist;
  } else {
    if (!body.playlist_id) {
      return Response.json({ error: "playlist_id is required for correct action" }, { status: 400 });
    }
    targetPlaylistId = body.playlist_id;
  }

  const targetPlaylist = await getPlaylistForConfirmation(targetPlaylistId, dbUser.id);
  if (!targetPlaylist) return Response.json({ error: "Playlist not found" }, { status: 404 });

  const originalSuggestion = track.assigned_playlist;

  if (action === "validate") {
    await updateTrackInboxValidate(track_id, dbUser.id);
  } else {
    await updateTrackInboxCorrect(track_id, dbUser.id, targetPlaylistId);
  }

  const token = await refreshAccessToken(session.userId);
  let spotifySuccess = false;
  try {
    await addTrackToPlaylist(token, targetPlaylist.spotify_playlist_id, track.spotify_track_id);
    spotifySuccess = true;
  } catch (err) {
    console.error("Spotify push failed:", err);
  }

  if (spotifySuccess) {
    await setPushedToSpotify(track_id, dbUser.id);
  }

  const logMap = await getLatestLogByTrackIds([track_id]);
  const latestLog = logMap[track_id];

  await insertInboxLog({
    track_id,
    user_id: dbUser.id,
    suggested: originalSuggestion,
    corrected_to: action === "correct" ? targetPlaylistId : null,
    confidence: latestLog?.confidence ?? 1.0,
    reason: action === "correct" ? "Manual correction" : "Manual confirmation",
  });

  return Response.json({ success: true, track_id, action });
}
