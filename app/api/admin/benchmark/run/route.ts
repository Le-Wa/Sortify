import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getUserBySpotifyId, getUserPlaylists } from "@/lib/supabase/queries";
import { classifyBatch } from "@/lib/classifier/engine";
import { classifyBatchV2 } from "@/lib/classifier/engine-v2";
import { createClient } from "@/lib/supabase/client";
import type { AudioFeatures, ClassifierTrack } from "@/lib/types";
import type { Level3BatchInput } from "@/lib/classifier/level3-llm";

interface TrackRow {
  id: string;
  spotify_track_id: string;
  name: string | null;
  artists: string[] | null;
  album_name: string | null;
  spotify_added_at: string | null;
  genres: string[] | null;
  audio_features: AudioFeatures | null;
  assigned_playlist: string | null;
}

async function fetchAllTracks(userId: string): Promise<TrackRow[]> {
  const supabase = createClient();
  const PAGE = 1000;
  const rows: TrackRow[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from("tracks")
      .select("id, spotify_track_id, name, artists, album_name, spotify_added_at, genres, audio_features, assigned_playlist")
      .eq("user_id", userId)
      .eq("is_archived", false)
      .order("spotify_added_at", { ascending: false })
      .range(from, from + PAGE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    rows.push(...(data as unknown as TrackRow[]));
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return rows;
}

export async function POST(req: Request): Promise<Response> {
  const session = await getServerSession(authOptions);
  if (!session?.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const dbUser = await getUserBySpotifyId(session.userId);
  if (!dbUser) return Response.json({ error: "User not found" }, { status: 404 });

  const [playlists, tracks] = await Promise.all([
    getUserPlaylists(dbUser.id),
    fetchAllTracks(dbUser.id),
  ]);

  if (playlists.length === 0) return Response.json({ error: "Aucune playlist" }, { status: 400 });
  if (tracks.length === 0) return Response.json({ error: "Aucun track" }, { status: 400 });

  const playlistMap = new Map(playlists.map((p) => [p.id, p.name]));

  const inputs: Level3BatchInput[] = tracks.map((t) => ({
    track: {
      spotify_track_id: t.spotify_track_id,
      spotify_added_at: t.spotify_added_at,
      name: t.name ?? undefined,
      artists: t.artists ?? undefined,
      album_name: t.album_name ?? undefined,
    } satisfies ClassifierTrack,
    audioFeatures: t.audio_features,
    genres: t.genres ?? [],
  }));

  // Sequential to avoid Anthropic rate limits (parallel = 16+ concurrent calls)
  const v1Results = await classifyBatch(inputs, playlists);
  const v2Results = await classifyBatchV2(inputs, playlists);

  const results = tracks.map((t, i) => {
    const r1 = v1Results[i];
    const r2 = v2Results[i];
    const af = t.audio_features;
    return {
      track_id: t.id,
      name: t.name ?? t.spotify_track_id,
      artist: t.artists?.[0] ?? "",
      album: t.album_name ?? "",
      genres: t.genres ?? [],
      af_energy: af?.energy ?? null,
      af_danceability: af?.danceability ?? null,
      af_valence: af?.valence ?? null,
      af_acousticness: af?.acousticness ?? null,
      af_tempo: af?.tempo ?? null,
      current_playlist_id: t.assigned_playlist ?? null,
      current_playlist_name: t.assigned_playlist ? (playlistMap.get(t.assigned_playlist) ?? null) : null,
      v1_playlist_id: r1.playlistId ?? null,
      v1_playlist_name: r1.playlistId ? (playlistMap.get(r1.playlistId) ?? null) : null,
      v1_confidence: r1.confidence,
      v1_level: r1.level,
      v1_needs_review: r1.needsReview,
      v1_reason: r1.reason ?? null,
      v1_detail: r1.playlistsDetail,
      v2_playlist_id: r2.playlistId ?? null,
      v2_playlist_name: r2.playlistId ? (playlistMap.get(r2.playlistId) ?? null) : null,
      v2_confidence: r2.confidence,
      v2_level: r2.level,
      v2_needs_review: r2.needsReview,
      v2_reason: r2.reason ?? null,
      v2_detail: r2.playlistsDetail,
    };
  });

  const supabase = createClient();
  const { error } = await supabase.from("benchmark_snapshot").upsert({
    user_id: dbUser.id,
    ran_at: new Date().toISOString(),
    results,
  });
  if (error) throw error;

  return Response.json({ count: results.length, ran_at: new Date().toISOString() });
}
