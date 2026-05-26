import { describe, it, expect, vi, beforeEach } from "vitest";
import type { PlaylistForClassifier } from "@/lib/types";
import type { AudioFeatures } from "@/lib/enrichment/reccobeats";

vi.mock("../level3-llm", () => ({
  matchLevel3: vi.fn(),
  matchLevel3Batch: vi.fn(),
}));

import { classify } from "../engine";
import { matchLevel3 } from "../level3-llm";

const EMPTY_RULES = {
  genres: { include: [], exclude: [] },
  audio_features: {},
  hard_constraints: { max_age_days: null, require_genre_signal: false },
};

function makePlaylist(id: string, overrides: Partial<PlaylistForClassifier> = {}): PlaylistForClassifier {
  return {
    id,
    spotify_playlist_id: `sp-${id}`,
    name: id,
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

beforeEach(() => {
  vi.resetAllMocks();
});

describe("classify — no playlists", () => {
  it("returns needsReview when playlist list is empty", async () => {
    const result = await classify(TRACK, null, [], [], { skipLlm: true });
    expect(result.needsReview).toBe(true);
    expect(result.playlistId).toBeNull();
  });
});

describe("classify — skipLlm — L1 path", () => {
  it("assigns via L1 when genre matches above threshold", async () => {
    const pl = makePlaylist("rock-pl", {
      rules: {
        ...EMPTY_RULES,
        genres: { include: ["rock"], exclude: [] },
        audio_features: { energy: { min: 0.7, max: 1.0 }, danceability: { min: 0.6, max: 1.0 } },
      },
    });
    const result = await classify(TRACK, FEATURES, ["rock"], [pl], { skipLlm: true });
    expect(result.playlistId).toBe("rock-pl");
    expect(result.needsReview).toBe(false);
    expect(result.level).toBe(1);
  });

  it("puts in inbox when L1 confidence below threshold", async () => {
    const pl = makePlaylist("pl-1", {
      rules: {
        ...EMPTY_RULES,
        genres: { include: ["jazz", "blues", "soul", "funk"], exclude: [] },
      },
    });
    const result = await classify(TRACK, null, ["rock"], [pl], { skipLlm: true });
    expect(result.playlistId).toBeNull();
    expect(result.needsReview).toBe(true);
  });
});

describe("classify — skipLlm — L2 path", () => {
  it("assigns via L2 when centroid close enough (≥ 0.75)", async () => {
    const pl = makePlaylist("cluster-pl", {
      centroid: { energy: 0.8, danceability: 0.7, valence: 0.6, acousticness: 0.1, instrumentalness: 0, sample_size: 20 },
    });
    const result = await classify(TRACK, FEATURES, [], [pl], { skipLlm: true });
    expect(result.playlistId).toBe("cluster-pl");
    expect(result.level).toBe(2);
    expect(result.needsReview).toBe(false);
  });

  it("falls back to L1 when L2 confidence below 0.75", async () => {
    const pl = makePlaylist("pl-far", {
      centroid: { energy: 0.1, danceability: 0.1, valence: 0.1, acousticness: 0.9, instrumentalness: 0, sample_size: 20 },
    });
    const result = await classify(TRACK, FEATURES, [], [pl], { skipLlm: true });
    expect(result.level).toBe(1);
  });
});

describe("classify — L3 path", () => {
  it("assigns via L3 when confidence ≥ 0.60", async () => {
    vi.mocked(matchLevel3).mockResolvedValue({
      playlists: [{ id: "llm-pl", confidence: 0.85 }],
      reason: "good match",
      rawResponse: "",
    });
    const pl = makePlaylist("llm-pl");
    const result = await classify(TRACK, null, [], [pl]);
    expect(result.playlistId).toBe("llm-pl");
    expect(result.level).toBe(3);
    expect(result.needsReview).toBe(false);
    expect(matchLevel3).toHaveBeenCalledOnce();
  });

  it("sends to inbox with llmSuggestion when L3 confidence between 0.30 and 0.60", async () => {
    vi.mocked(matchLevel3).mockResolvedValue({
      playlists: [{ id: "maybe-pl", confidence: 0.45 }],
      reason: "uncertain",
      rawResponse: "",
    });
    const pl = makePlaylist("maybe-pl");
    const result = await classify(TRACK, null, [], [pl]);
    expect(result.playlistId).toBeNull();
    expect(result.llmSuggestion).toBe("maybe-pl");
    expect(result.needsReview).toBe(true);
  });

  it("falls back to L2 when L3 throws", async () => {
    vi.mocked(matchLevel3).mockRejectedValue(new Error("API error"));
    const pl = makePlaylist("cluster-pl", {
      centroid: { energy: 0.8, danceability: 0.7, valence: 0.6, acousticness: 0.1, instrumentalness: 0, sample_size: 20 },
    });
    const result = await classify(TRACK, FEATURES, [], [pl]);
    expect(result.level).toBe(2);
    expect(result.playlistId).toBe("cluster-pl");
  });

  it("assigns multiple playlists when several L3 results ≥ 0.60", async () => {
    vi.mocked(matchLevel3).mockResolvedValue({
      playlists: [
        { id: "pl-a", confidence: 0.90 },
        { id: "pl-b", confidence: 0.75 },
      ],
      reason: "multi-match",
      rawResponse: "",
    });
    const plA = makePlaylist("pl-a");
    const plB = makePlaylist("pl-b");
    const result = await classify(TRACK, null, [], [plA, plB]);
    expect(result.playlistId).toBe("pl-a");
    expect(result.extraPlaylistIds).toContain("pl-b");
  });
});
