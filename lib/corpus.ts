import "server-only";
import { check, db } from "./db";

export interface CorpusTrack {
  track_id: string;
  title: string;
  artists: string[];
  released_year: number | null;
  genres: string[];
  audio: { energy: number; danceability: number; valence: number; acousticness: number } | null;
  cover_url: string | null;
}

/** Au-delà, l'analyse travaille sur un échantillon (spec 02 : trop gros pour un appel). */
const MAX_CORPUS = 2500;

export async function loadCorpus(memberId: string): Promise<CorpusTrack[]> {
  const rows: CorpusTrack[] = [];
  // PostgREST plafonne à 1 000 lignes par requête.
  for (let from = 0; ; from += 1000) {
    const page = check(
      await db()
        .from("likes")
        .select("track_id, title, artists, released_year, genres, audio, cover_url")
        .eq("member_id", memberId)
        .order("liked_at", { ascending: false })
        .range(from, from + 999),
      "Lecture du corpus",
    ) as CorpusTrack[];
    rows.push(...page);
    if (page.length < 1000) break;
  }
  return rows;
}

/** Échantillon régulier (un titre sur n) : garde toutes les époques de likes. */
export function sampleCorpus(tracks: CorpusTrack[]): CorpusTrack[] {
  if (tracks.length <= MAX_CORPUS) return tracks;
  const step = tracks.length / MAX_CORPUS;
  return Array.from({ length: MAX_CORPUS }, (_, i) => tracks[Math.floor(i * step)]);
}

const f2 = (n: number) => n.toFixed(2).replace(/^0/, "");

/** Une ligne compacte par titre, numérotée : « 12 | Artiste — Titre | 2019 | soul, rnb | én.59 da.68 va.53 ac.15 ». */
export function trackLine(t: CorpusTrack, index: number): string {
  const parts = [`${index}`, `${t.artists.join(", ")} — ${t.title}`, t.released_year ? String(t.released_year) : "?"];
  parts.push(t.genres.length ? t.genres.join(", ") : "-");
  if (t.audio) {
    parts.push(`én${f2(t.audio.energy)} da${f2(t.audio.danceability)} va${f2(t.audio.valence)} ac${f2(t.audio.acousticness)}`);
  }
  return parts.join(" | ");
}
