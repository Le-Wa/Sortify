import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getUserBySpotifyId, getAllPlaylists, getPlaylistsStats } from "@/lib/supabase/queries";
import HomeClient from "./HomeClient";

export default async function HomePage() {
  const session = await getServerSession(authOptions);
  if (!session?.userId) redirect("/login");

  const dbUser = await getUserBySpotifyId(session.userId);
  if (!dbUser) redirect("/login");

  const [playlists, stats] = await Promise.all([
    getAllPlaylists(dbUser.id),
    getPlaylistsStats(dbUser.id),
  ]);

  const data = playlists
    .filter((p) => p.enabled)
    .sort((a, b) => a.priority - b.priority)
    .map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      priority: p.priority,
      enabled: p.enabled,
      ...(stats[p.id] ?? { total: 0, synced: 0, not_synced: 0 }),
    }));

  const firstName = session.user?.name?.split(" ")[0] ?? "";

  return <HomeClient playlists={data} firstName={firstName} />;
}
