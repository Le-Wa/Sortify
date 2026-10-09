import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getUserBySpotifyId, getAllPlaylists, getPlaylistsStats, getUserWithOnboarding } from "@/lib/supabase/queries";
import PlaylistsClient from "./PlaylistsClient";

export default async function PlaylistsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.userId) redirect("/login");

  const dbUser = await getUserBySpotifyId(session.userId);
  if (!dbUser) redirect("/login");

  const [playlists, stats, onboarding] = await Promise.all([
    getAllPlaylists(dbUser.id),
    getPlaylistsStats(dbUser.id),
    getUserWithOnboarding(session.userId),
  ]);

  const data = playlists.map((p) => ({
    id: p.id,
    spotify_playlist_id: p.spotify_playlist_id,
    name: p.name,
    description: p.description,
    priority: p.priority,
    enabled: p.enabled,
    llm_help_text: p.llm_help_text,
    learned_at: p.learned_at,
    color: p.color ?? null,
    ...(stats[p.id] ?? { total: 0, synced: 0, not_synced: 0 }),
  }));

  const onboardingMode = onboarding?.onboarding_mode ?? null;
  const onboardingDone = onboarding?.onboarding_status === "complete";

  return <PlaylistsClient playlists={data} onboardingMode={onboardingMode} onboardingDone={onboardingDone} />;
}
