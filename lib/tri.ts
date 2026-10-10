import "server-only";
import { sortTracks } from "./ai/sort";
import { ensureDivers, INITIAL_PLACE_THRESHOLD, listBacs, sortFichesFor } from "./bacs";
import type { CorpusTrack } from "./corpus";
import { check, db } from "./db";
import { enrichNext, toRow, type SavedTracksPage } from "./import";
import { saveProgress, type Job } from "./jobs";
import { spotify } from "./spotify/client";
import { syncMember } from "./sync";

/**
 * Au-dessus : rangé directement. Entre les deux : « À trier ». En dessous : Divers (spec 02).
 * Mesuré sur 240 titres (oct. 2026) : 74 % rangés, 15 % À trier, 10 % Divers.
 */
export const HIGH_CONFIDENCE = 0.6;
export const LOW_CONFIDENCE = 0.4;
const SORT_UNIT = 120;
const MAX_PAGES = 20; // 1 000 nouveaux likes au plus par tri

export interface TriProgress {
  phase: "likes" | "enrich" | "rangement" | "sync" | "done";
  source: "cron" | "bouton";
  /** Like le plus récent déjà connu au début du tri : tout ce qui est plus récent est nouveau. */
  since: string | null;
  cursor: string | null;
  pages: number;
  fetched: number;
  placed: number;
  pending: number;
  divers: number;
  synced: number;
}

export function initialTri(source: TriProgress["source"]): TriProgress {
  return { phase: "likes", source, since: null, cursor: null, pages: 0, fetched: 0, placed: 0, pending: 0, divers: 0, synced: 0 };
}

export async function runTriStep(job: Job<TriProgress>, deadline: number): Promise<TriProgress> {
  let progress = job.progress;
  do {
    progress = await triUnit(job.member_id, progress);
    await saveProgress(job.id, progress);
  } while (Date.now() < deadline && progress.phase !== "done");
  return progress;
}

async function triUnit(memberId: string, progress: TriProgress): Promise<TriProgress> {
  switch (progress.phase) {
    case "likes":
      return fetchNewLikes(memberId, progress);
    case "enrich": {
      const { count } = await enrichNext(memberId);
      return count === 0 ? { ...progress, phase: "rangement" } : progress;
    }
    case "rangement":
      return sortUnit(memberId, progress);
    case "sync": {
      const synced = await syncMember(memberId);
      check(
        await db().from("members").update({ last_sorted_at: new Date().toISOString() }).eq("spotify_id", memberId),
        "Date du dernier tri",
      );
      return { ...progress, phase: "done", synced };
    }
    case "done":
      return progress;
  }
}

async function fetchNewLikes(memberId: string, progress: TriProgress): Promise<TriProgress> {
  let since = progress.since;
  if (since === null) {
    const latest = check(
      await db().from("likes").select("liked_at").eq("member_id", memberId).order("liked_at", { ascending: false }).limit(1),
      "Dernier like connu",
    ) as { liked_at: string }[];
    since = latest[0]?.liked_at ?? new Date(0).toISOString();
  }
  const page = await spotify<SavedTracksPage>(memberId, progress.cursor ?? "/me/tracks?limit=50");
  const fresh = page.items.filter((item) => Date.parse(item.added_at) > Date.parse(since));
  const rows = fresh.map((item) => toRow(memberId, item)).filter((r) => r !== null);
  if (rows.length > 0) {
    check(await db().from("likes").upsert(rows, { onConflict: "member_id,track_id" }), "Enregistrement des nouveaux likes");
  }
  const pages = progress.pages + 1;
  const more = fresh.length === page.items.length && page.next && pages < MAX_PAGES;
  return {
    ...progress,
    since,
    pages,
    fetched: progress.fetched + rows.length,
    cursor: more ? page.next : null,
    phase: more ? "likes" : "enrich",
  };
}

/** Likes enrichis qui ne sont encore ni dans un bac, ni dans « À trier ». */
async function unsortedLikes(memberId: string): Promise<CorpusTrack[]> {
  const known = new Set<string>();
  for (const table of ["placements", "pending"] as const) {
    for (let from = 0; ; from += 1000) {
      const rows = check(
        await db().from(table).select("track_id").eq("member_id", memberId).range(from, from + 999),
        "Lecture des titres rangés",
      ) as { track_id: string }[];
      for (const r of rows) known.add(r.track_id);
      if (rows.length < 1000) break;
    }
  }
  const result: CorpusTrack[] = [];
  for (let from = 0; ; from += 1000) {
    const rows = check(
      await db()
        .from("likes")
        .select("track_id, title, artists, released_year, genres, audio, cover_url")
        .eq("member_id", memberId)
        .not("enriched_at", "is", null)
        .order("liked_at", { ascending: false })
        .range(from, from + 999),
      "Lecture des likes",
    ) as CorpusTrack[];
    result.push(...rows.filter((r) => !known.has(r.track_id)));
    if (rows.length < 1000) break;
  }
  return result;
}

async function sortUnit(memberId: string, progress: TriProgress): Promise<TriProgress> {
  const todo = (await unsortedLikes(memberId)).slice(0, SORT_UNIT);
  if (todo.length === 0) return { ...progress, phase: "sync" };

  const bacs = (await listBacs(memberId, ["active"])).filter((b) => b.auto_fill);
  const divers = await ensureDivers(memberId);
  const sorted = bacs.length > 0 ? await sortTracks(await sortFichesFor(bacs), todo) : todo.map((t) => ({ track_id: t.track_id, suggestions: [], reason: "" }));

  const placements: { bac_id: string; member_id: string; track_id: string; confidence: number | null; source: "ia" }[] = [];
  const pending: { member_id: string; track_id: string; suggestions: { bac_id: string; confidence: number }[]; reason: string }[] = [];
  let placed = 0;
  let toDivers = 0;
  for (const s of sorted) {
    // Titre sûr : il va aussi dans ses autres bacs plausibles (même règle qu'à la création).
    const top = s.suggestions[0]?.confidence ?? 0;
    const sure = top >= HIGH_CONFIDENCE ? s.suggestions.filter((x) => x.confidence >= INITIAL_PLACE_THRESHOLD) : [];
    if (sure.length > 0) {
      placed++;
      for (const x of sure) placements.push({ bac_id: bacs[x.bac].id, member_id: memberId, track_id: s.track_id, confidence: x.confidence, source: "ia" });
    } else if (top >= LOW_CONFIDENCE) {
      pending.push({
        member_id: memberId,
        track_id: s.track_id,
        suggestions: s.suggestions
          .filter((x) => x.confidence >= LOW_CONFIDENCE)
          .map((x) => ({ bac_id: bacs[x.bac].id, confidence: x.confidence })),
        reason: s.reason,
      });
    } else {
      toDivers++;
      placements.push({ bac_id: divers.id, member_id: memberId, track_id: s.track_id, confidence: null, source: "ia" });
    }
  }
  if (placements.length) check(await db().from("placements").upsert(placements, { onConflict: "bac_id,track_id" }), "Rangement");
  if (pending.length) check(await db().from("pending").upsert(pending, { onConflict: "member_id,track_id" }), "À trier");

  return {
    ...progress,
    placed: progress.placed + placed,
    pending: progress.pending + pending.length,
    divers: progress.divers + toDivers,
  };
}
