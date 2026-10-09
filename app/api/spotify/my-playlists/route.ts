import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { refreshAccessToken } from "@/lib/spotify/token";
import { getUserSpotifyPlaylists } from "@/lib/spotify/fetchers";
import { spotifyFetch } from "@/lib/spotify/rate-limiter";
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

    // Fetch real Spotify identity — needed for dev personas where session.userId ≠ real Spotify account
    const meRes = await spotifyFetch("https://api.spotify.com/v1/me", token);
    if (!meRes.ok) {
      return Response.json({ error: `Spotify /me failed: ${meRes.status}` }, { status: 502 });
    }
    const me = (await meRes.json()) as { id: string };
    const realSpotifyId = me.id;

    const playlists = await getUserSpotifyPlaylists(token);

    return Response.json(
      playlists
        .filter((p) => p.owner.id === realSpotifyId)
        .map((p) => ({
          id: p.id,
          name: p.name,
          tracks_total: p.tracks?.total ?? 0,
          cover_url: p.images?.[0]?.url ?? null,
          is_owned: true,
          already_linked: linkedIds.has(p.id),
        }))
    );
  } catch (err) {
    console.error("[my-playlists]", err);
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
