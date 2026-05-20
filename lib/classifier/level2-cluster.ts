import type { AudioFeatures } from "@/lib/enrichment/reccobeats";
import type { PlaylistForClassifier } from "@/lib/types";

const DIMS = [
  "energy",
  "danceability",
  "valence",
  "acousticness",
] as const;

// Maximum possible Euclidean distance when all 4 dims are in [0, 1]
const MAX_DIST = Math.sqrt(DIMS.length);

export function matchLevel2(
  audioFeatures: AudioFeatures,
  playlists: PlaylistForClassifier[]
): { playlistId: string; confidence: number } | null {
  let best: { playlistId: string; confidence: number } | null = null;

  for (const playlist of playlists) {
    if (!playlist.centroid || playlist.centroid.sample_size < 10) continue;

    let sumSq = 0;
    for (const dim of DIMS) {
      const diff = (audioFeatures[dim] as number) - playlist.centroid[dim];
      sumSq += diff * diff;
    }

    const confidence = Math.max(0, 1 - Math.sqrt(sumSq) / MAX_DIST);

    if (!best || confidence > best.confidence) {
      best = { playlistId: playlist.id, confidence };
    }
  }

  return best;
}
