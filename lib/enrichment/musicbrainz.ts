const BASE = "https://musicbrainz.org/ws/2";
const UA = "Sortify/1.0 (contact@sortify.app)";
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

type MBRecording = {
  id: string;
  tags?: { name: string; count: number }[];
  genres?: { name: string; count: number }[];
};

export async function getMusicBrainzGenres(isrc: string | undefined): Promise<string[]> {
  if (!isrc) return [];

  try {
    await sleep(1000);

    // Step 1: resolve ISRC → recording MBIDs
    const isrcRes = await fetch(`${BASE}/isrc/${encodeURIComponent(isrc)}?fmt=json`, {
      headers: { "User-Agent": UA },
    });
    if (!isrcRes.ok) return [];

    const isrcData = (await isrcRes.json()) as { recordings?: { id: string }[] };
    const mbid = isrcData.recordings?.[0]?.id;
    if (!mbid) return [];

    await sleep(1000);

    // Step 2: fetch recording with genres + tags
    const recRes = await fetch(`${BASE}/recording/${mbid}?inc=genres+tags&fmt=json`, {
      headers: { "User-Agent": UA },
    });
    if (!recRes.ok) return [];

    const recording = (await recRes.json()) as MBRecording;
    const fromGenres = recording.genres?.map((g) => g.name) ?? [];
    const fromTags = recording.tags?.map((t) => t.name) ?? [];

    return [...new Set([...fromGenres, ...fromTags])];
  } catch {
    return [];
  }
}
