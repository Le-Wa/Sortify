import "server-only";
import { env } from "@/lib/env";

const BASE = "https://ws.audioscrobbler.com/2.0/";
const MIN_INTERVAL_MS = 210; // Last.fm demande moins de 5 requêtes par seconde.
const MAX_TAGS = 6;
const MIN_COUNT = 10; // poids relatif Last.fm (0–100) : en dessous, c'est du bruit.

const NOISE = new Set([
  "seen live",
  "favorites",
  "favourites",
  "favorite",
  "favourite",
  "albums i own",
  "under 2000 listeners",
  "spotify",
  "love",
  "awesome",
  "beautiful",
  "cool",
  "good",
  "my",
  "check out",
]);

let nextSlot = 0;
/** Espace les appels à Last.fm, même lancés en parallèle. */
async function throttle(): Promise<void> {
  const now = Date.now();
  const slot = Math.max(now, nextSlot);
  nextSlot = slot + MIN_INTERVAL_MS;
  if (slot > now) await new Promise<void>((r) => setTimeout(r, slot - now));
}

interface TagsResponse {
  toptags?: { tag?: { name: string; count: number }[] };
  error?: number;
  message?: string;
}

/**
 * Tags Last.fm nettoyés. Renvoie null si Last.fm n'a pas pu répondre (à réessayer plus tard),
 * [] s'il a répondu sans tag utile.
 */
async function topTags(params: Record<string, string>, exclude: string): Promise<string[] | null> {
  const key = env.lastfmKey;
  if (!key) return null;
  const url = `${BASE}?${new URLSearchParams({ ...params, api_key: key, format: "json", autocorrect: "1" })}`;

  for (let attempt = 0; attempt < 3; attempt++) {
    await throttle();
    let res: Response;
    try {
      res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    } catch (error) {
      console.warn(`Last.fm injoignable (${params.method}) :`, error instanceof Error ? error.message : error);
      continue;
    }
    const data = (await res.json().catch(() => ({ error: -1, message: "réponse illisible" }))) as TagsResponse;
    // 6 : artiste ou titre inconnu → pas de tags, ce n'est pas une panne.
    if (data.error === 6) return [];
    // 29 : limite de débit dépassée ; 8/11/16 : erreurs temporaires.
    if (data.error === 29 || data.error === 8 || data.error === 11 || data.error === 16 || res.status >= 500) {
      await new Promise<void>((r) => setTimeout(r, 2000 * (attempt + 1)));
      continue;
    }
    if (data.error) {
      console.warn(`Last.fm erreur ${data.error} (${params.method}) : ${data.message ?? ""}`);
      return null;
    }
    const lower = exclude.toLowerCase();
    return (data.toptags?.tag ?? [])
      .filter((t) => t.count >= MIN_COUNT)
      .map((t) => t.name.trim().toLowerCase())
      // Tags Last.fm = texte libre d'inconnus (et partagé entre membres via le cache) : courts et sans caractères spéciaux.
      .filter((t) => t && t.length <= 40 && /^[\p{L}\p{N} &'’./+-]+$/u.test(t) && t !== lower && !NOISE.has(t))
      .filter((t, i, all) => all.indexOf(t) === i)
      .slice(0, MAX_TAGS);
  }
  return null;
}

export function artistTags(artist: string): Promise<string[] | null> {
  return topTags({ method: "artist.getTopTags", artist }, artist);
}

export function trackTags(artist: string, title: string): Promise<string[] | null> {
  return topTags({ method: "track.getTopTags", artist, track: title }, artist);
}
