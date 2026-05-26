import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import {
  getUserBySpotifyId,
  getPlaylistDetail,
  getPlaylistTracksAssigned,
  getLatestLogByTrackIds,
} from "@/lib/supabase/queries";

const PER_PAGE = 50;

type Params = Promise<{ playlist_id: string }>;

export async function GET(
  req: Request,
  { params }: { params: Params }
): Promise<Response> {
  const session = await getServerSession(authOptions);
  if (!session?.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const dbUser = await getUserBySpotifyId(session.userId);
  if (!dbUser) return Response.json({ error: "User not found" }, { status: 404 });

  const { playlist_id } = await params;
  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const perPage = Math.min(100, Math.max(1, parseInt(searchParams.get("per_page") ?? String(PER_PAGE), 10)));

  const playlist = await getPlaylistDetail(playlist_id, dbUser.id);
  if (!playlist) return Response.json({ error: "Playlist not found" }, { status: 404 });

  const allTracks = await getPlaylistTracksAssigned(playlist_id, dbUser.id);
  const total = allTracks.length;
  const synced = allTracks.filter((t) => t.pushed_to_spotify !== null).length;
  const not_synced = total - synced;
  const MS_7D = 7 * 24 * 60 * 60 * 1000;
  const new_this_week = allTracks.filter(
    (t) => t.spotify_added_at && Date.now() - new Date(t.spotify_added_at).getTime() < MS_7D
  ).length;

  const pageRows = allTracks.slice((page - 1) * perPage, page * perPage);
  const logMap = await getLatestLogByTrackIds(pageRows.map((t) => t.id));

  const tracks = pageRows.map((row) => ({
    id: row.id,
    spotify_track_id: row.spotify_track_id,
    name: row.name,
    artist_name: row.artist_name ?? (row.artists?.[0] ?? null),
    album_name: row.album_name,
    spotify_added_at: row.spotify_added_at,
    genres: row.genres ?? [],
    classification_level: row.classification_level,
    confidence: logMap[row.id]?.confidence ?? null,
    pushed_to_spotify: row.pushed_to_spotify,
    is_primary: row.assigned_playlist === playlist_id,
    extra_playlists: row.extra_playlists ?? [],
  }));

  return Response.json({
    playlist: {
      id: playlist.id,
      spotify_playlist_id: playlist.spotify_playlist_id,
      name: playlist.name,
      description: playlist.description,
      color: playlist.color,
      enabled: playlist.enabled,
    },
    tracks,
    total,
    synced,
    not_synced,
    new_this_week,
    per_page: perPage,
  });
}
