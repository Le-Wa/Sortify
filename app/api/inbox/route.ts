import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import {
  getUserBySpotifyId,
  getInboxTracksNeedsReview,
  getLatestLogByTrackIds,
} from "@/lib/supabase/queries";
import { getDeezerTrackId } from "@/lib/enrichment/deezer";

const PER_PAGE = 20;

export async function GET(req: Request): Promise<Response> {
  const session = await getServerSession(authOptions);
  if (!session?.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const dbUser = await getUserBySpotifyId(session.userId);
  if (!dbUser) return Response.json({ error: "User not found" }, { status: 404 });

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const perPage = Math.min(50, Math.max(1, parseInt(searchParams.get("per_page") ?? String(PER_PAGE), 10)));
  const playlistId = searchParams.get("playlist_id") ?? undefined;
  const maxConfidenceParam = searchParams.get("max_confidence");
  const maxConfidence = maxConfidenceParam !== null ? parseFloat(maxConfidenceParam) : null;

  const rows = await getInboxTracksNeedsReview(dbUser.id, playlistId);
  const trackIds = rows.map((r) => r.id);
  const logMap = await getLatestLogByTrackIds(trackIds);

  type EnrichedRow = (typeof rows)[number] & {
    confidence: number | null;
    classification_reason: string | null;
  };

  let enriched: EnrichedRow[] = rows.map((row) => ({
    ...row,
    confidence: logMap[row.id]?.confidence ?? null,
    classification_reason: logMap[row.id]?.reason ?? null,
  }));

  if (maxConfidence !== null) {
    enriched = enriched.filter((r) => (r.confidence ?? 1) <= maxConfidence);
  }

  enriched.sort((a, b) => {
    if (a.confidence === null && b.confidence === null) return 0;
    if (a.confidence === null) return 1;
    if (b.confidence === null) return -1;
    return a.confidence - b.confidence;
  });

  const total = enriched.length;
  const pageRows = enriched.slice((page - 1) * perPage, page * perPage);

  const deezerIds = await Promise.all(pageRows.map((row) => getDeezerTrackId(row.isrc)));

  const tracks = pageRows.map((row, i) => ({
    id: row.id,
    spotify_track_id: row.spotify_track_id,
    name: row.name,
    artist_name: row.artist_name ?? (row.artists?.[0] ?? null),
    album_name: row.album_name,
    isrc: row.isrc,
    spotify_added_at: row.spotify_added_at,
    genres: row.genres ?? [],
    enrichment_source: row.enrichment_source,
    audio_features: row.audio_features,
    suggested_playlist: row.playlists?.name ?? null,
    suggested_playlist_spotify_id: row.playlists?.spotify_playlist_id ?? null,
    confidence: row.confidence,
    classification_reason: row.classification_reason,
    deezer_id: deezerIds[i],
  }));

  return Response.json({ tracks, total, page, per_page: perPage });
}
