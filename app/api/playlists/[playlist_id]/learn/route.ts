import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import Anthropic from "@anthropic-ai/sdk";
import { getUserBySpotifyId, getPlaylistDetail } from "@/lib/supabase/queries";
import {
  getPlaylistTrackItems,
  getArtistGenresBatch,
  getAudioFeaturesBatch,
} from "@/lib/spotify/fetchers";
import { refreshAccessToken } from "@/lib/spotify/token";
import type { AudioFeatures } from "@/lib/enrichment/reccobeats";
import type { PlaylistCentroid, PlaylistRules } from "@/lib/types";

const MODEL = "claude-sonnet-4-20250514";
const SAMPLE_SIZE = 50;
const MIN_TRACKS = 5;

type Params = Promise<{ playlist_id: string }>;

const CENTROID_DIMS = ["energy", "danceability", "valence", "acousticness"] as const;
const STAT_DIMS = ["energy", "danceability", "valence", "acousticness", "tempo"] as const;

function sampleRandomly<T>(arr: T[], n: number): T[] {
  if (arr.length <= n) return arr;
  return [...arr].sort(() => Math.random() - 0.5).slice(0, n);
}

function computeCentroid(features: AudioFeatures[]): PlaylistCentroid | null {
  if (features.length === 0) return null;
  const sum = { energy: 0, danceability: 0, valence: 0, acousticness: 0 };
  for (const f of features) {
    for (const dim of CENTROID_DIMS) sum[dim] += f[dim];
  }
  const n = features.length;
  return {
    energy: sum.energy / n,
    danceability: sum.danceability / n,
    valence: sum.valence / n,
    acousticness: sum.acousticness / n,
    instrumentalness: 0,
    sample_size: n,
  };
}

function isValidRules(r: unknown): r is PlaylistRules {
  if (typeof r !== "object" || r === null) return false;
  const obj = r as Record<string, unknown>;
  const g = obj.genres as Record<string, unknown> | undefined;
  const hc = obj.hard_constraints as Record<string, unknown> | undefined;
  return (
    Array.isArray(g?.include) &&
    Array.isArray(g?.exclude) &&
    typeof hc?.require_genre_signal === "boolean" &&
    typeof obj.audio_features === "object" &&
    obj.audio_features !== null
  );
}

export async function POST(
  req: Request,
  { params }: { params: Params }
): Promise<Response> {
  const session = await getServerSession(authOptions);
  if (!session?.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const dbUser = await getUserBySpotifyId(session.userId);
  if (!dbUser) return Response.json({ error: "User not found" }, { status: 404 });

  const { playlist_id } = await params;
  const playlist = await getPlaylistDetail(playlist_id, dbUser.id);
  if (!playlist) return Response.json({ error: "Playlist not found" }, { status: 404 });

  // Optional: learn from a different Spotify playlist than the linked one
  const body = await req.json().catch(() => ({})) as { spotify_playlist_id?: string };
  const sourceSpotifyId = body.spotify_playlist_id ?? playlist.spotify_playlist_id;

  const token = await refreshAccessToken(session.userId);

  // ── 1. Fetch all tracks ───────────────────────────────────────────────────────
  const allTracks = await getPlaylistTrackItems(token, sourceSpotifyId);

  if (allTracks.length < MIN_TRACKS) {
    return Response.json(
      {
        error: `Playlist trop petite : ${allTracks.length} track(s), minimum ${MIN_TRACKS} requis.`,
      },
      { status: 422 }
    );
  }

  // ── 2. Sample ─────────────────────────────────────────────────────────────────
  const sample = sampleRandomly(allTracks, SAMPLE_SIZE);

  // ── 3. Audio features via ReccoBeats (needs ISRC) ────────────────────────────
  const tracksWithIsrc = sample.filter(
    (t): t is typeof t & { isrc: string } => t.isrc !== null
  );
  const audioFeaturesRaw = await getAudioFeaturesBatch(
    tracksWithIsrc.map((t) => ({ id: t.id, isrc: t.isrc }))
  );
  const featuresWithData: AudioFeatures[] = audioFeaturesRaw.map((f) => ({
    energy: f.energy,
    danceability: f.danceability,
    tempo: f.tempo,
    valence: f.valence,
    acousticness: f.acousticness,
  }));

  // ── 4. Artist genres ──────────────────────────────────────────────────────────
  const uniqueArtistIds = [...new Set(sample.flatMap((t) => t.artist_ids))];
  const artistGenresMap = await getArtistGenresBatch(uniqueArtistIds, token);

  const genreCounts: Record<string, number> = {};
  for (const track of sample) {
    const genres = track.artist_ids.flatMap((id) => artistGenresMap.get(id) ?? []);
    for (const genre of genres) {
      genreCounts[genre] = (genreCounts[genre] ?? 0) + 1;
    }
  }
  const topGenres = Object.entries(genreCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20);

  // ── 5. Audio stats ────────────────────────────────────────────────────────────
  const stats: Record<string, { min: number; max: number; avg: number }> = {};
  for (const dim of STAT_DIMS) {
    const vals = featuresWithData
      .map((f) => f[dim as keyof AudioFeatures])
      .filter((v): v is number => v !== undefined);
    if (vals.length === 0) continue;
    const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
    stats[dim] = {
      min: parseFloat(Math.min(...vals).toFixed(3)),
      avg: parseFloat(avg.toFixed(3)),
      max: parseFloat(Math.max(...vals).toFixed(3)),
    };
  }

  // ── 6. Centroid ───────────────────────────────────────────────────────────────
  const centroid = computeCentroid(featuresWithData);

  // ── 7. LLM ───────────────────────────────────────────────────────────────────
  const anthropic = new Anthropic();

  const userMessage = [
    `Playlist : "${playlist.name}" — ${sample.length} tracks analysés sur ${allTracks.length} au total.`,
    "",
    `Distribution des genres (top 20) :`,
    topGenres.length > 0
      ? topGenres.map(([g, c]) => `${g}: ${c}`).join("\n")
      : "(aucun genre disponible)",
    "",
    `Statistiques audio (${featuresWithData.length} tracks avec données) :`,
    Object.entries(stats).length > 0
      ? Object.entries(stats)
          .map(([k, v]) => `${k}: min=${v.min} avg=${v.avg} max=${v.max}`)
          .join("\n")
      : "(aucune donnée audio)",
    "",
    `Aperçu des tracks :`,
    sample
      .slice(0, 15)
      .map((t) => `- ${t.name} (${t.artist_names.join(", ")})`)
      .join("\n"),
    sample.length > 15 ? `... et ${sample.length - 15} autres` : "",
  ]
    .join("\n")
    .trim();

  const message = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system: `Tu es un système de configuration de classificateur musical.
Tu analyses des données de tracks Spotify pour générer des règles de classification JSON précises.

Réponds UNIQUEMENT avec un objet JSON valide (sans markdown) :
{
  "rules": {
    "genres": {
      "include": ["genre1", "genre2"],
      "exclude": []
    },
    "audio_features": {
      "energy": { "min": 0.0, "max": 1.0 }
    },
    "hard_constraints": {
      "max_age_days": null,
      "require_genre_signal": false
    }
  },
  "llm_help_text": "Description de la vibe en français, 1-2 phrases, utilisée pour l'arbitrage LLM."
}

Contraintes :
- genres.include : genres Spotify valides (minuscules), représentatifs de la playlist
- genres.exclude : genres explicitement incompatibles avec la vibe observée
- audio_features : uniquement les features avec un range significatif dans le sample
  Plages : energy/danceability/valence/acousticness = 0.0-1.0, tempo = 60-200 (BPM)
- require_genre_signal : true si les genres sont très discriminants
- llm_help_text : 1-2 phrases décrivant la vibe, le mood, les artistes typiques`,
    messages: [{ role: "user", content: userMessage }],
  });

  const raw = message.content[0].type === "text" ? message.content[0].text.trim() : "";
  const text = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(text) as Record<string, unknown>;
  } catch {
    return Response.json({ error: "LLM returned invalid JSON" }, { status: 500 });
  }

  if (!isValidRules(parsed.rules)) {
    return Response.json({ error: "LLM returned invalid rules structure" }, { status: 500 });
  }

  return Response.json({
    rules: parsed.rules as PlaylistRules,
    centroid,
    llm_help_text: typeof parsed.llm_help_text === "string" ? parsed.llm_help_text : null,
    sample_size: sample.length,
    total_tracks: allTracks.length,
  });
}
