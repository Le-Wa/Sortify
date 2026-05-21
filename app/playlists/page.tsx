import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getUserBySpotifyId, getUserPlaylists, getPlaylistsStats } from "@/lib/supabase/queries";
import PlaylistsClient from "./PlaylistsClient";

export default async function PlaylistsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.userId) redirect("/login");

  const dbUser = await getUserBySpotifyId(session.userId);
  if (!dbUser) redirect("/login");

  const [playlists, stats] = await Promise.all([
    getUserPlaylists(dbUser.id),
    getPlaylistsStats(dbUser.id),
  ]);

  const data = playlists.map((p) => ({
    id: p.id,
    spotify_playlist_id: p.spotify_playlist_id,
    name: p.name,
    description: p.description,
    ...(stats[p.id] ?? { total: 0, synced: 0, not_synced: 0 }),
  }));

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 text-white">
      <PlaylistsClient playlists={data} />
    </main>
  );
}
