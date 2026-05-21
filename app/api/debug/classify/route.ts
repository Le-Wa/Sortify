import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/client";
import { getUserPlaylists } from "@/lib/supabase/queries";
import { matchLevel1 } from "@/lib/classifier/level1-rules";
import { matchLevel2 } from "@/lib/classifier/level2-cluster";
import { matchLevel3 } from "@/lib/classifier/level3-llm";
import type { AudioFeatures, ClassifierTrack, PlaylistForClassifier } from "@/lib/types";

const FEATURE_KEYS = ["energy", "danceability", "valence", "tempo", "acousticness"] as const;
const L2_DIMS = ["energy", "danceability", "valence", "acousticness"] as const;

function debugLevel1(
  track: ClassifierTrack,
  audioFeatures: AudioFeatures | null,
  genres: string[],
  playlists: PlaylistForClassifier[]
) {
  let excludedBy: string | null = null;
  let bestCandidate: { name: string; matchedRules: string[]; confidence: number; threshold: number } | null = null;

  for (const playlist of playlists) {
    const { rules } = playlist;

    if (rules.hard_constraints.max_age_days !== null && track.spotify_added_at) {
      const ageDays = (Date.now() - new Date(track.spotify_added_at).getTime()) / 86_400_000;
      if (ageDays > rules.hard_constraints.max_age_days) {
        if (!excludedBy) excludedBy = `max_age_days (${playlist.name})`;
        continue;
      }
    }

    if (genres.some((g) => rules.genres.exclude.includes(g))) {
      if (!excludedBy) excludedBy = `genre_excluded (${playlist.name})`;
      continue;
    }

    const include = rules.genres.include;
    const matchedGenres = genres.filter((g) => include.includes(g));

    if (rules.hard_constraints.require_genre_signal && matchedGenres.length === 0) {
      if (!excludedBy) excludedBy = `require_genre_signal (${playlist.name})`;
      continue;
    }

    const matchedRules: string[] = matchedGenres.map((g) => `genre:${g}`);
    let featureMatchCount = 0;
    const definedKeys = FEATURE_KEYS.filter((k) => rules.audio_features[k] !== undefined);

    if (audioFeatures && definedKeys.length > 0) {
      for (const k of definedKeys) {
        const range = rules.audio_features[k]!;
        const val = (audioFeatures as unknown as Record<string, number>)[k];
        if (val >= range.min && val <= range.max) {
          matchedRules.push(`${k}:${val.toFixed(2)} ∈ [${range.min},${range.max}]`);
          featureMatchCount++;
        }
      }
    }

    const featureRatio = definedKeys.length > 0 ? featureMatchCount / definedKeys.length : 0;
    const confidence =
      include.length === 0
        ? featureRatio
        : 0.5 * (matchedGenres.length / include.length) + 0.5 * featureRatio;
    const threshold: number = include.length === 0 ? 0.80 : 0.85;

    if (!bestCandidate || confidence > bestCandidate.confidence) {
      bestCandidate = { name: playlist.name, matchedRules, confidence, threshold };
    }
  }

  if (!bestCandidate) {
    return { matched_playlist: null, matched_rules: [], excluded_by: excludedBy ?? "no_candidates" };
  }

  const assigned = bestCandidate.confidence >= bestCandidate.threshold;
  return {
    matched_playlist: assigned ? bestCandidate.name : null,
    matched_rules: bestCandidate.matchedRules,
    excluded_by: assigned
      ? null
      : `confidence_below_threshold (${bestCandidate.confidence.toFixed(2)} < ${bestCandidate.threshold}) for ${bestCandidate.name}`,
  };
}

function debugLevel2(audioFeatures: AudioFeatures | null, playlists: PlaylistForClassifier[]) {
  if (!audioFeatures) return { distances: {}, best_match: null, score: 0 };

  const maxDist = Math.sqrt(L2_DIMS.length);
  const distances: Record<string, number> = {};
  let bestMatch: string | null = null;
  let bestScore = 0;

  for (const playlist of playlists) {
    if (!playlist.centroid || playlist.centroid.sample_size < 10) continue;
    let sumSq = 0;
    for (const dim of L2_DIMS) {
      const diff = (audioFeatures as unknown as Record<string, number>)[dim] - playlist.centroid[dim];
      sumSq += diff * diff;
    }
    const score = parseFloat(Math.max(0, 1 - Math.sqrt(sumSq) / maxDist).toFixed(3));
    distances[playlist.name] = score;
    if (score > bestScore) {
      bestScore = score;
      bestMatch = playlist.name;
    }
  }

  return { distances, best_match: bestMatch, score: bestScore };
}

export async function GET(req: NextRequest) {
  const trackId = req.nextUrl.searchParams.get("track_id");
  if (!trackId) return NextResponse.json({ error: "Missing track_id" }, { status: 400 });

  const supabase = createClient();
  const { data: row, error } = await supabase
    .from("tracks")
    .select("spotify_track_id, name, artists, genres, audio_features, spotify_added_at, user_id")
    .eq("spotify_track_id", trackId)
    .limit(1)
    .single();

  if (error || !row) return NextResponse.json({ error: "Track not found" }, { status: 404 });

  const playlists = await getUserPlaylists(row.user_id as string);
  if (playlists.length === 0) {
    return NextResponse.json({ error: "No playlists configured for this user" }, { status: 400 });
  }

  const track: ClassifierTrack = {
    spotify_track_id: row.spotify_track_id as string,
    spotify_added_at: (row.spotify_added_at as string | null) ?? null,
    name: (row.name as string | null) ?? undefined,
    artists: (row.artists as string[] | null) ?? undefined,
  };
  const audioFeatures = (row.audio_features as AudioFeatures | null) ?? null;
  const genres = (row.genres as string[] | null) ?? [];

  // L1 — deterministic, no LLM
  const l1 = debugLevel1(track, audioFeatures, genres, playlists);

  // L2 — deterministic, centroid distances
  const l2 = debugLevel2(audioFeatures, playlists);

  // L3 — LLM call (costs tokens)
  let l3: { suggested: string | null; confidence: number; reason: string; raw_response: string };
  try {
    const result = await matchLevel3(track, audioFeatures, genres, playlists);
    const best = result.playlists[0] ?? null;
    const playlist = playlists.find((p) => p.id === best?.id);
    l3 = {
      suggested: playlist?.name ?? null,
      confidence: best?.confidence ?? 0,
      reason: result.reason,
      raw_response: result.rawResponse,
    };
  } catch (e) {
    l3 = { suggested: null, confidence: 0, reason: String(e), raw_response: "" };
  }

  // Derive final result using same logic as classify() engine — avoids double LLM call
  const MIN_CONFIDENCE = 0.60;
  let finalPlaylist: string | null = null;
  let finalConfidence = 0;
  let finalNeedsReview = true;
  let finalLevel: 1 | 2 | 3 = 1;

  if (l3.confidence >= MIN_CONFIDENCE && l3.suggested !== null) {
    finalPlaylist = l3.suggested;
    finalConfidence = l3.confidence;
    finalNeedsReview = false;
    finalLevel = 3;
  } else {
    const l2Raw = audioFeatures ? matchLevel2(audioFeatures, playlists) : null;
    if (l2Raw && l2Raw.confidence >= 0.75) {
      finalPlaylist = playlists.find((p) => p.id === l2Raw.playlistId)?.name ?? null;
      finalConfidence = l2Raw.confidence;
      finalNeedsReview = false;
      finalLevel = 2;
    } else {
      const l1Raw = matchLevel1(track, audioFeatures, genres, playlists);
      const assigned = !!l1Raw && l1Raw.confidence >= l1Raw.threshold;
      finalPlaylist = assigned ? (playlists.find((p) => p.id === l1Raw!.playlistId)?.name ?? null) : null;
      finalConfidence = l1Raw?.confidence ?? 0;
      finalNeedsReview = !assigned;
      finalLevel = 1;
    }
  }

  return NextResponse.json({
    track: {
      name: row.name,
      artist: (row.artists as string[] | null)?.[0] ?? "",
      genres,
      audio_features: audioFeatures,
    },
    level1: l1,
    level2: l2,
    level3: l3,
    final: {
      assigned_playlist: finalPlaylist,
      confidence: finalConfidence,
      needs_review: finalNeedsReview,
      level_used: finalLevel,
    },
  });
}
