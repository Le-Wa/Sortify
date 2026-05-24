import Anthropic from "@anthropic-ai/sdk";
import type { AudioFeatures } from "@/lib/enrichment/reccobeats";
import type { ClassifierTrack, PlaylistCentroid, PlaylistForClassifier } from "@/lib/types";

export interface PlaylistMatch {
  id: string;
  confidence: number;
}

interface Level3Result {
  playlists: PlaylistMatch[];
  reason: string;
  rawResponse: string;
}

export interface Level3BatchInput {
  track: ClassifierTrack;
  audioFeatures: AudioFeatures | null;
  genres: string[];
}

const BATCH_SIZE = 10;

function formatCentroid(c: PlaylistCentroid): string {
  return [
    `energy ${c.energy.toFixed(2)}`,
    `danceability ${c.danceability.toFixed(2)}`,
    `valence ${c.valence.toFixed(2)}`,
    `acousticness ${c.acousticness.toFixed(2)}`,
  ].join(", ");
}

function buildPlaylistContext(playlists: PlaylistForClassifier[]): string {
  return playlists
    .filter((p) => p.llm_help_text || p.description || p.centroid)
    .map((p) => {
      const vibe = p.llm_help_text ?? p.description;
      const base = vibe ? `${p.name} : ${vibe}` : p.name;
      const audio = p.centroid ? ` | audio moyen : ${formatCentroid(p.centroid)}` : "";
      return base + audio;
    })
    .join("\n");
}

function buildTrackSummary(input: Level3BatchInput) {
  const { track, audioFeatures, genres } = input;
  return {
    name: track.name ?? track.spotify_track_id,
    artist: track.artists?.[0] ?? "",
    ...(track.album_name && { album: track.album_name }),
    genres,
    ...(audioFeatures && {
      audio_features: {
        energy: audioFeatures.energy,
        danceability: audioFeatures.danceability,
        tempo: audioFeatures.tempo,
        valence: audioFeatures.valence,
        acousticness: audioFeatures.acousticness,
      },
    }),
  };
}

async function callBatch(
  inputs: Level3BatchInput[],
  playlists: PlaylistForClassifier[],
  anthropic: Anthropic
): Promise<(Level3Result | null)[]> {
  const playlistNames = playlists.map((p) => p.name).join(", ");
  const playlistContext = buildPlaylistContext(playlists);
  const playlistList = playlists.map((p) => ({ id: p.id, name: p.name }));

  const system = [
    `You are classifying tracks for a personal music library organized around the following playlists: ${playlistNames}. Vibe and feel matter more than strict genre labels. A track can fit multiple playlists.`,
    playlistContext,
    `Respond only with the requested JSON object, nothing else. Each "reason" field must be in French, one sentence.`,
  ]
    .filter(Boolean)
    .join("\n\n");

  const tracksPayload = inputs.map((input, i) => ({
    index: i,
    ...buildTrackSummary(input),
  }));

  const userMessage = `Assign each track to the playlists that fit its vibe.

Tracks (${inputs.length} total, indexed 0 to ${inputs.length - 1}):
${JSON.stringify(tracksPayload, null, 2)}

Available playlists:
${JSON.stringify(playlistList, null, 2)}

Reply with a single JSON object, no markdown:
{"results": [{"playlists": [{"id": "<uuid>", "confidence": <0.0-1.0>}], "reason": "<one sentence in French>"}, ...]}
Results must be in the same order as the input tracks (index 0, 1, 2, ...).
Each playlist gets its own confidence score. Use an empty playlists array if none fit.`;

  const message = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 300 * inputs.length,
    system,
    messages: [{ role: "user", content: userMessage }],
  });

  const raw = message.content[0].type === "text" ? message.content[0].text.trim() : "";
  const text = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();

  const parsed = JSON.parse(text) as {
    results: Array<{ playlists: { id: string; confidence: number }[]; reason: string }>;
  };

  if (!Array.isArray(parsed.results) || parsed.results.length !== inputs.length) {
    throw new Error(`Expected ${inputs.length} results, got ${parsed.results?.length}`);
  }

  const validIds = new Set(playlists.map((p) => p.id));

  return parsed.results.map((r) => {
    const matches = (r.playlists ?? [])
      .filter((p) => validIds.has(p.id))
      .map((p) => ({ id: p.id, confidence: Math.max(0, Math.min(1, p.confidence)) }))
      .sort((a, b) => b.confidence - a.confidence);

    return {
      playlists: matches,
      reason: r.reason,
      rawResponse: text,
    };
  });
}

export async function matchLevel3Batch(
  inputs: Level3BatchInput[],
  playlists: PlaylistForClassifier[]
): Promise<(Level3Result | null)[]> {
  if (inputs.length === 0) return [];

  const anthropic = new Anthropic();
  const results: (Level3Result | null)[] = new Array(inputs.length).fill(null);

  const chunks: { start: number; batch: Level3BatchInput[] }[] = [];
  for (let i = 0; i < inputs.length; i += BATCH_SIZE) {
    chunks.push({ start: i, batch: inputs.slice(i, i + BATCH_SIZE) });
  }

  await Promise.all(
    chunks.map(async ({ start, batch }) => {
      try {
        const batchResults = await callBatch(batch, playlists, anthropic);
        for (let j = 0; j < batchResults.length; j++) {
          results[start + j] = batchResults[j];
        }
      } catch (err) {
        console.error(`[L3] batch starting at ${start} failed:`, err);
        // results stay null for this batch — callers fall through to L2/L1
      }
    })
  );

  return results;
}

export async function matchLevel3(
  track: ClassifierTrack,
  audioFeatures: AudioFeatures | null,
  genres: string[],
  playlists: PlaylistForClassifier[]
): Promise<Level3Result> {
  const [result] = await matchLevel3Batch([{ track, audioFeatures, genres }], playlists);
  if (!result) throw new Error("L3 batch returned null for single track");
  return result;
}
