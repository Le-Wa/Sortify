import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getUserBySpotifyId, getDashboardCounts } from "@/lib/supabase/queries";
import { refreshAccessToken } from "@/lib/spotify/token";
import { spotifyFetch } from "@/lib/spotify/rate-limiter";

export async function GET(): Promise<Response> {
  const session = await getServerSession(authOptions);
  if (!session?.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const dbUser = await getUserBySpotifyId(session.userId);
  if (!dbUser) return Response.json({ error: "User not found" }, { status: 404 });

  const [counts, spotifyTotal] = await Promise.all([
    getDashboardCounts(dbUser.id),
    (async () => {
      try {
        const token = await refreshAccessToken(session.userId);
        const res = await spotifyFetch(
          "https://api.spotify.com/v1/me/tracks?limit=1",
          token
        );
        if (!res.ok) return null;
        const data = (await res.json()) as { total: number };
        return data.total;
      } catch {
        return null;
      }
    })(),
  ]);

  if (spotifyTotal !== null && spotifyTotal < counts.imported) {
    console.warn(
      `[dashboard/stats] spotify_total (${spotifyTotal}) < imported (${counts.imported}) — sync drift`
    );
  }

  return Response.json({
    spotify_total: spotifyTotal,
    imported: counts.imported,
    not_imported: spotifyTotal !== null ? Math.max(0, spotifyTotal - counts.imported) : null,
    in_playlists: counts.in_playlists,
    not_in_playlist: counts.not_in_playlist,
    needs_review: counts.needs_review,
    archived: counts.archived,
    last_sync_at: counts.last_sync_at,
    cron_enabled: counts.cron_enabled,
  });
}
