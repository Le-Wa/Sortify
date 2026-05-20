import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { refreshAccessToken } from "@/lib/spotify/token";
import { addTracksToPlaylist } from "@/lib/spotify/fetchers";
import {
  getUserBySpotifyId,
  getPlaylistDetail,
  getUnsyncedPlaylistTracks,
  setPushedToSpotify,
} from "@/lib/supabase/queries";

type Params = Promise<{ playlist_id: string }>;

export async function POST(
  _req: Request,
  { params }: { params: Params }
): Promise<Response> {
  const session = await getServerSession(authOptions);
  if (!session?.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const dbUser = await getUserBySpotifyId(session.userId);
  if (!dbUser) return Response.json({ error: "User not found" }, { status: 404 });

  const { playlist_id } = await params;

  const playlist = await getPlaylistDetail(playlist_id, dbUser.id);
  if (!playlist) return Response.json({ error: "Playlist not found" }, { status: 404 });

  const unsyncedTracks = await getUnsyncedPlaylistTracks(playlist_id, dbUser.id);
  if (unsyncedTracks.length === 0) {
    return Response.json({ synced: 0, errors: [] });
  }

  const token = await refreshAccessToken(session.userId);

  // Single playlist fetch + batch POST — O(1) fetches regardless of track count
  try {
    await addTracksToPlaylist(
      token,
      playlist.spotify_playlist_id,
      unsyncedTracks.map((t) => t.spotify_track_id)
    );
  } catch (err) {
    return Response.json({ synced: 0, errors: [`Spotify sync failed: ${String(err)}`] });
  }

  // Spotify succeeded — mark all as pushed (including those already present in Spotify)
  let synced = 0;
  const errors: string[] = [];
  for (const track of unsyncedTracks) {
    try {
      await setPushedToSpotify(track.id, dbUser.id);
      synced++;
    } catch (err) {
      errors.push(`DB update failed for track ${track.id}: ${String(err)}`);
    }
  }

  return Response.json({ synced, errors });
}
