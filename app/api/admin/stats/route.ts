import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import {
  getUserBySpotifyId,
  getUserPlaylists,
  getClassifierStats,
} from "@/lib/supabase/queries";

export async function GET(): Promise<Response> {
  const session = await getServerSession(authOptions);
  if (!session?.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const dbUser = await getUserBySpotifyId(session.userId);
  if (!dbUser) return Response.json({ error: "User not found" }, { status: 404 });

  const [{ tracks, logs }, playlists] = await Promise.all([
    getClassifierStats(dbUser.id),
    getUserPlaylists(dbUser.id),
  ]);

  const playlistNameMap = new Map(playlists.map((p) => [p.id, p.name]));

  // ── Global counts ─────────────────────────────────────────────────────────
  const total_classified = tracks.length;
  const needs_review_total = tracks.filter((t) => t.needs_review).length;
  const auto_classified = total_classified - needs_review_total;

  // Manual corrections: level_used=0 AND corrected_to IS NOT NULL
  const corrections = logs.filter((l) => l.level_used === 0 && l.corrected_to !== null).length;
  const correction_rate =
    total_classified > 0 ? Math.round((corrections / total_classified) * 10000) / 10000 : 0;
  const needs_review_rate =
    total_classified > 0
      ? Math.round((needs_review_total / total_classified) * 10000) / 10000
      : 0;

  // ── By level (first initial classification per track) ─────────────────────
  const seenForLevel = new Set<string>();
  const byLevel: Record<string, number> = { "1": 0, "2": 0, "3": 0 };
  for (const log of logs) {
    if (log.level_used > 0 && !seenForLevel.has(log.track_id)) {
      seenForLevel.add(log.track_id);
      const key = String(log.level_used);
      if (key in byLevel) byLevel[key]++;
    }
  }

  // ── By playlist ──────────────────────────────────────────────────────────
  const playlistTrackCount = new Map<string, number>();
  for (const t of tracks) {
    if (t.assigned_playlist) {
      playlistTrackCount.set(
        t.assigned_playlist,
        (playlistTrackCount.get(t.assigned_playlist) ?? 0) + 1
      );
    }
  }

  // Aggregate correction counts and confidence per playlist (from suggested field)
  type PlaylistAgg = { corrections: number; confidenceSum: number; confidenceCount: number };
  const playlistAgg = new Map<string, PlaylistAgg>();

  for (const log of logs) {
    if (!log.suggested) continue;
    const agg = playlistAgg.get(log.suggested) ?? { corrections: 0, confidenceSum: 0, confidenceCount: 0 };
    if (log.corrected_to !== null && log.level_used === 0) {
      agg.corrections++;
    }
    if (log.level_used > 0) {
      agg.confidenceSum += log.confidence;
      agg.confidenceCount++;
    }
    playlistAgg.set(log.suggested, agg);
  }

  const by_playlist = playlists.map((p) => {
    const classified = playlistTrackCount.get(p.id) ?? 0;
    const agg = playlistAgg.get(p.id) ?? { corrections: 0, confidenceSum: 0, confidenceCount: 0 };
    const avg_confidence =
      agg.confidenceCount > 0
        ? Math.round((agg.confidenceSum / agg.confidenceCount) * 100) / 100
        : null;
    const cr =
      classified > 0 ? Math.round((agg.corrections / classified) * 10000) / 10000 : 0;
    return {
      playlist: playlistNameMap.get(p.id) ?? p.id,
      classified,
      corrections: agg.corrections,
      correction_rate: cr,
      avg_confidence,
    };
  });

  return Response.json({
    total_classified,
    auto_classified,
    needs_review_total,
    corrections,
    correction_rate,
    by_playlist,
    by_level: byLevel,
    needs_review_rate,
  });
}
