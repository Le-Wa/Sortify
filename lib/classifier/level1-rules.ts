import type { AudioFeatures } from "@/lib/enrichment/reccobeats";
import type {
  AudioFeatureRangeKey,
  ClassifierTrack,
  PlaylistForClassifier,
} from "@/lib/types";

const FEATURE_KEYS: AudioFeatureRangeKey[] = [
  "energy",
  "danceability",
  "valence",
  "tempo",
  "acousticness",
];

interface Level1Result {
  playlistId: string;
  confidence: number;
  /** 0.80 when playlist has no genre rules (features-only scoring), 0.85 otherwise */
  threshold: 0.80 | 0.85;
}

export function matchLevel1(
  track: ClassifierTrack,
  audioFeatures: AudioFeatures | null,
  genres: string[],
  playlists: PlaylistForClassifier[]
): Level1Result | null {
  let best: (Level1Result & { priority: number }) | null = null;

  for (const playlist of playlists) {
    const { rules } = playlist;

    // ── Hard constraint: track age ──────────────────────────────────────────
    if (rules.hard_constraints.max_age_days !== null && track.spotify_added_at) {
      const ageDays =
        (Date.now() - new Date(track.spotify_added_at).getTime()) / 86_400_000;
      if (ageDays > rules.hard_constraints.max_age_days) continue;
    }

    // ── Hard constraint: excluded genres ────────────────────────────────────
    if (genres.some((g) => rules.genres.exclude.includes(g))) continue;

    // ── Genre overlap ───────────────────────────────────────────────────────
    const include = rules.genres.include;
    const genreOverlap =
      include.length > 0
        ? genres.filter((g) => include.includes(g)).length
        : 0;

    if (rules.hard_constraints.require_genre_signal && genreOverlap === 0) continue;

    // ── Feature score ────────────────────────────────────────────────────────
    let featureRatio = 0;
    if (audioFeatures) {
      const definedKeys = FEATURE_KEYS.filter((k) => rules.audio_features[k] !== undefined);
      const matchedCount = definedKeys.filter((k) => {
        const range = rules.audio_features[k]!;
        const val = audioFeatures[k] as number;
        return val >= range.min && val <= range.max;
      }).length;
      featureRatio = definedKeys.length > 0 ? matchedCount / definedKeys.length : 0;
    }

    // ── Final score ──────────────────────────────────────────────────────────
    let confidence: number;
    let threshold: 0.80 | 0.85;

    if (include.length === 0) {
      // No genre rules: features carry full weight, accept at lower threshold
      confidence = featureRatio;
      threshold = 0.80;
    } else {
      confidence = 0.5 * (genreOverlap / include.length) + 0.5 * featureRatio;
      threshold = 0.85;
    }

    const isBetter =
      !best ||
      confidence > best.confidence ||
      (confidence === best.confidence && playlist.priority > best.priority);

    if (isBetter) {
      best = { playlistId: playlist.id, confidence, threshold, priority: playlist.priority };
    }
  }

  if (!best) return null;
  const { priority: _p, ...result } = best;
  return result;
}
