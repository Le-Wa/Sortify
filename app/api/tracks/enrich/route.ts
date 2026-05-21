import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { resolveGenres } from "@/lib/enrichment";
import { getAudioFeaturesBatch } from "@/lib/spotify/fetchers";
import { refreshAccessToken } from "@/lib/spotify/token";
import { getUserBySpotifyId, updateTrackEnrichment } from "@/lib/supabase/queries";
import { createClient } from "@/lib/supabase/client";

const BATCH_SIZE = 20;

export async function POST(): Promise<Response> {
  const session = await getServerSession(authOptions);
  if (!session?.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const dbUser = await getUserBySpotifyId(session.userId);
  if (!dbUser) return Response.json({ error: "User not found" }, { status: 404 });

  const supabase = createClient();

  // Only tracks with an ISRC that haven't been enriched yet.
  // Using enriched_at IS NULL avoids re-processing tracks where ReccoBeats
  // returned nothing — once attempted, enriched_at is set regardless.
  const { data: rows, error } = await supabase
    .from("tracks")
    .select("spotify_track_id, isrc, name, artists")
    .eq("user_id", dbUser.id)
    .not("isrc", "is", null)
    .is("enriched_at", null)
    .limit(BATCH_SIZE);

  if (error) return Response.json({ error: error.message }, { status: 500 });
  if (!rows || rows.length === 0) {
    return Response.json({ enriched: 0, failed: 0, remaining: 0 });
  }

  const token = await refreshAccessToken(session.userId);

  // Batch-fetch audio features via ReccoBeats (ISRC-based)
  const tracksWithIsrc = rows.map((r) => ({
    id: r.spotify_track_id as string,
    isrc: r.isrc as string,
  }));

  let featuresMap = new Map<string, object>();
  try {
    const featuresList = await getAudioFeaturesBatch(tracksWithIsrc, token);
    featuresMap = new Map(featuresList.map((f) => [f.id, f]));
    console.log(`[enrich] ReccoBeats: ${featuresMap.size}/${rows.length} features fetched`);
  } catch (err) {
    console.warn("[enrich] ReccoBeats unavailable, genres only:", err);
  }

  let enriched = 0;
  let failed = 0;

  for (const row of rows) {
    try {
      const genres = await resolveGenres(
        row.isrc as string,
        (row.artists as string[] | null)?.[0] ?? "",
        (row.name as string) ?? ""
      );

      const freshFeatures = (featuresMap.get(row.spotify_track_id as string) ?? null) as Parameters<
        typeof updateTrackEnrichment
      >[2]["audio_features"];

      await updateTrackEnrichment(row.spotify_track_id as string, dbUser.id, {
        genres,
        audio_features: freshFeatures,
      });

      console.log(
        `[enrich] ${row.name ?? row.spotify_track_id}: genres=${genres.length} features=${freshFeatures ? "ok" : "null"}`
      );
      enriched++;
    } catch (err) {
      console.error(`[enrich] failed for ${row.spotify_track_id}:`, err);
      failed++;
    }
  }

  // Count remaining AFTER processing — accurate, stops the loop correctly
  const { count: remaining } = await supabase
    .from("tracks")
    .select("*", { count: "exact", head: true })
    .eq("user_id", dbUser.id)
    .not("isrc", "is", null)
    .is("enriched_at", null);

  console.log(`[enrich] batch done: enriched=${enriched} failed=${failed} remaining=${remaining ?? 0}`);

  return Response.json({ enriched, failed, remaining: remaining ?? 0 });
}
