import "server-only";
import { ensureDivers, listBacs, type Bac } from "./bacs";
import { check, db } from "./db";
import type { Job } from "./jobs";
import { removeFromPlaylist } from "./spotify/playlists";
import { syncMember } from "./sync";
import type { TriProgress } from "./tri";
import { markFor, type SleeveMark } from "./cover-shapes";
import { MAX_BACS_PER_TRACK } from "./limits";

/** Exemples gardés par bac et par polarité : assez pour guider l'IA, sans alourdir chaque rangement. */
const MAX_EXAMPLES = 20;

export interface BacChip {
  id: string;
  name: string;
  sleeve: string;
  color: string;
  mark: SleeveMark;
  is_divers: boolean;
}

export interface TrackInfo {
  track_id: string;
  title: string;
  artist: string;
  cover_url: string | null;
  isrc: string | null;
}

export interface PendingItem extends TrackInfo {
  suggestions: { bac: BacChip; confidence: number }[];
  reason: string | null;
}

export interface RecentItem extends TrackInfo {
  bacs: BacChip[];
  /** Tu as changé ses bacs (correction, ou choix dans « À trier »). */
  corrected: boolean;
}

export const chip = (b: Bac): BacChip => ({ id: b.id, name: b.name, sleeve: b.sleeve_name ?? b.name, color: b.color, mark: markFor(b), is_divers: b.is_divers });

/** Bacs actifs du membre (Divers compris, en dernier). */
export async function activeBacs(memberId: string): Promise<Bac[]> {
  const bacs = await listBacs(memberId, ["active"]);
  return [...bacs, await ensureDivers(memberId)];
}

interface LikeJoin {
  title: string;
  artists: string[];
  cover_url: string | null;
  isrc: string | null;
}

function trackInfo(trackId: string, like: LikeJoin | null): TrackInfo {
  return {
    track_id: trackId,
    title: like?.title ?? "Titre inconnu",
    artist: like?.artists[0] ?? "",
    cover_url: like?.cover_url ?? null,
    isrc: like?.isrc ?? null,
  };
}

/** File « À trier », du plus ancien au plus récent. */
export async function pendingQueue(memberId: string): Promise<PendingItem[]> {
  const [rows, bacs] = await Promise.all([
    db()
      .from("pending")
      .select("track_id, suggestions, reason, created_at, likes(title, artists, cover_url, isrc)")
      .eq("member_id", memberId)
      .order("created_at"),
    activeBacs(memberId),
  ]);
  const byId = new Map(bacs.map((b) => [b.id, b]));
  const data = check(rows, "Lecture de « À trier »") as unknown as {
    track_id: string;
    suggestions: { bac_id: string; confidence: number }[];
    reason: string | null;
    likes: LikeJoin | null;
  }[];
  return data.map((r) => ({
    ...trackInfo(r.track_id, r.likes),
    reason: r.reason,
    suggestions: r.suggestions
      .map((s) => ({ bac: byId.get(s.bac_id), confidence: s.confidence }))
      .filter((s): s is { bac: Bac; confidence: number } => s.bac !== undefined && !s.bac.is_divers)
      .map((s) => ({ bac: chip(s.bac), confidence: s.confidence })),
  }));
}

/** Dernier tri terminé (un tri en cours ne change pas le résumé de l'Accueil). */
export async function lastTri(memberId: string): Promise<Job<TriProgress> | null> {
  const data = check(
    await db()
      .from("jobs")
      .select("*")
      .eq("member_id", memberId)
      .eq("kind", "tri")
      .eq("status", "done")
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    "Lecture du dernier tri",
  );
  return (data as Job<TriProgress> | null) ?? null;
}

/** Le dernier tri lancé a échoué (et aucun tri n'a réussi depuis) : de quoi prévenir la personne sur l'Accueil. */
export async function failedTri(memberId: string): Promise<{ error: string; at: string } | null> {
  const data = check(
    await db()
      .from("jobs")
      .select("status, error, finished_at, started_at")
      .eq("member_id", memberId)
      .eq("kind", "tri")
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    "Lecture du dernier essai de tri",
  ) as { status: string; error: string | null; finished_at: string | null; started_at: string } | null;
  if (data?.status !== "failed") return null;
  return { error: data.error ?? "erreur inconnue", at: data.finished_at ?? data.started_at };
}

/** Fenêtre de l'arrivage de la semaine, sur l'Accueil. */
const WEEK_MS = 7 * 86_400_000;

/**
 * Arrivage de la semaine (Accueil) : les likes des 7 derniers jours déjà rangés, avec leurs bacs (modifiables),
 * et le nombre de likes qui attendent encore le prochain tri.
 */
export async function weekArrival(memberId: string, now = new Date()): Promise<{ items: RecentItem[]; waiting: number }> {
  const since = new Date(now.getTime() - WEEK_MS).toISOString();
  const [bacs, likesRes, pendingRes] = await Promise.all([
    activeBacs(memberId),
    db()
      .from("likes")
      .select("track_id, title, artists, cover_url, isrc, liked_at, placements(bac_id, source)")
      .eq("member_id", memberId)
      .eq("excluded", false)
      .is("unliked_at", null)
      .gte("liked_at", since)
      .order("liked_at", { ascending: false })
      .limit(200),
    db().from("pending").select("track_id").eq("member_id", memberId),
  ]);
  const byId = new Map(bacs.map((b) => [b.id, b]));
  const rows = check(likesRes, "Lecture de l'arrivage de la semaine") as unknown as (LikeJoin & {
    track_id: string;
    placements: { bac_id: string; source: string }[];
  })[];
  const pending = new Set((check(pendingRes, "Lecture de « À trier »") as { track_id: string }[]).map((p) => p.track_id));
  const items: RecentItem[] = [];
  let waiting = 0;
  for (const r of rows) {
    const placed = r.placements.map((p) => byId.get(p.bac_id)).filter((b): b is Bac => b !== undefined);
    if (placed.length === 0) {
      if (!pending.has(r.track_id)) waiting++;
      continue;
    }
    items.push({
      ...trackInfo(r.track_id, r),
      corrected: r.placements.some((p) => p.source !== "ia"),
      bacs: placed.sort((a, b) => a.position - b.position).map(chip),
    });
  }
  return { items, waiting };
}

/**
 * « Ne jamais ranger ce titre » (podcast, musique pour enfants…) : il sort de tous ses bacs et playlists,
 * de « À trier », et les tris suivants l'ignorent. Même drapeau que le retrait d'un titre de Divers dans Spotify.
 */
export async function setAside(memberId: string, trackId: string): Promise<void> {
  const bacs = new Map((await activeBacs(memberId)).map((b) => [b.id, b]));
  for (const bacId of await bacsOfTrack(memberId, trackId)) {
    check(await db().from("placements").delete().eq("bac_id", bacId).eq("track_id", trackId), "Retrait du titre");
    const playlist = bacs.get(bacId)?.spotify_playlist_id;
    if (playlist) await removeFromPlaylist(memberId, playlist, [trackId]);
  }
  check(await db().from("pending").delete().eq("member_id", memberId).eq("track_id", trackId), "Sortie de « À trier »");
  check(await db().from("likes").update({ excluded: true }).eq("member_id", memberId).eq("track_id", trackId), "Titre mis de côté");
}

/** Remet un titre mis de côté dans le circuit : il attend dans Divers qu'on le range. */
export async function bringBack(memberId: string, trackId: string): Promise<void> {
  check(await db().from("likes").update({ excluded: false }).eq("member_id", memberId).eq("track_id", trackId), "Titre remis");
  const divers = await ensureDivers(memberId);
  check(
    await db().from("placements").upsert({ bac_id: divers.id, member_id: memberId, track_id: trackId, source: "manuel" }, { onConflict: "bac_id,track_id" }),
    "Vers Divers",
  );
  await syncMember(memberId);
}

/** Titres mis de côté (toujours likés), les plus récents d'abord. */
export async function setAsideTracks(memberId: string): Promise<TrackInfo[]> {
  const rows = check(
    await db()
      .from("likes")
      .select("track_id, title, artists, cover_url, isrc")
      .eq("member_id", memberId)
      .eq("excluded", true)
      .is("unliked_at", null)
      .order("liked_at", { ascending: false })
      .limit(200),
    "Lecture des titres mis de côté",
  ) as unknown as (LikeJoin & { track_id: string })[];
  return rows.map((r) => trackInfo(r.track_id, r));
}

/** Bacs actuels d'un titre (Divers compris). */
export async function bacsOfTrack(memberId: string, trackId: string): Promise<string[]> {
  const rows = check(
    await db().from("placements").select("bac_id").eq("member_id", memberId).eq("track_id", trackId),
    "Lecture des bacs du titre",
  ) as { bac_id: string }[];
  return rows.map((r) => r.bac_id);
}

export async function addExample(memberId: string, bacId: string, trackId: string, polarity: "positive" | "negative"): Promise<void> {
  check(
    await db()
      .from("bac_examples")
      .upsert({ bac_id: bacId, member_id: memberId, track_id: trackId, polarity, added_at: new Date().toISOString() }, { onConflict: "bac_id,track_id" }),
    "Exemple pour l'IA",
  );
  const rows = check(
    await db()
      .from("bac_examples")
      .select("track_id")
      .eq("bac_id", bacId)
      .eq("polarity", polarity)
      .order("added_at", { ascending: false }),
    "Lecture des exemples",
  ) as { track_id: string }[];
  const extra = rows.slice(MAX_EXAMPLES).map((r) => r.track_id);
  if (extra.length) {
    check(await db().from("bac_examples").delete().eq("bac_id", bacId).in("track_id", extra), "Élagage des exemples");
  }
}

/**
 * Place un titre dans exactement ces bacs (vide = Divers), retire les autres, met à jour Spotify
 * et apprend : un bac choisi contre l'avis de l'IA devient un exemple, un bac retiré un contre-exemple.
 */
export async function setTrackBacs(
  memberId: string,
  trackId: string,
  wanted: string[],
  opts: { source: "ia" | "correction" | "manuel"; aiChoice: string[]; forceNegative?: boolean },
): Promise<void> {
  const bacs = await activeBacs(memberId);
  const byId = new Map(bacs.map((b) => [b.id, b]));
  const divers = bacs.find((b) => b.is_divers)!;
  const chosen = [...new Set(wanted)].filter((id) => byId.has(id) && id !== divers.id).slice(0, MAX_BACS_PER_TRACK);
  const target = chosen.length > 0 ? chosen : [divers.id];
  const current = await bacsOfTrack(memberId, trackId);

  for (const bacId of current.filter((id) => !target.includes(id))) {
    const bac = byId.get(bacId);
    check(await db().from("placements").delete().eq("bac_id", bacId).eq("track_id", trackId), "Retrait du titre");
    if (bac?.spotify_playlist_id) await removeFromPlaylist(memberId, bac.spotify_playlist_id, [trackId]);
    if (bac && !bac.is_divers && (chosen.length > 0 || opts.forceNegative)) await addExample(memberId, bacId, trackId, "negative");
  }
  const added = target.filter((id) => !current.includes(id));
  if (added.length) {
    check(
      await db()
        .from("placements")
        .insert(added.map((bac_id) => ({ bac_id, member_id: memberId, track_id: trackId, confidence: null, source: opts.source }))),
      "Rangement du titre",
    );
  }
  // Apprentissage (spec 02 §2.4) : un bac choisi contre l'avis de l'IA devient un exemple…
  for (const bacId of chosen.filter((id) => !opts.aiChoice.includes(id))) await addExample(memberId, bacId, trackId, "positive");
  // … et le bac que l'IA proposait dans « À trier », refusé au profit d'un autre, un contre-exemple.
  // (Un bac retiré par une correction est déjà traité plus haut.)
  if (chosen.length > 0) {
    for (const bacId of opts.aiChoice.filter((id) => !chosen.includes(id) && !current.includes(id))) {
      await addExample(memberId, bacId, trackId, "negative");
    }
  }

  check(await db().from("pending").delete().eq("member_id", memberId).eq("track_id", trackId), "Sortie de « À trier »");
  await syncMember(memberId);
}

/** « Tout accepter » : chaque titre en attente part dans le bac pré-coché. */
/** « Tout accepter » : chaque titre va dans son premier bac proposé ; `only` limite aux titres du filtre affiché. */
export async function acceptAllPending(memberId: string, only?: string[]): Promise<number> {
  const all = await pendingQueue(memberId);
  const queue = only ? all.filter((q) => only.includes(q.track_id)) : all;
  const divers = await ensureDivers(memberId);
  const placements = queue.map((item) => ({
    bac_id: item.suggestions[0]?.bac.id ?? divers.id,
    member_id: memberId,
    track_id: item.track_id,
    confidence: item.suggestions[0]?.confidence ?? null,
    source: "ia" as const,
  }));
  if (placements.length === 0) return 0;
  check(await db().from("placements").upsert(placements, { onConflict: "bac_id,track_id" }), "Tout accepter");
  check(
    await db()
      .from("pending")
      .delete()
      .eq("member_id", memberId)
      .in(
        "track_id",
        queue.map((q) => q.track_id),
      ),
    "Vidage de « À trier »",
  );
  await syncMember(memberId);
  return placements.length;
}

