import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getUserBySpotifyId, getAllPlaylists, deleteAllUserTracks } from "@/lib/supabase/queries";
import { refreshAccessToken } from "@/lib/spotify/token";
import { getPlaylistTracks } from "@/lib/spotify/fetchers";
import { spotifyFetch } from "@/lib/spotify/rate-limiter";

const BASE = "https://api.spotify.com/v1";

async function clearSpotifyPlaylist(token: string, spotifyPlaylistId: string): Promise<number> {
  const trackIds = await getPlaylistTracks(token, spotifyPlaylistId);
  if (trackIds.length === 0) return 0;

  const BATCH = 100;
  for (let i = 0; i < trackIds.length; i += BATCH) {
    const batch = trackIds.slice(i, i + BATCH);
    const res = await spotifyFetch(
      `${BASE}/playlists/${spotifyPlaylistId}/tracks`,
      token,
      3,
      {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tracks: batch.map((id) => ({ uri: `spotify:track:${id}` })) }),
      }
    );
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`clearSpotifyPlaylist ${spotifyPlaylistId} — HTTP ${res.status}: ${body}`);
    }
  }

  return trackIds.length;
}

export async function POST(): Promise<Response> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const dbUser = await getUserBySpotifyId(session.userId);
    if (!dbUser) return Response.json({ error: "User not found" }, { status: 404 });

    const token = await refreshAccessToken(session.userId);
    const playlists = await getAllPlaylists(dbUser.id);

    const results: { name: string; removed: number }[] = [];

    for (const playlist of playlists) {
      if (!playlist.spotify_playlist_id) continue;
      try {
        const removed = await clearSpotifyPlaylist(token, playlist.spotify_playlist_id);
        results.push({ name: playlist.name, removed });
      } catch (err) {
        results.push({ name: playlist.name, removed: -1 });
        console.error(`reset-all: failed to clear ${playlist.name}`, err);
      }
    }

    const deletedTracks = await deleteAllUserTracks(dbUser.id);

    return Response.json({ playlists: results, deletedTracks });
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : typeof (err as { message?: unknown }).message === "string"
          ? (err as { message: string }).message
          : JSON.stringify(err);
    console.error("reset-all: unexpected error", err);
    return Response.json({ error: message }, { status: 500 });
  }
}
