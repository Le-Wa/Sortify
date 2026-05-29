import type { AudioFeatures } from "@/lib/enrichment/reccobeats";
import type {
  ClassificationResult,
  ClassifierTrack,
  PlaylistDetail,
  PlaylistForClassifier,
} from "@/lib/types";
import { matchLevel2 } from "./level2-cluster";
import { matchLevel3BatchV2, matchLevel3V2 } from "./level3-llm-v2";
import type { Level3BatchInput } from "./level3-llm";

const MIN_ASSIGN_CONFIDENCE = 0.60;
const MIN_SUGGESTION_CONFIDENCE = 0.30;
// Lower centroid threshold than v1 (0.75) — centroid is the only fallback here
const CENTROID_FALLBACK_THRESHOLD = 0.50;

export async function classifyV2(
  track: ClassifierTrack,
  audioFeatures: AudioFeatures | null,
  genres: string[],
  playlists: PlaylistForClassifier[],
): Promise<ClassificationResult> {
  if (playlists.length === 0) {
    return { playlistId: null, extraPlaylistIds: [], llmSuggestion: null, playlistsDetail: [], confidence: 0, level: 3, needsReview: true };
  }

  try {
    const l3 = await matchLevel3V2(track, audioFeatures, genres, playlists);

    const playlistNameMap = new Map(playlists.map((p) => [p.id, p.name]));
    const detail: PlaylistDetail[] = l3.playlists.map((p) => ({
      id: p.id,
      name: playlistNameMap.get(p.id) ?? p.id,
      confidence: p.confidence,
    }));

    const assigned = l3.playlists.filter((p) => p.confidence >= MIN_ASSIGN_CONFIDENCE);
    const primary = assigned[0] ?? null;

    if (!primary) {
      const best = l3.playlists[0] ?? null;
      return {
        playlistId: null,
        extraPlaylistIds: [],
        llmSuggestion: best && best.confidence >= MIN_SUGGESTION_CONFIDENCE ? best.id : null,
        playlistsDetail: detail,
        confidence: best?.confidence ?? 0,
        level: 3,
        reason: l3.reason,
        needsReview: true,
      };
    }

    return {
      playlistId: primary.id,
      extraPlaylistIds: assigned.slice(1).map((p) => p.id),
      llmSuggestion: null,
      playlistsDetail: detail,
      confidence: primary.confidence,
      level: 3,
      reason: l3.reason,
      needsReview: false,
    };
  } catch (err) {
    console.error("[engine-v2] LLM failed, falling back to centroid:", err);
  }

  // Centroid-only fallback — no L1 rule cascade
  if (audioFeatures !== null) {
    const l2 = matchLevel2(audioFeatures, playlists);
    if (l2) {
      const auto = l2.confidence >= CENTROID_FALLBACK_THRESHOLD;
      return {
        playlistId: auto ? l2.playlistId : null,
        extraPlaylistIds: [],
        llmSuggestion: !auto && l2.confidence >= MIN_SUGGESTION_CONFIDENCE ? l2.playlistId : null,
        playlistsDetail: [],
        confidence: l2.confidence,
        level: 2,
        needsReview: !auto,
      };
    }
  }

  return {
    playlistId: null,
    extraPlaylistIds: [],
    llmSuggestion: null,
    playlistsDetail: [],
    confidence: 0,
    level: 3,
    needsReview: true,
  };
}

function applyV2Result(
  l3Result: { playlists: { id: string; confidence: number }[]; reason: string } | null,
  audioFeatures: AudioFeatures | null,
  playlists: PlaylistForClassifier[]
): ClassificationResult {
  const playlistNameMap = new Map(playlists.map((p) => [p.id, p.name]));

  if (l3Result) {
    const detail: PlaylistDetail[] = l3Result.playlists.map((p) => ({
      id: p.id,
      name: playlistNameMap.get(p.id) ?? p.id,
      confidence: p.confidence,
    }));

    const assigned = l3Result.playlists.filter((p) => p.confidence >= MIN_ASSIGN_CONFIDENCE);
    const primary = assigned[0] ?? null;

    if (!primary) {
      const best = l3Result.playlists[0] ?? null;
      return {
        playlistId: null,
        extraPlaylistIds: [],
        llmSuggestion: best && best.confidence >= MIN_SUGGESTION_CONFIDENCE ? best.id : null,
        playlistsDetail: detail,
        confidence: best?.confidence ?? 0,
        level: 3,
        reason: l3Result.reason,
        needsReview: true,
      };
    }

    return {
      playlistId: primary.id,
      extraPlaylistIds: assigned.slice(1).map((p) => p.id),
      llmSuggestion: null,
      playlistsDetail: detail,
      confidence: primary.confidence,
      level: 3,
      reason: l3Result.reason,
      needsReview: false,
    };
  }

  // Centroid-only fallback
  if (audioFeatures !== null) {
    const l2 = matchLevel2(audioFeatures, playlists);
    if (l2) {
      const auto = l2.confidence >= CENTROID_FALLBACK_THRESHOLD;
      return {
        playlistId: auto ? l2.playlistId : null,
        extraPlaylistIds: [],
        llmSuggestion: !auto && l2.confidence >= MIN_SUGGESTION_CONFIDENCE ? l2.playlistId : null,
        playlistsDetail: [],
        confidence: l2.confidence,
        level: 2,
        needsReview: !auto,
      };
    }
  }

  return {
    playlistId: null,
    extraPlaylistIds: [],
    llmSuggestion: null,
    playlistsDetail: [],
    confidence: 0,
    level: 3,
    needsReview: true,
  };
}

export async function classifyBatchV2(
  inputs: Array<Level3BatchInput>,
  playlists: PlaylistForClassifier[]
): Promise<ClassificationResult[]> {
  if (playlists.length === 0) {
    return inputs.map(() => ({
      playlistId: null,
      extraPlaylistIds: [],
      llmSuggestion: null,
      playlistsDetail: [],
      confidence: 0,
      level: 3,
      needsReview: true,
    }));
  }

  const l3Results = await matchLevel3BatchV2(inputs, playlists);

  return inputs.map((input, i) =>
    applyV2Result(l3Results[i], input.audioFeatures, playlists)
  );
}
