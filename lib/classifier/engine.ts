import type { AudioFeatures } from "@/lib/enrichment/reccobeats";
import type {
  ClassificationResult,
  ClassifierTrack,
  PlaylistDetail,
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
    return { playlistId: null, extraPlaylistIds: [], llmSuggestion: null, playlistsDetail: [], confidence: 0, level: 3, needsReview: true };
  }

  let llmError: string | null = null;

  if (!skipLlm) {
    try {
      const l3 = await matchLevel3(track, audioFeatures, genres, playlists);

      // Each playlist has its own confidence — filter independently
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
        playlistsDetail: [],
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
    playlistsDetail: [],
    confidence: l1?.confidence ?? 0,
    level: 1,
    reason: llmError ? `L3 error: ${llmError}` : undefined,
    needsReview: !assigned,
  };
}
