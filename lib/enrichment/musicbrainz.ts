const BASE = "https://musicbrainz.org/ws/2";
const UA = "Sortify/1.0 (contact@sortify.app)";
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// Global serial queue — enforces 1 req/sec across concurrent callers
let mbQueue = Promise.resolve();
function mbFetch(url: string): Promise<Response> {
  const result = mbQueue.then(() =>
    fetch(url, { headers: { "User-Agent": UA } })
  );
  mbQueue = result.then(() => sleep(1000)).catch(() => sleep(1000));
  return result;
}

type MBRecording = {
  id: string;
  tags?: { name: string; count: number }[];
  genres?: { name: string; count: number }[];
};

export async function getMusicBrainzGenres(isrc: string | undefined): Promise<string[]> {
  if (!isrc) return [];

  try {
    // Step 1: resolve ISRC → recording MBIDs (queued, 1 req/sec globally)
    const isrcRes = await mbFetch(`${BASE}/isrc/${encodeURIComponent(isrc)}?fmt=json`);
    if (!isrcRes.ok) return [];

    const isrcData = (await isrcRes.json()) as { recordings?: { id: string }[] };
    const mbid = isrcData.recordings?.[0]?.id;
    if (!mbid) return [];

    // Step 2: fetch recording with genres + tags (queued, 1 req/sec globally)
    const recRes = await mbFetch(`${BASE}/recording/${mbid}?inc=genres+tags&fmt=json`);
    if (!recRes.ok) return [];

    const recording = (await recRes.json()) as MBRecording;
    const fromGenres = recording.genres?.map((g) => g.name) ?? [];
    const fromTags = recording.tags?.map((t) => t.name) ?? [];

    return [...new Set([...fromGenres, ...fromTags])];
  } catch {
    return [];
  }
}
