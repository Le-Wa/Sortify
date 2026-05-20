import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getUserSpotifyPlaylists } from "@/lib/spotify/fetchers";
import OnboardingClient from "./OnboardingClient";

export default async function OnboardingPage() {
  const session = await getServerSession(authOptions);
  if (!session?.userId) redirect("/login");

  let playlists: Awaited<ReturnType<typeof getUserSpotifyPlaylists>> = [];
  try {
    playlists = await getUserSpotifyPlaylists(session.accessToken);
  } catch {
    // If Spotify call fails, render with empty list — user can retry
  }

  return <OnboardingClient playlists={playlists} />;
}
