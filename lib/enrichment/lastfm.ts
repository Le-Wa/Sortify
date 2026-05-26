const BASE = "https://ws.audioscrobbler.com/2.0";

type LastFmTag = { name: string; count: number };
type LastFmTagsResponse = {
  toptags?: { tag?: LastFmTag[] };
  error?: number;
};

function topFive(tags: LastFmTag[]): string[] {
  return tags
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)
    .map((t) => t.name);
}

export async function getTrackTags(artist: string, title: string): Promise<string[]> {
  const key = process.env.LASTFM_API_KEY;
  if (!key || !artist || !title) return [];

  try {
    const url = `${BASE}/?method=track.getTopTags&artist=${encodeURIComponent(artist)}&track=${encodeURIComponent(title)}&api_key=${key}&format=json`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return [];

    const data = (await res.json()) as LastFmTagsResponse;
    if (data.error || !data.toptags?.tag) return [];

    return topFive(data.toptags.tag);
  } catch {
    return [];
  }
}

export async function getArtistTags(artist: string): Promise<string[]> {
  const key = process.env.LASTFM_API_KEY;
  if (!key || !artist) return [];

  try {
    const url = `${BASE}/?method=artist.getTopTags&artist=${encodeURIComponent(artist)}&api_key=${key}&format=json`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return [];

    const data = (await res.json()) as LastFmTagsResponse;
    if (data.error || !data.toptags?.tag) return [];

    return topFive(data.toptags.tag);
  } catch {
    return [];
  }
}
