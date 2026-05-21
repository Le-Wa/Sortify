import type { AudioFeatures } from "@/lib/enrichment/reccobeats";
import type {
  ClassificationResult,
  ClassifierTrack,
  PlaylistForClassifier,
} from "@/lib/types";
import { matchLevel1 } from "./level1-rules";
import { matchLevel2 } from "./level2-cluster";
import { matchLevel3 } from "./level3-llm";

const MIN_ASSIGN_CONFIDENCE = 0.60;
const MIN_SUGGESTION_CONFIDENCE = 0.30;

export async function classify(
  track: ClassifierTrack,
  audioFeatures: AudioFeatures | null,
  genres: string[],
  playlists: PlaylistForClassifier[],
  { skipLlm = false }: { skipLlm?: boolean } = {}
): Promise<ClassificationResult> {
  if (playlists.length === 0) {
    return { playlistId: null, extraPlaylistIds: [], llmSuggestion: null, confidence: 0, level: 3, needsReview: true };
  }

  let llmError: string | null = null;

  if (!skipLlm) {
    try {
      const l3 = await matchLevel3(track, audioFeatures, genres, playlists);
      const tooLow = l3.confidence < MIN_ASSIGN_CONFIDENCE;
      if (tooLow) {
        return {
          playlistId: null,
          extraPlaylistIds: [],
          llmSuggestion: l3.confidence >= MIN_SUGGESTION_CONFIDENCE ? (l3.playlistIds[0] ?? null) : null,
          confidence: l3.confidence,
          level: 3,
          reason: l3.reason,
          needsReview: true,
        };
      }
      return {
        playlistId: l3.playlistIds[0] ?? null,
        extraPlaylistIds: l3.playlistIds.slice(1),
        llmSuggestion: null,
        confidence: l3.confidence,
        level: 3,
        reason: l3.reason,
        needsReview: false,
      };
    } catch (err) {
      llmError = String(err);
      console.error("[L3] LLM failed:", llmError);
    }
  }

  if (audioFeatures !== null) {
    const l2 = matchLevel2(audioFeatures, playlists);
    if (l2 && l2.confidence >= 0.75) {
      return {
        playlistId: l2.playlistId,
        extraPlaylistIds: [],
        llmSuggestion: null,
        confidence: l2.confidence,
        level: 2,
        reason: llmError ? `L3 error: ${llmError}` : undefined,
        needsReview: false,
      };
    }
  }

  const l1 = matchLevel1(track, audioFeatures, genres, playlists);
  const assigned = !!l1 && l1.confidence >= l1.threshold;
  return {
    playlistId: assigned ? l1!.playlistId : null,
    extraPlaylistIds: [],
    llmSuggestion: null,
    confidence: l1?.confidence ?? 0,
    level: 1,
    reason: llmError ? `L3 error: ${llmError}` : undefined,
    needsReview: !assigned,
  };
}
