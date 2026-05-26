import { describe, it, expect } from "vitest";
import { matchLevel2 } from "../level2-cluster";
import type { PlaylistForClassifier } from "@/lib/types";
import type { AudioFeatures } from "@/lib/enrichment/reccobeats";

const EMPTY_RULES = {
  genres: { include: [], exclude: [] },
  audio_features: {},
  hard_constraints: { max_age_days: null, require_genre_signal: false },
};

function makePlaylist(id: string, centroid: PlaylistForClassifier["centroid"]): PlaylistForClassifier {
  return {
    id,
    spotify_playlist_id: `sp-${id}`,
    name: id,
    description: null,
    rules: EMPTY_RULES,
    centroid,
    priority: 0,
    enabled: true,
  };
}

const FEATURES: AudioFeatures = { energy: 0.8, danceability: 0.7, valence: 0.6, tempo: 130, acousticness: 0.1 };

describe("matchLevel2", () => {
  it("returns null when no playlists", () => {
    expect(matchLevel2(FEATURES, [])).toBeNull();
  });

  it("skips playlists with no centroid", () => {
    const pl = makePlaylist("pl-1", null);
    expect(matchLevel2(FEATURES, [pl])).toBeNull();
  });

  it("skips playlists with centroid sample_size < 10", () => {
    const pl = makePlaylist("pl-1", { energy: 0.8, danceability: 0.7, valence: 0.6, acousticness: 0.1, instrumentalness: 0, sample_size: 5 });
    expect(matchLevel2(FEATURES, [pl])).toBeNull();
  });

  it("returns perfect confidence (1.0) when features match centroid exactly", () => {
    const pl = makePlaylist("pl-exact", {
      energy: 0.8, danceability: 0.7, valence: 0.6, acousticness: 0.1,
      instrumentalness: 0, sample_size: 20,
    });
    const result = matchLevel2(FEATURES, [pl]);
    expect(result).not.toBeNull();
    expect(result!.confidence).toBeCloseTo(1.0);
    expect(result!.playlistId).toBe("pl-exact");
  });

  it("returns lower confidence when features are far from centroid", () => {
    const pl = makePlaylist("pl-far", {
      energy: 0.0, danceability: 0.0, valence: 0.0, acousticness: 1.0,
      instrumentalness: 0, sample_size: 20,
    });
    const result = matchLevel2(FEATURES, [pl]);
    expect(result).not.toBeNull();
    expect(result!.confidence).toBeLessThan(0.5);
  });

  it("picks the closest centroid across multiple playlists", () => {
    const plNear = makePlaylist("pl-near", {
      energy: 0.8, danceability: 0.7, valence: 0.6, acousticness: 0.1,
      instrumentalness: 0, sample_size: 15,
    });
    const plFar = makePlaylist("pl-far", {
      energy: 0.1, danceability: 0.1, valence: 0.1, acousticness: 0.9,
      instrumentalness: 0, sample_size: 15,
    });
    const result = matchLevel2(FEATURES, [plFar, plNear]);
    expect(result!.playlistId).toBe("pl-near");
  });

  it("clamps confidence to 0 minimum", () => {
    const pl = makePlaylist("pl-max-dist", {
      energy: 1.0, danceability: 1.0, valence: 1.0, acousticness: 1.0,
      instrumentalness: 0, sample_size: 10,
    });
    const features: AudioFeatures = { energy: 0.0, danceability: 0.0, valence: 0.0, tempo: 60, acousticness: 0.0 };
    const result = matchLevel2(features, [pl]);
    expect(result!.confidence).toBeGreaterThanOrEqual(0);
  });
});
