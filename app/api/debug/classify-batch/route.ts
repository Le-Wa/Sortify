import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { classify } from "@/lib/classifier/engine";
import { getUserBySpotifyId, getUserPlaylists } from "@/lib/supabase/queries";
import { createClient } from "@/lib/supabase/client";
import type { AudioFeatures, ClassifierTrack } from "@/lib/types";

export async function GET(): Promise<Response> {
  const session = await getServerSession(authOptions);
  if (!session?.userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dbUser = await getUserBySpotifyId(session.userId);
  if (!dbUser) return Response.json({ error: "User not found" }, { status: 404 });

  const playlists = await getUserPlaylists(dbUser.id);
  if (playlists.length === 0) {
    return Response.json({ error: "No playlists configured" }, { status: 400 });
  }

  const supabase = createClient();
  const { data: rows, error } = await supabase
    .from("tracks")
    .select("spotify_track_id, name, artists, spotify_added_at, audio_features, genres, assigned_playlist")
    .eq("user_id", dbUser.id)
    .not("audio_features", "is", null)
    .not("assigned_playlist", "is", null);

  if (error) return Response.json({ error: error.message }, { status: 500 });
  if (!rows || rows.length === 0) return Response.json([]);

  // Stratified sampling: group by assigned_playlist, pick equal quota per group
  const TARGET = 20;
  const byPlaylist = new Map<string, typeof rows>();
  for (const row of rows) {
    const key = row.assigned_playlist as string;
    if (!byPlaylist.has(key)) byPlaylist.set(key, []);
    byPlaylist.get(key)!.push(row);
  }

  const quota = Math.ceil(TARGET / byPlaylist.size);
  const sample = [...byPlaylist.values()].flatMap((group) =>
    group.sort(() => Math.random() - 0.5).slice(0, quota)
  );

  const results = await Promise.all(
    sample.map(async (row) => {
      const track: ClassifierTrack = {
        spotify_track_id: row.spotify_track_id as string,
        spotify_added_at: row.spotify_added_at as string | null,
        name: (row.name as string | null) ?? undefined,
        artists: (row.artists as string[] | null) ?? undefined,
      };
      const result = await classify(
        track,
        row.audio_features as AudioFeatures | null,
        (row.genres as string[] | null) ?? [],
        playlists
      );
      return {
        track: {
          id: row.spotify_track_id as string,
          name: (row.name as string | null) ?? null,
          artist_name: ((row.artists as string[] | null)?.[0]) ?? null,
        },
        result: {
          playlistIds: result.playlistId ? [result.playlistId] : [],
          confidence: result.confidence,
          level: result.level,
          reason: result.reason ?? null,
          needsReview: result.needsReview,
        },
      };
    })
  );

  const debug = {
    totalTracksFound: rows.length,
    groupes: [...byPlaylist.entries()].map(([playlistId, group]) => ({
      playlistId,
      count: group.length,
    })),
  };

  return Response.json({ debug, results });
}
