import "server-only";
import { check, db } from "./db";
import { deezerGenres } from "./enrichment/deezer";
import { contradicts } from "./enrichment/families";
import { artistTags, trackTags } from "./enrichment/lastfm";
import { audioFeatures, RECCOBEATS_BATCH, type AudioFeatures } from "./enrichment/reccobeats";
import { saveProgress, type Job } from "./jobs";
import { spotify } from "./spotify/client";

/** Corpus de l'analyse : 2 ans de likes, ou tout l'historique s'il y en a moins que ça. */
const CORPUS_YEARS = 2;
const SMALL_LIBRARY = 300;

export interface ImportProgress {
  phase: "likes" | "enrich" | "done";
  mode: "2ans" | "tout";
  cursor: string | null;
  imported: number;
  enriched: number;
  /** Dernier titre traité, montré pendant l'attente. */
  current: { title: string; artist: string; cover: string | null; liked_at: string } | null;
}

export const initialImport: ImportProgress = {
  phase: "likes",
  mode: "2ans",
  cursor: null,
  imported: 0,
  enriched: 0,
  current: null,
};

export interface SavedTrack {
  added_at: string;
  track: {
    id: string | null;
    name: string;
    is_local?: boolean;
    artists: { name: string }[];
    album: { name: string; images: { url: string; width: number | null }[]; release_date?: string };
    external_ids?: { isrc?: string };
  } | null;
}

export interface SavedTracksPage {
  items: SavedTrack[];
  next: string | null;
  offset: number;
}

interface LikeRow {
  member_id: string;
  track_id: string;
  title: string;
  artists: string[];
  album: string | null;
  cover_url: string | null;
  isrc: string | null;
  released_year: number | null;
  liked_at: string;
}

export function toRow(memberId: string, item: SavedTrack): LikeRow | null {
  const t = item.track;
  if (!t?.id || t.is_local) return null;
  // Pochette moyenne (300 px) : assez nette pour l'écran, légère à charger.
  const images = [...t.album.images].sort((a, b) => (a.width ?? 0) - (b.width ?? 0));
  const cover = images.find((i) => (i.width ?? 0) >= 250) ?? images.at(-1);
  const year = Number(t.album.release_date?.slice(0, 4));
  return {
    member_id: memberId,
    track_id: t.id,
    title: t.name,
    artists: t.artists.map((a) => a.name),
    album: t.album.name || null,
    cover_url: cover?.url ?? null,
    isrc: t.external_ids?.isrc ?? null,
    released_year: Number.isFinite(year) && year > 0 ? year : null,
    liked_at: item.added_at,
  };
}

/** Fait avancer l'import jusqu'à la date limite. Renvoie la progression ; phase "done" = terminé. */
export async function runImportStep(job: Job<ImportProgress>, deadline: number): Promise<ImportProgress> {
  let progress = job.progress;
  // Au moins une unité de travail par passage, pour qu'un job avance toujours.
  do {
    progress = progress.phase === "likes" ? await importPage(job.member_id, progress) : await enrichBatch(job.member_id, progress);
    await saveProgress(job.id, progress);
  } while (Date.now() < deadline && progress.phase !== "done");
  return progress;
}

async function importPage(memberId: string, progress: ImportProgress): Promise<ImportProgress> {
  const page = await spotify<SavedTracksPage>(memberId, progress.cursor ?? "/me/tracks?limit=50");
  const cutoff =
    progress.mode === "2ans" ? Date.now() - CORPUS_YEARS * 365.25 * 24 * 3600 * 1000 : Number.NEGATIVE_INFINITY;

  const inRange = page.items.filter((item) => Date.parse(item.added_at) >= cutoff);
  const rows = inRange.map((item) => toRow(memberId, item)).filter((r): r is LikeRow => r !== null);
  if (rows.length > 0) {
    check(await db().from("likes").upsert(rows, { onConflict: "member_id,track_id" }), "Enregistrement des likes");
  }

  const imported = progress.imported + rows.length;
  const last = rows.at(-1);
  const current = last
    ? { title: last.title, artist: last.artists[0] ?? "", cover: last.cover_url, liked_at: last.liked_at }
    : progress.current;
  const reachedCutoff = inRange.length < page.items.length;

  if (!reachedCutoff && page.next) return { ...progress, cursor: page.next, imported, current };

  // Petite bibliothèque : on reprend là où la limite des 2 ans nous a arrêtés.
  if (progress.mode === "2ans" && reachedCutoff && imported < SMALL_LIBRARY) {
    const offset = page.offset + inRange.length;
    return { ...progress, mode: "tout", cursor: `/me/tracks?limit=50&offset=${offset}`, imported, current };
  }
  return { ...progress, phase: "enrich", cursor: null, imported, current };
}

interface PendingLike {
  track_id: string;
  title: string;
  artists: string[];
  cover_url: string | null;
  isrc: string | null;
  liked_at: string;
}

async function enrichBatch(memberId: string, progress: ImportProgress): Promise<ImportProgress> {
  const { count, last } = await enrichNext(memberId);
  if (count === 0) return { ...progress, phase: "done" };
  return {
    ...progress,
    enriched: progress.enriched + count,
    current: last
      ? { title: last.title, artist: last.artists[0] ?? "", cover: last.cover_url, liked_at: last.liked_at }
      : progress.current,
  };
}

/** Enrichit le prochain lot de likes pas encore enrichis (40 au plus). `count` = 0 quand il n'y en a plus. */
export async function enrichNext(memberId: string): Promise<{ count: number; last: PendingLike | null }> {
  const likes = check(
    await db()
      .from("likes")
      .select("track_id, title, artists, cover_url, isrc, liked_at")
      .eq("member_id", memberId)
      .is("enriched_at", null)
      .order("liked_at", { ascending: false })
      .limit(RECCOBEATS_BATCH),
    "Lecture des likes à enrichir",
  ) as PendingLike[];
  if (likes.length === 0) return { count: 0, last: null };

  const [audio, genres] = await Promise.all([
    audioFeatures(likes.map((l) => l.track_id)).catch((error: unknown) => {
      // ReccoBeats est un bonus : en cas de panne on continue sans l'énergie et l'ambiance.
      console.warn("ReccoBeats indisponible :", error instanceof Error ? error.message : error);
      return new Map<string, AudioFeatures>();
    }),
    genresFor(likes),
  ]);

  const now = new Date().toISOString();
  await Promise.all(
    likes.map(async (like) => {
      check(
        await db()
          .from("likes")
          .update({ genres: genres.get(like.track_id) ?? [], audio: audio.get(like.track_id) ?? null, enriched_at: now })
          .eq("member_id", memberId)
          .eq("track_id", like.track_id),
        "Enrichissement d'un like",
      );
    }),
  );
  return { count: likes.length, last: likes.at(-1) ?? null };
}

/**
 * Genres d'un lot : tags Last.fm de l'artiste principal (en cache, partagés entre membres),
 * ceux du titre quand l'artiste n'en a pas, puis les genres d'album Deezer en dernier recours.
 */
async function genresFor(likes: PendingLike[]): Promise<Map<string, string[]>> {
  const artists = [...new Set(likes.map((l) => l.artists[0]).filter((a): a is string => Boolean(a)))];
  // Un guillemet casserait le filtre PostgREST : ces rares artistes sont simplement redemandés.
  const lookup = artists.filter((a) => !a.includes('"'));
  const cached = check(
    await db().from("artist_tags").select("artist, tags").in("artist", lookup),
    "Lecture du cache d'artistes",
  ) as { artist: string; tags: string[] }[];
  const byArtist = new Map(cached.map((c) => [c.artist, c.tags]));

  const missing = artists.filter((a) => !byArtist.has(a));
  const fetched = await Promise.all(missing.map(async (artist) => ({ artist, tags: await artistTags(artist) })));
  const toCache = fetched.filter((f): f is { artist: string; tags: string[] } => f.tags !== null);
  for (const f of toCache) byArtist.set(f.artist, f.tags);
  if (toCache.length > 0) {
    check(
      await db()
        .from("artist_tags")
        .upsert(toCache.map((f) => ({ ...f, fetched_at: new Date().toISOString() })), { onConflict: "artist" }),
      "Mise en cache des artistes",
    );
  }

  const result = new Map<string, string[]>();
  await Promise.all(
    likes.map(async (like) => {
      const artist = like.artists[0] ?? "";
      const tags = byArtist.get(artist) ?? [];
      if (tags.length > 0) {
        // Les tags Last.fm sont ceux de l'artiste, parfois d'un homonyme (HUGEL → rappeur finlandais) :
        // si les genres Deezer de l'album les contredisent, on prend Deezer.
        const deezer = await deezerGenres(like.isrc);
        result.set(like.track_id, contradicts(tags, deezer) ? deezer : tags);
        return;
      }
      const fromTrack = artist ? ((await trackTags(artist, like.title)) ?? []) : [];
      // Repli : genres d'album Deezer quand Last.fm ne connaît ni l'artiste ni le titre.
      result.set(like.track_id, fromTrack.length > 0 ? fromTrack : await deezerGenres(like.isrc));
    }),
  );
  return result;
}
