import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getUserBySpotifyId } from "@/lib/supabase/queries";
import { refreshAccessToken } from "@/lib/spotify/token";
import { getLikedSinceDate } from "@/lib/spotify/fetchers";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * GET /api/tracks/liked
 * Returns the current user's Spotify liked tracks from the last 7 days.
 * Used by the dashboard to show what will be processed at the next cron run.
 */
export async function GET(): Promise<Response> {
  const session = await getServerSession(authOptions);
  if (!session?.userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dbUser = await getUserBySpotifyId(session.userId);
  if (!dbUser) return Response.json({ error: "User not found" }, { status: 404 });

  const token = await refreshAccessToken(session.userId);
  const since = new Date(Date.now() - SEVEN_DAYS_MS);
  const items = await getLikedSinceDate(token, since);

  return Response.json({
    count: items.length,
    tracks: items.map((i) => ({
      id: i.track.id,
      name: i.track.name,
      artists: i.track.artists.map((a) => a.name),
      added_at: i.added_at,
    })),
  });
}
