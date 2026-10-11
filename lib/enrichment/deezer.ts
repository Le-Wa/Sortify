import "server-only";

/** Deezer limite à 50 requêtes par 5 s : on espace les appels, même lancés en parallèle. */
const MIN_INTERVAL_MS = 120;
let nextSlot = 0;
async function throttle(): Promise<void> {
  const now = Date.now();
  const slot = Math.max(now, nextSlot);
  nextSlot = slot + MIN_INTERVAL_MS;
  if (slot > now) await new Promise<void>((r) => setTimeout(r, slot - now));
}

async function get<T>(url: string): Promise<T | null> {
  await throttle();
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const data = (await res.json()) as T & { error?: unknown };
    return data.error ? null : data;
  } catch (error) {
    console.warn("Deezer injoignable :", error instanceof Error ? error.message : error);
    return null;
  }
}

const albumCache = new Map<number, string[]>();

/**
 * Genres de l'album d'un titre (via son ISRC), préfixés « deezer: » : plus grossiers que les tags Last.fm,
 * ils servent de repli pour les titres que Last.fm ne connaît pas (artistes émergents surtout).
 * Banc d'essai du 10/10/2026 : 90 % de couverture sur ces titres.
 */
export async function deezerGenres(isrc: string | null): Promise<string[]> {
  if (!isrc) return [];
  const track = await get<{ album?: { id?: number } }>(`https://api.deezer.com/track/isrc:${encodeURIComponent(isrc)}`);
  const albumId = track?.album?.id;
  if (!albumId) return [];
  const cached = albumCache.get(albumId);
  if (cached) return cached;
  const album = await get<{ genres?: { data: { name: string }[] } }>(`https://api.deezer.com/album/${albumId}`);
  const genres = (album?.genres?.data ?? [])
    .map((g) => g.name.trim().toLowerCase())
    .filter((g) => g.length <= 40 && /^[\p{L}\p{N} &'’./+-]+$/u.test(g))
    .map((g) => `deezer:${g}`);
  albumCache.set(albumId, genres);
  return genres;
}
