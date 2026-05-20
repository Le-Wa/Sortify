import Anthropic from "@anthropic-ai/sdk";
import type { AudioFeatures } from "@/lib/enrichment/reccobeats";
import type { ClassifierTrack, PlaylistCentroid, PlaylistForClassifier } from "@/lib/types";

interface Level3Result {
  playlistIds: string[];
  confidence: number;
  reason: string;
  rawResponse: string;
}

function formatCentroid(c: PlaylistCentroid): string {
  const parts: string[] = [
    `energy ${c.energy.toFixed(2)}`,
    `danceability ${c.danceability.toFixed(2)}`,
    `valence ${c.valence.toFixed(2)}`,
    `acousticness ${c.acousticness.toFixed(2)}`,
  ];
  return parts.join(", ");
}

function buildPlaylistContext(playlists: PlaylistForClassifier[]): string {
  return playlists
    .filter((p) => p.description || p.centroid)
    .map((p) => {
      const base = p.description ? `${p.name} : ${p.description}` : p.name;
      const audio = p.centroid ? ` | audio moyen : ${formatCentroid(p.centroid)}` : "";
      return base + audio;
    })
    .join("\n");
}

export async function matchLevel3(
  track: ClassifierTrack,
  audioFeatures: AudioFeatures | null,
  genres: string[],
  playlists: PlaylistForClassifier[]
): Promise<Level3Result> {
  const anthropic = new Anthropic();

  const trackSummary = {
    name: track.name ?? track.spotify_track_id,
    artist: track.artists?.[0] ?? "",
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

  const playlistContext = buildPlaylistContext(playlists);

  const playlistNames = playlists.map((p) => p.name).join(", ");

  const system = [
    `You are classifying tracks for a personal music library organized around the following playlists: ${playlistNames}. Vibe and feel matter more than strict genre labels. A track can fit multiple playlists.`,
    playlistContext,
    `Respond only with the requested JSON object, nothing else. The "reason" field must be in French, one sentence.`,
  ]
    .filter(Boolean)
    .join("\n\n");

  const playlistList = playlists.map((p) => ({ id: p.id, name: p.name }));

  const userMessage = `Assign this track to the playlists that fit its vibe.

Track:
${JSON.stringify(trackSummary, null, 2)}

Available playlists:
${JSON.stringify(playlistList, null, 2)}

Reply with a single JSON object, no markdown:
{"playlists": ["<uuid>", ...], "confidence": <0.0-1.0>, "reason": "<one sentence>"}
Return an empty playlists array if none fit.`;

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 300,
    system,
    messages: [{ role: "user", content: userMessage }],
  });

  const text =
    message.content[0].type === "text" ? message.content[0].text.trim() : "";

  const parsed = JSON.parse(text) as {
    playlists: string[];
    confidence: number;
    reason: string;
  };

  const validIds = new Set(playlists.map((p) => p.id));
  const playlistIds = (parsed.playlists ?? []).filter((id) => validIds.has(id));

  return {
    playlistIds,
    confidence: Math.max(0, Math.min(1, parsed.confidence)),
    reason: parsed.reason,
    rawResponse: text,
  };
}
