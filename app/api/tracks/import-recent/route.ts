import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import {
  getUserBySpotifyId,
  upsertLikedTracks,
  getExistingTrackIds,
  updateTrackEnrichment,
  updateLastSyncAt,
} from "@/lib/supabase/queries";
import { refreshAccessToken } from "@/lib/spotify/token";
import { getLikedSinceDate, type SavedTrackItem } from "@/lib/spotify/fetchers";
import { enrichTrack } from "@/lib/enrichment";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export async function POST(): Promise<Response> {
  const session = await getServerSession(authOptions);
  if (!session?.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const dbUser = await getUserBySpotifyId(session.userId);
  if (!dbUser) return Response.json({ error: "User not found" }, { status: 404 });

  const token = await refreshAccessToken(session.userId);

  // Determine fetch window: from last_sync_at, or 7 days fallback
  const { data: userRow } = await (await import("@/lib/supabase/client"))
    .createClient()
    .from("users")
    .select("last_sync_at")
    .eq("id", dbUser.id)
    .single();

  const lastSync = (userRow as { last_sync_at: string | null } | null)?.last_sync_at;
  const since = lastSync ? new Date(lastSync) : new Date(Date.now() - SEVEN_DAYS_MS);

  const items: SavedTrackItem[] = await getLikedSinceDate(token, since);

  if (items.length === 0) {
    await updateLastSyncAt(dbUser.id);
    return Response.json({ imported: 0, already_existing: 0, errors: [] });
  }

  const incomingIds = items.map((i) => i.track.id);
  const existingIds = new Set(await getExistingTrackIds(dbUser.id, incomingIds));

  const batch = items.map((i) => ({
    user_id: dbUser.id,
    spotify_track_id: i.track.id,
    spotify_added_at: i.added_at,
    name: i.track.name,
    artists: i.track.artists.map((a) => a.name),
    artist_ids: i.track.artists.map((a) => a.id),
    isrc: i.track.external_ids?.isrc ?? null,
    artist_name: i.track.artists[0]?.name ?? null,
    album_name: i.track.album?.name ?? null,
  }));

  await upsertLikedTracks(batch);

  const newItems = items.filter((i) => !existingIds.has(i.track.id));
  const errors: string[] = [];

  // Enrich new tracks in parallel — avoids sequential timeout on batches > 5
  await Promise.allSettled(
    newItems.map(async (item) => {
      try {
        const enriched = await enrichTrack(item);
        await updateTrackEnrichment(item.track.id, dbUser.id, {
          genres: enriched.genres,
          audio_features: enriched.audioFeatures,
        });
      } catch (e) {
        errors.push(`${item.track.id}: ${String(e)}`);
      }
    })
  );

  await updateLastSyncAt(dbUser.id);

  return Response.json({
    imported: newItems.length,
    already_existing: existingIds.size,
    errors,
  });
}
