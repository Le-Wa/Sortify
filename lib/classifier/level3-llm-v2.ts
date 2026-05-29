import { getAnthropic } from "@/lib/anthropic";
import type Anthropic from "@anthropic-ai/sdk";
import type { AudioFeatures } from "@/lib/enrichment/reccobeats";
import type { ClassifierTrack, PlaylistCentroid, PlaylistForClassifier } from "@/lib/types";
import type { Level3BatchInput } from "./level3-llm";

interface Level3Result {
  playlists: { id: string; confidence: number }[];
  reason: string;
  rawResponse: string;
}

// Smaller than v1 (10) — v2 system prompt is longer (llm_help_text blocks),
// leaving less output budget for Haiku on large batches.
const BATCH_SIZE = 5;
const RETRY_DELAY_MS = 1000;

function formatCentroid(c: PlaylistCentroid): string {
  return `energy ${c.energy.toFixed(2)}, danceability ${c.danceability.toFixed(2)}, valence ${c.valence.toFixed(2)}, acousticness ${c.acousticness.toFixed(2)}`;
}

function buildPlaylistContext(playlists: PlaylistForClassifier[]): string {
  return playlists
    .map((p) => {
      const lines: string[] = [`## ${p.name} (id: ${p.id})`];
      if (p.llm_help_text) {
        lines.push(p.llm_help_text);
      } else if (p.description) {
        lines.push(p.description);
      }
      if (p.centroid && p.centroid.sample_size >= 5) {
        lines.push(`Centroïde audio moyen : ${formatCentroid(p.centroid)} (basé sur ${p.centroid.sample_size} tracks validés)`);
      }
      return lines.join("\n");
    })
    .join("\n\n");
}

function buildTrackSummary(input: Level3BatchInput) {
  const { track, audioFeatures, genres } = input;
  return {
    name: track.name ?? track.spotify_track_id,
    artist: track.artists?.[0] ?? "",
    ...(track.album_name && { album: track.album_name }),
    ...(track.spotify_added_at && { added: track.spotify_added_at.slice(0, 10) }),
    genres,
    ...(audioFeatures && {
      audio: {
        energy: audioFeatures.energy,
        danceability: audioFeatures.danceability,
        tempo: Math.round(audioFeatures.tempo),
        valence: audioFeatures.valence,
        acousticness: audioFeatures.acousticness,
      },
    }),
  };
}

class StructuralError extends Error {}

async function callBatchOnce(
  inputs: Level3BatchInput[],
  playlists: PlaylistForClassifier[],
  anthropic: Anthropic
): Promise<(Level3Result | null)[]> {
  const playlistContext = buildPlaylistContext(playlists);
  const playlistList = playlists.map((p) => ({ id: p.id, name: p.name }));

  const system: Anthropic.Messages.TextBlockParam[] = [
    {
      type: "text",
      text: [
        `Tu es un classificateur de musique pour une bibliothèque personnelle Spotify.`,
        `Règle centrale : la **vibe** prime sur les étiquettes de genre. Un track peut appartenir à plusieurs playlists si sa vibe est partagée. Tes décisions doivent refléter une écoute humaine attentive, pas une catégorisation mécanique.`,
        `Pour chaque track, utilise en priorité le llm_help_text de chaque playlist — il décrit la vibe, les cas limites, et ce qu'on exclut. Le centroïde audio est une aide secondaire.`,
        `Réponds uniquement avec le JSON demandé, sans markdown. Le champ "reason" est en français, une phrase concise.`,
        `--- PLAYLISTS DISPONIBLES ---`,
        playlistContext,
      ].join("\n\n"),
      cache_control: { type: "ephemeral" },
    },
  ];

  const tracksPayload = inputs.map((input, i) => ({
    index: i,
    ...buildTrackSummary(input),
  }));

  const userMessage = `Assigne chaque track aux playlists dont elle correspond à la vibe. Si aucune playlist ne convient, retourne un tableau vide.

Tracks (${inputs.length}, indexés 0 à ${inputs.length - 1}) :
${JSON.stringify(tracksPayload, null, 2)}

Playlists disponibles :
${JSON.stringify(playlistList, null, 2)}

Réponds avec un objet JSON unique :
{"results": [{"playlists": [{"id": "<uuid>", "confidence": <0.0-1.0>}], "reason": "<une phrase en français>"}, ...]}
Les résultats doivent être dans le même ordre que les tracks (index 0, 1, 2...).`;

  const message = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: Math.min(8192, Math.max(512, 500 * inputs.length)),
    system,
    messages: [{ role: "user", content: userMessage }],
  });

  const raw = message.content[0].type === "text" ? message.content[0].text.trim() : "";
  const text = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();

  const parsed = JSON.parse(text) as {
    results: Array<{ playlists: { id: string; confidence: number }[]; reason: string }>;
  };

  if (!Array.isArray(parsed.results) || parsed.results.length !== inputs.length) {
    throw new StructuralError(`Expected ${inputs.length} results, got ${parsed.results?.length}`);
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

async function callBatch(
  inputs: Level3BatchInput[],
  playlists: PlaylistForClassifier[],
  anthropic: Anthropic,
  depth = 0
): Promise<(Level3Result | null)[]> {
  try {
    return await callBatchOnce(inputs, playlists, anthropic);
  } catch (err) {
    if (err instanceof StructuralError && depth === 0 && inputs.length > 1) {
      // Split in half and retry each side — Haiku sometimes miscounts on long prompts
      console.warn(`[L3-v2] StructuralError on ${inputs.length} inputs, splitting in half`);
      const mid = Math.ceil(inputs.length / 2);
      const [left, right] = await Promise.all([
        callBatch(inputs.slice(0, mid), playlists, anthropic, 1),
        callBatch(inputs.slice(mid), playlists, anthropic, 1),
      ]);
      return [...left, ...right];
    }
    if (err instanceof StructuralError) {
      // Exhausted retries — return nulls (engine falls back to centroid)
      console.error(`[L3-v2] StructuralError unrecoverable for ${inputs.length} inputs`);
      return new Array(inputs.length).fill(null);
    }
    console.warn("[L3-v2] transient error, retrying once:", err);
    await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
    try {
      return await callBatchOnce(inputs, playlists, anthropic);
    } catch {
      return new Array(inputs.length).fill(null);
    }
  }
}

export async function matchLevel3BatchV2(
  inputs: Level3BatchInput[],
  playlists: PlaylistForClassifier[]
): Promise<(Level3Result | null)[]> {
  if (inputs.length === 0) return [];

  const anthropic = getAnthropic();
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
        console.error(`[L3-v2] batch starting at ${start} failed:`, err);
      }
    })
  );

  return results;
}

export async function matchLevel3V2(
  track: ClassifierTrack,
  audioFeatures: AudioFeatures | null,
  genres: string[],
  playlists: PlaylistForClassifier[]
): Promise<Level3Result> {
  const [result] = await matchLevel3BatchV2([{ track, audioFeatures, genres }], playlists);
  if (!result) throw new Error("L3-v2 batch returned null for single track");
  return result;
}
