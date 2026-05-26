const BASE = "https://api.reccobeats.com/v1";

export interface AudioFeatures {
  energy: number;
  danceability: number;
  tempo: number;
  valence: number;
  acousticness: number;
}

type ReccoFeature = {
  energy?: number;
  danceability?: number;
  tempo?: number;
  valence?: number;
  acousticness?: number;
};

export async function getAudioFeatures(isrc: string | undefined): Promise<AudioFeatures | null> {
  if (!isrc) return null;

  try {
    const res = await fetch(`${BASE}/audio-features?ids=${encodeURIComponent(isrc)}`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;

    const data = (await res.json()) as { content?: ReccoFeature[] };
    const f = data.content?.[0];

    if (
      f?.energy == null ||
      f?.danceability == null ||
      f?.tempo == null ||
      f?.valence == null ||
      f?.acousticness == null
    ) {
      return null;
    }

    return {
      energy: f.energy,
      danceability: f.danceability,
      tempo: f.tempo,
      valence: f.valence,
      acousticness: f.acousticness,
    };
  } catch {
    return null;
  }
}
