import { describe, it, expect } from "vitest";
import { matchLevel1 } from "../level1-rules";
import type { PlaylistForClassifier } from "@/lib/types";
import type { AudioFeatures } from "@/lib/enrichment/reccobeats";

const EMPTY_RULES = {
  genres: { include: [], exclude: [] },
  audio_features: {},
  hard_constraints: { max_age_days: null, require_genre_signal: false },
};

function makePlaylist(overrides: Partial<PlaylistForClassifier> = {}): PlaylistForClassifier {
  return {
    id: "pl-1",
    spotify_playlist_id: "sp-1",
    name: "Test",
    description: null,
    rules: EMPTY_RULES,
    centroid: null,
    priority: 0,
    enabled: true,
    ...overrides,
  };
}

const TRACK = { spotify_track_id: "t1", spotify_added_at: null, name: "Track" };
const FEATURES: AudioFeatures = { energy: 0.8, danceability: 0.7, valence: 0.6, tempo: 130, acousticness: 0.1 };

describe("matchLevel1", () => {
  it("returns null when no playlists", () => {
    expect(matchLevel1(TRACK, FEATURES, [], [])).toBeNull();
  });

  it("matches a playlist with genre overlap", () => {
    const pl = makePlaylist({
      rules: { ...EMPTY_RULES, genres: { include: ["rock", "metal"], exclude: [] } },
    });
    const result = matchLevel1(TRACK, null, ["rock"], [pl]);
    expect(result).not.toBeNull();
    expect(result!.playlistId).toBe("pl-1");
    expect(result!.threshold).toBe(0.85);
  });

  it("returns null when track genre is excluded", () => {
    const pl = makePlaylist({
      rules: { ...EMPTY_RULES, genres: { include: ["rock"], exclude: ["pop"] } },
    });
    expect(matchLevel1(TRACK, null, ["pop"], [pl])).toBeNull();
  });

  it("skips playlist when require_genre_signal and no genre overlap", () => {
    const pl = makePlaylist({
      rules: {
        ...EMPTY_RULES,
        genres: { include: ["jazz"], exclude: [] },
        hard_constraints: { max_age_days: null, require_genre_signal: true },
      },
    });
    expect(matchLevel1(TRACK, null, ["rock"], [pl])).toBeNull();
  });

  it("skips playlist when track exceeds max_age_days", () => {
    const oldTrack = { ...TRACK, spotify_added_at: "2020-01-01T00:00:00Z" };
    const pl = makePlaylist({
      rules: {
        ...EMPTY_RULES,
        hard_constraints: { max_age_days: 30, require_genre_signal: false },
      },
    });
    expect(matchLevel1(oldTrack, null, [], [pl])).toBeNull();
  });

  it("scores features-only playlist with threshold 0.80", () => {
    const pl = makePlaylist({
      rules: {
        ...EMPTY_RULES,
        audio_features: { energy: { min: 0.7, max: 1.0 }, danceability: { min: 0.6, max: 1.0 } },
      },
    });
    const result = matchLevel1(TRACK, FEATURES, [], [pl]);
    expect(result).not.toBeNull();
    expect(result!.threshold).toBe(0.80);
    expect(result!.confidence).toBe(1.0);
  });

  it("picks playlist with higher priority on confidence tie", () => {
    const pl1 = makePlaylist({ id: "pl-low", priority: 0, rules: EMPTY_RULES });
    const pl2 = makePlaylist({ id: "pl-high", priority: 10, rules: EMPTY_RULES });
    const result = matchLevel1(TRACK, null, [], [pl1, pl2]);
    expect(result!.playlistId).toBe("pl-high");
  });

  it("combines genre + feature score with 0.5/0.5 weight", () => {
    const pl = makePlaylist({
      rules: {
        ...EMPTY_RULES,
        genres: { include: ["rock", "metal"], exclude: [] },
        audio_features: { energy: { min: 0.9, max: 1.0 } },
      },
    });
    const result = matchLevel1(TRACK, FEATURES, ["rock"], [pl]);
    expect(result).not.toBeNull();
    // genre: 1/2 = 0.5, feature: 0/1 = 0 (energy 0.8 < 0.9) → 0.5 * 0.5 + 0.5 * 0 = 0.25
    expect(result!.confidence).toBeCloseTo(0.25);
    expect(result!.threshold).toBe(0.85);
  });
});
