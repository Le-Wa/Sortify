import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getUserBySpotifyId, upsertLikedTracks, updateLastSyncAt } from "@/lib/supabase/queries";
import { refreshAccessToken } from "@/lib/spotify/token";
import { spotifyFetch } from "@/lib/spotify/rate-limiter";
import type { SavedTrackItem } from "@/lib/spotify/fetchers";

const ME_TRACKS = "https://api.spotify.com/v1/me/tracks";

export async function POST(req: Request): Promise<Response> {
  const session = await getServerSession(authOptions);
  if (!session?.userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { months = 0, cursor = null } = (await req.json()) as {
    months?: number;
    cursor?: string | null;
  };

  // Guard cursor against SSRF — must be a Spotify /me/tracks pagination URL
  if (cursor !== null && !cursor.startsWith(ME_TRACKS)) {
    return Response.json({ error: "Invalid cursor" }, { status: 400 });
  }

  const cutoff =
    months > 0
      ? new Date(Date.now() - months * 30.44 * 24 * 60 * 60 * 1000)
      : null;

  const dbUser = await getUserBySpotifyId(session.userId);
  if (!dbUser) return Response.json({ error: "User not found" }, { status: 404 });

  const token = await refreshAccessToken(session.userId);
  const url = cursor ?? `${ME_TRACKS}?limit=50`;

  const res = await spotifyFetch(url, token);
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    return Response.json({ error: `Spotify ${res.status}: ${body}` }, { status: 502 });
  }

  const data = (await res.json()) as {
    total: number;
    next: string | null;
    items: SavedTrackItem[];
  };

  const batch: Array<{
    user_id: string;
    spotify_track_id: string;
    spotify_added_at: string | null;
    name: string;
    artists: string[];
    artist_ids: string[];
    isrc: string | null;
  }> = [];

  let nextCursor: string | null = data.next;

  for (const item of data.items) {
    if (cutoff && new Date(item.added_at) < cutoff) {
      nextCursor = null; // hit the cutoff — stop pagination
      break;
    }
    batch.push({
      user_id: dbUser.id,
      spotify_track_id: item.track.id,
      spotify_added_at: item.added_at,
      name: item.track.name,
      artists: item.track.artists.map((a) => a.name),
      artist_ids: item.track.artists.map((a) => a.id),
      isrc: item.track.external_ids?.isrc ?? null,
    });
  }

  await upsertLikedTracks(batch);

  // When the last page has been processed, update last_sync_at
  if (nextCursor === null) {
    await updateLastSyncAt(dbUser.id);
  }

  return Response.json({
    pageImported: batch.length,
    total: data.total,
    cursor: nextCursor,
  });
}
