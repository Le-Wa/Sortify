import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getUserBySpotifyId, getArchivedTracks } from "@/lib/supabase/queries";

export async function GET(): Promise<Response> {
  const session = await getServerSession(authOptions);
  if (!session?.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const dbUser = await getUserBySpotifyId(session.userId);
  if (!dbUser) return Response.json({ error: "User not found" }, { status: 404 });

  const rows = await getArchivedTracks(dbUser.id);

  const tracks = rows.map((row) => ({
    id: row.id,
    name: row.name,
    artist_name: row.artist_name ?? (row.artists?.[0] ?? null),
    album_name: row.album_name,
    genres: row.genres ?? [],
    spotify_added_at: row.spotify_added_at,
    is_archived: true,
  }));

  return Response.json({ tracks, total: tracks.length });
}
