const BASE = "https://api.deezer.com";

type DeezerTrack = {
  id?: number;
  error?: unknown;
  album?: { id?: number };
};

export async function getDeezerTrackId(isrc: string | null | undefined): Promise<string | null> {
  if (!isrc) return null;
  try {
    const res = await fetch(`${BASE}/track/isrc:${isrc}`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const track = (await res.json()) as DeezerTrack;
    if (track.error || !track.id) return null;
    return String(track.id);
  } catch {
    return null;
  }
}

type DeezerAlbum = {
  error?: unknown;
  genres?: { data: { name: string }[] };
};

export async function getDeezerGenres(isrc: string | undefined): Promise<string[]> {
  if (!isrc) return [];

  try {
    // Step 1: resolve ISRC → album id
    const trackRes = await fetch(`${BASE}/track/isrc:${isrc}`);
    if (!trackRes.ok) return [];

    const track = (await trackRes.json()) as DeezerTrack;
    if (track.error || !track.album?.id) return [];

    // Step 2: fetch album → genres
    const albumRes = await fetch(`${BASE}/album/${track.album.id}`, { signal: AbortSignal.timeout(5000) });
    if (!albumRes.ok) return [];

    const album = (await albumRes.json()) as DeezerAlbum;
    if (album.error) return [];

    return album.genres?.data.map((g) => g.name) ?? [];
  } catch {
    return [];
  }
}
