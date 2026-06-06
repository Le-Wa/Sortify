import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { refreshAccessToken } from "@/lib/spotify/token";
import { getUserSpotifyPlaylists } from "@/lib/spotify/fetchers";
import { getUserBySpotifyId, getAllPlaylists } from "@/lib/supabase/queries";

export async function GET(): Promise<Response> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const dbUser = await getUserBySpotifyId(session.userId);
    if (!dbUser) return Response.json({ error: "User not found" }, { status: 404 });

    const existing = await getAllPlaylists(dbUser.id);
    const linkedIds = new Set(existing.map((p) => p.spotify_playlist_id));

    const token = await refreshAccessToken(session.userId);
    const playlists = await getUserSpotifyPlaylists(token);

    return Response.json(
      playlists
        .filter((p) => p.owner.id === session.userId)
        .map((p) => ({
          id: p.id,
          name: p.name,
          tracks_total: p.tracks?.total ?? 0,
          already_linked: linkedIds.has(p.id),
        }))
    );
  } catch (err) {
    console.error("[my-playlists]", err);
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
