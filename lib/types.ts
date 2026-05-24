import "next-auth";
import "next-auth/jwt";

export type { AudioFeatures } from "@/lib/enrichment/reccobeats";

// ── Spotify API types ──────────────────────────────────────────────────────────

export interface SpotifyArtist {
  id: string;
  name: string;
}

export interface SpotifyTrack {
  id: string;
  name: string;
  artists: SpotifyArtist[];
  album: { id: string; name: string; images: { url: string }[] };
  duration_ms: number;
  external_ids?: { isrc?: string };
}

// ── Classifier shared types ───────────────────────────────────────────────────

export interface ClassifierTrack {
  spotify_track_id: string;
  spotify_added_at: string | null;
  name?: string;
  artists?: string[];
  album_name?: string | null;
}

export type AudioFeatureRangeKey =
  | "energy"
  | "danceability"
  | "valence"
  | "tempo"
  | "acousticness";

export interface PlaylistRules {
  genres: {
    include: string[];
    exclude: string[];
  };
  audio_features: Partial<Record<AudioFeatureRangeKey, { min: number; max: number }>>;
  hard_constraints: {
    max_age_days: number | null;
    require_genre_signal: boolean;
  };
}

export interface PlaylistCentroid {
  energy: number;
  danceability: number;
  valence: number;
  acousticness: number;
  instrumentalness: number;
  sample_size: number;
}

export interface PlaylistForClassifier {
  id: string;
  spotify_playlist_id: string;
  name: string;
  description: string | null;
  rules: PlaylistRules;
  centroid: PlaylistCentroid | null;
  priority: number;
  llm_help_text: string | null;
}

export interface PlaylistDetail {
  id: string;
  name: string;
  confidence: number;
}

export interface ClassificationResult {
  playlistId: string | null;
  extraPlaylistIds: string[];
  llmSuggestion: string | null;
  playlistsDetail: PlaylistDetail[];
  confidence: number;
  level: 1 | 2 | 3;
  reason?: string;
  needsReview: boolean;
}

declare module "next-auth" {
  interface Session {
    accessToken: string;
    userId: string;
    error?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    accessToken?: string;
    refreshToken?: string;
    expiresAt?: number;
    spotifyId?: string;
    error?: string;
  }
}
