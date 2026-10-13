import "server-only";
import { sortTracks } from "./ai/sort";
import { ensureDivers, listBacs, placeThreshold, sortFichesFor, SURE_THRESHOLD } from "./bacs";
import type { CorpusTrack } from "./corpus";
import { check, db } from "./db";
import { enrichNext, toRow, type SavedTracksPage } from "./import";
import { kickJob, latestJob, saveProgress, startJob, type Job } from "./jobs";
import { memberAnthropicKey } from "./own-keys";
import { spotify } from "./spotify/client";
import { append } from "./spotify/playlists";

/**
 * « Ranger mes anciens likes » (décision de Walid, 13/10/2026) : l'import ne prend que les 1 000 derniers likes ;
 * les plus anciens peuvent être rangés plus tard, à la demande. Sur la clé de Sortify, le propriétaire valide
 * (coût affiché) ; le propriétaire et les membres avec leur propre clé lancent directement.
 * Les anciens titres vont dans les bacs existants si l'IA est sûre (≥ 0,6), sinon dans Divers avec l'avis gardé,
 * et sont ajoutés **en bas** des playlists. Pendant le job, `likes.backfilled_at` les tient à l'écart du tri du lundi.
 */

/** Au plus par demande (~4,50 $ d'IA). */
export const MAX_OLD_LIKES = 3000;
/** Rangement Sonnet mesuré aux bancs du 10 et du 13/10 : ~0,15 centime par titre. */
const COST_PER_TRACK = 0.0015;
const SORT_UNIT = 120;

export const oldLikesCost = (n: number) => Math.round((0.05 + n * COST_PER_TRACK) * 100) / 100;
/** Minutes d'attente : l'enrichissement domine (~240 likes par minute). */
export const oldLikesMinutes = (n: number) => Math.max(2, Math.round(n / 240 + n / 600));

export interface OldLikesProgress {
  phase: "likes" | "enrich" | "rangement" | "sync" | "done";
  /** Plus ancien like connu au lancement : tout ce qui est avant est « ancien ». */
  before: string;
  cursor: string | null;
  fetched: number;
  placed: number;
  divers: number;
  synced: number;
}

export interface OldLikesRequest {
  id: string;
  member_id: string;
  estimate: number;
  cost_usd: number;
  status: "pending" | "accepted" | "refused";
  created_at: string;
  decided_at: string | null;
}

async function countLikes(memberId: string): Promise<number> {
  const { count, error } = await db().from("likes").select("track_id", { count: "exact", head: true }).eq("member_id", memberId);
  if (error) throw new Error(`Comptage des likes : ${error.message}`);
  return count ?? 0;
}

async function oldestLike(memberId: string): Promise<string | null> {
  const rows = check(
    await db().from("likes").select("liked_at").eq("member_id", memberId).order("liked_at", { ascending: true }).limit(1),
    "Plus ancien like",
  ) as { liked_at: string }[];
  return rows[0]?.liked_at ?? null;
}

export interface OldLikesStatus {
  /** Likes Spotify pas encore dans Sortify (estimation : total Spotify − likes connus), plafonnée. */
  older: number;
  before: string | null;
  cost: number;
  minutes: number;
  /** Lance directement (propriétaire, ou clé personnelle) plutôt que de demander. */
  direct: boolean;
  request: OldLikesRequest | null;
  job: Job<OldLikesProgress> | null;
}

export async function oldLikesStatus(memberId: string, isOwner: boolean): Promise<OldLikesStatus> {
  const [spotifyPage, known, before, key, job, requests] = await Promise.all([
    spotify<{ total?: number }>(memberId, "/me/tracks?limit=1"),
    countLikes(memberId),
    oldestLike(memberId),
    memberAnthropicKey(memberId),
    latestJob<OldLikesProgress>(memberId, "anciens"),
    db().from("old_likes_requests").select("*").eq("member_id", memberId).order("created_at", { ascending: false }).limit(1),
  ]);
  if (requests.error) throw new Error(`Lecture des demandes : ${requests.error.message}`);
  const older = Math.min(MAX_OLD_LIKES, Math.max(0, (spotifyPage.total ?? 0) - known));
  return {
    older,
    before,
    cost: oldLikesCost(older),
    minutes: oldLikesMinutes(older),
    direct: isOwner || key !== null,
    request: (requests.data?.[0] as OldLikesRequest | undefined) ?? null,
    job,
  };
}

/** Lance le job « anciens » d'un membre (après validation, ou directement). */
export async function startOldLikes(memberId: string): Promise<void> {
  const before = await oldestLike(memberId);
  if (!before) throw new Error("Aucun like connu : l'import n'a pas encore eu lieu.");
  const job = await startJob<OldLikesProgress>(memberId, "anciens", {
    phase: "likes",
    before,
    cursor: null,
    fetched: 0,
    placed: 0,
    divers: 0,
    synced: 0,
  });
  await kickJob(job.id);
}

/** Demande d'un membre sur la clé de Sortify (une seule en attente à la fois). */
export async function requestOldLikes(memberId: string, estimate: number): Promise<void> {
  const open = check(
    await db().from("old_likes_requests").select("id").eq("member_id", memberId).eq("status", "pending").limit(1),
    "Lecture des demandes",
  ) as { id: string }[];
  if (open.length > 0) return;
  check(
    await db().from("old_likes_requests").insert({ member_id: memberId, estimate, cost_usd: oldLikesCost(estimate) }),
    "Enregistrement de la demande",
  );
}

/** Demandes en attente, pour l'Accueil du propriétaire. */
export async function pendingOldLikesRequests(): Promise<(OldLikesRequest & { name: string })[]> {
  const rows = check(
    await db().from("old_likes_requests").select("*, members(display_name)").eq("status", "pending").order("created_at"),
    "Lecture des demandes en attente",
  ) as (OldLikesRequest & { members: { display_name: string | null } | null })[];
  return rows.map(({ members, ...r }) => ({ ...r, name: members?.display_name ?? "Un membre" }));
}

/** Décision du propriétaire. */
export async function decideOldLikes(requestId: string, accept: boolean): Promise<void> {
  const rows = check(
    await db()
      .from("old_likes_requests")
      .update({ status: accept ? "accepted" : "refused", decided_at: new Date().toISOString() })
      .eq("id", requestId)
      .eq("status", "pending")
      .select("member_id"),
    "Décision sur la demande",
  ) as { member_id: string }[];
  if (accept && rows[0]) await startOldLikes(rows[0].member_id);
}

// ── Le job ────────────────────────────────────────────────────────────────────

export async function runOldLikesStep(job: Job<OldLikesProgress>, deadline: number): Promise<OldLikesProgress> {
  let progress = job.progress;
  do {
    progress = await unit(job.member_id, progress);
    await saveProgress(job.id, progress);
  } while (Date.now() < deadline && progress.phase !== "done");
  return progress;
}

async function unit(memberId: string, p: OldLikesProgress): Promise<OldLikesProgress> {
  switch (p.phase) {
    case "likes":
      return fetchOld(memberId, p);
    case "enrich": {
      const { count } = await enrichNext(memberId);
      return count === 0 ? { ...p, phase: "rangement" } : p;
    }
    case "rangement":
      return sortOld(memberId, p);
    case "sync":
      return syncOld(memberId, p);
    case "done":
      return p;
  }
}

async function fetchOld(memberId: string, p: OldLikesProgress): Promise<OldLikesProgress> {
  // Spotify rend les likes du plus récent au plus ancien : on saute ceux qu'on connaît déjà, moins une marge
  // (des likes retirés dans Spotify peuvent rester en base selon le réglage « Like retiré »).
  const start = p.cursor ?? `/me/tracks?limit=50&offset=${Math.max(0, (await countLikes(memberId)) - 200)}`;
  const page = await spotify<SavedTracksPage>(memberId, start);
  const now = new Date().toISOString();
  const rows = page.items
    .filter((item) => Date.parse(item.added_at) < Date.parse(p.before))
    .map((item) => toRow(memberId, item))
    .filter((r) => r !== null)
    .slice(0, MAX_OLD_LIKES - p.fetched)
    .map((r) => ({ ...r, backfilled_at: now }));
  if (rows.length > 0) check(await db().from("likes").upsert(rows, { onConflict: "member_id,track_id" }), "Enregistrement des anciens likes");
  const fetched = p.fetched + rows.length;
  if (page.next && fetched < MAX_OLD_LIKES) return { ...p, cursor: page.next, fetched };
  return { ...p, phase: "enrich", cursor: null, fetched };
}

async function backfilled(memberId: string, columns: string): Promise<{ track_id: string }[]> {
  const rows: { track_id: string }[] = [];
  for (let from = 0; ; from += 1000) {
    const page = check(
      await db()
        .from("likes")
        .select(columns)
        .eq("member_id", memberId)
        .not("backfilled_at", "is", null)
        .order("liked_at", { ascending: false })
        .range(from, from + 999),
      "Lecture des anciens likes",
    ) as unknown as { track_id: string }[];
    rows.push(...page);
    if (page.length < 1000) break;
  }
  return rows;
}

async function sortOld(memberId: string, p: OldLikesProgress): Promise<OldLikesProgress> {
  const placed = new Set<string>();
  for (let from = 0; ; from += 1000) {
    const rows = check(
      await db().from("placements").select("track_id").eq("member_id", memberId).range(from, from + 999),
      "Lecture des titres rangés",
    ) as { track_id: string }[];
    for (const r of rows) placed.add(r.track_id);
    if (rows.length < 1000) break;
  }
  const all = (await backfilled(memberId, "track_id, title, artists, released_year, genres, audio, cover_url, excluded, enriched_at")) as unknown as (CorpusTrack & {
    excluded: boolean;
    enriched_at: string | null;
  })[];
  const todo = all.filter((t) => !placed.has(t.track_id) && !t.excluded && t.enriched_at).slice(0, SORT_UNIT);
  if (todo.length === 0) return { ...p, phase: "sync" };

  const bacs = (await listBacs(memberId, ["active"])).filter((b) => b.auto_fill && !b.is_divers);
  const divers = await ensureDivers(memberId);
  const sorted = bacs.length > 0 ? await sortTracks(await sortFichesFor(bacs), todo) : todo.map((t) => ({ track_id: t.track_id, suggestions: [], reason: "" }));
  const placements: { bac_id: string; member_id: string; track_id: string; confidence: number | null; source: "ia" }[] = [];
  const hints: { member_id: string; track_id: string; suggestions: { bac_id: string; confidence: number }[]; reason: string | null }[] = [];
  let inBacs = 0;
  let toDivers = 0;
  for (const s of sorted) {
    const top = s.suggestions[0]?.confidence ?? 0;
    const sure = top >= SURE_THRESHOLD ? s.suggestions.filter((x) => x.confidence >= placeThreshold(bacs[x.bac].axis)) : [];
    if (sure.length > 0) {
      inBacs++;
      for (const x of sure) placements.push({ bac_id: bacs[x.bac].id, member_id: memberId, track_id: s.track_id, confidence: x.confidence, source: "ia" });
    } else {
      // Comme à l'onboarding : pas d'« À trier » pour les anciens likes, Divers avec l'avis de l'IA gardé.
      toDivers++;
      placements.push({ bac_id: divers.id, member_id: memberId, track_id: s.track_id, confidence: null, source: "ia" });
      if (s.suggestions.length > 0) {
        hints.push({
          member_id: memberId,
          track_id: s.track_id,
          suggestions: s.suggestions.map((x) => ({ bac_id: bacs[x.bac].id, confidence: x.confidence })),
          reason: s.reason || null,
        });
      }
    }
  }
  if (placements.length) check(await db().from("placements").upsert(placements, { onConflict: "bac_id,track_id" }), "Rangement des anciens likes");
  if (hints.length) check(await db().from("divers_hints").upsert(hints, { onConflict: "member_id,track_id" }), "Avis gardés pour Divers");
  return { ...p, placed: p.placed + inBacs, divers: p.divers + toDivers };
}

/** Anciens titres ajoutés en bas des playlists, du plus récent au plus ancien ; puis ils redeviennent des likes ordinaires. */
async function syncOld(memberId: string, p: OldLikesProgress): Promise<OldLikesProgress> {
  const bacs = [...(await listBacs(memberId, ["active"])), await ensureDivers(memberId)].filter((b) => b.spotify_playlist_id);
  let synced = 0;
  for (const bac of bacs) {
    const rows = check(
      await db()
        .from("likes")
        .select("track_id, liked_at, placements!inner(bac_id, synced_at)")
        .eq("member_id", memberId)
        .not("backfilled_at", "is", null)
        .eq("placements.bac_id", bac.id)
        .is("placements.synced_at", null)
        .order("liked_at", { ascending: false }),
      "Lecture des anciens titres à pousser",
    ) as { track_id: string }[];
    if (rows.length === 0) continue;
    const ids = rows.map((r) => r.track_id);
    await append(memberId, bac.spotify_playlist_id!, ids);
    for (let i = 0; i < ids.length; i += 200) {
      check(
        await db().from("placements").update({ synced_at: new Date().toISOString() }).eq("bac_id", bac.id).in("track_id", ids.slice(i, i + 200)),
        "Anciens titres poussés",
      );
    }
    synced += ids.length;
  }
  check(await db().from("likes").update({ backfilled_at: null }).eq("member_id", memberId).not("backfilled_at", "is", null), "Fin des anciens likes");
  return { ...p, phase: "done", synced: p.synced + synced };
}

/** Prénom affiché du propriétaire (« Demander à Walid »). */
export async function ownerName(): Promise<string> {
  const rows = check(await db().from("members").select("display_name").eq("is_owner", true).limit(1), "Lecture du propriétaire") as {
    display_name: string | null;
  }[];
  return rows[0]?.display_name?.split(" ")[0] ?? "le propriétaire";
}
