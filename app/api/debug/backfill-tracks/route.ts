import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getUserBySpotifyId, getNullNameTracks, updateTrackMeta } from "@/lib/supabase/queries";
import { getSpotifyTracks } from "@/lib/spotify/fetchers";
import { refreshAccessToken } from "@/lib/spotify/token";

export async function GET(): Promise<Response> {
  const session = await getServerSession(authOptions);
  if (!session?.userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dbUser = await getUserBySpotifyId(session.userId);
  if (!dbUser) return Response.json({ error: "User not found" }, { status: 404 });

  const nullNameTracks = await getNullNameTracks(dbUser.id);
  if (nullNameTracks.length === 0) return Response.json({ updated: 0, errors: 0 });

  const token = await refreshAccessToken(session.userId);
  const trackIds = nullNameTracks.map((t) => t.spotify_track_id);
  const spotifyMap = await getSpotifyTracks(trackIds, token);

  let updated = 0;
  let errors = 0;

  for (const row of nullNameTracks) {
    const track = spotifyMap.get(row.spotify_track_id);
    if (!track) {
      errors++;
      continue;
    }
    try {
      await updateTrackMeta(row.spotify_track_id, dbUser.id, {
        name: track.name,
        artist_name: track.artists[0]?.name ?? null,
        album_name: track.album.name,
        isrc: track.external_ids?.isrc ?? null,
      });
      updated++;
    } catch {
      errors++;
    }
  }

  return Response.json({ updated, errors });
}
