import "server-only";

const URL_BASE = "https://api.reccobeats.com/v1/audio-features";
export const RECCOBEATS_BATCH = 40;

export interface AudioFeatures {
  energy: number;
  danceability: number;
  valence: number;
  acousticness: number;
  instrumentalness: number;
  tempo: number;
  /** Tonalité (0 = do … 11 = si) et mode (1 majeur, 0 mineur), pour l'ordre DJ ; absents des likes enrichis avant le 13/10/2026. */
  key?: number;
  mode?: number;
}

interface ReccoFeature extends Partial<AudioFeatures> {
  href?: string;
}

/**
 * Caractéristiques audio par identifiant Spotify (40 max par appel).
 * ReccoBeats ne connaît qu'environ la moitié des titres : les absents ne sont pas dans la Map.
 */
export async function audioFeatures(spotifyIds: string[]): Promise<Map<string, AudioFeatures>> {
  const result = new Map<string, AudioFeatures>();
  if (spotifyIds.length === 0) return result;
  if (spotifyIds.length > RECCOBEATS_BATCH) throw new Error(`ReccoBeats : ${RECCOBEATS_BATCH} titres max par appel`);

  const res = await fetch(`${URL_BASE}?ids=${spotifyIds.join(",")}`, { signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`ReccoBeats → HTTP ${res.status}`);
  const data = (await res.json()) as { content?: ReccoFeature[] };

  for (const f of data.content ?? []) {
    const id = f.href?.split("/track/")[1];
    if (
      !id ||
      f.energy == null ||
      f.danceability == null ||
      f.valence == null ||
      f.acousticness == null ||
      f.instrumentalness == null ||
      f.tempo == null
    ) {
      continue;
    }
    result.set(id, {
      energy: f.energy,
      danceability: f.danceability,
      valence: f.valence,
      acousticness: f.acousticness,
      instrumentalness: f.instrumentalness,
      tempo: Math.round(f.tempo),
      ...(f.key != null && f.key >= 0 && f.key <= 11 && (f.mode === 0 || f.mode === 1) ? { key: f.key, mode: f.mode } : {}),
    });
  }
  return result;
}
