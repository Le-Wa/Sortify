import "server-only";
import type { Fiche } from "./ai/fiches";
import { fillBac } from "./ai/sort";
import { nextColor } from "./bac-colors";
import { ensureDivers, getBac, INITIAL_PLACE_THRESHOLD, listBacs, setExamples, sortFichesFor, type Bac } from "./bacs";
import { loadCorpus } from "./corpus";
import { createPlaylist, uploadCover } from "./creation";
import { bacsOfTrack, setTrackBacs, type TrackInfo } from "./daily";
import { check, db } from "./db";
import { removeFromPlaylist } from "./spotify/playlists";
import { syncMember } from "./sync";

const WEEK_MS = 7 * 24 * 3600 * 1000;
/** Les filtres `in` partent dans l'URL : on découpe les longues listes d'identifiants. */
const IN_CHUNK = 150;

async function inChunks<T>(ids: string[], query: (chunk: string[]) => Promise<T[]>): Promise<T[]> {
  const out: T[] = [];
  for (let i = 0; i < ids.length; i += IN_CHUNK) out.push(...(await query(ids.slice(i, i + IN_CHUNK))));
  return out;
}

export interface BacStats {
  total: number;
  week: number;
}

/** Nombre de titres et ajouts des 7 derniers jours, par bac. */
export async function bacStats(bacIds: string[]): Promise<Map<string, BacStats>> {
  const since = new Date(Date.now() - WEEK_MS).toISOString();
  const stats = new Map<string, BacStats>();
  await Promise.all(
    bacIds.map(async (id) => {
      const [total, week] = await Promise.all([
        db().from("placements").select("track_id", { count: "exact", head: true }).eq("bac_id", id),
        // « Cette semaine » = titres likés ces 7 derniers jours (pas la date de rangement : la création initiale range tout d'un coup).
        db()
          .from("placements")
          .select("track_id, likes!inner(liked_at)", { count: "exact", head: true })
          .eq("bac_id", id)
          .gte("likes.liked_at", since),
      ]);
      if (total.error || week.error) throw new Error(`Statistiques du bac : ${(total.error ?? week.error)!.message}`);
      stats.set(id, { total: total.count ?? 0, week: week.count ?? 0 });
    }),
  );
  return stats;
}

async function ownedActive(memberId: string, id: string): Promise<Bac> {
  const bac = await getBac(memberId, id);
  if (!bac || bac.status !== "active") throw new Error("Ce bac n'existe plus.");
  return bac;
}

/** ↑↓ : échange la position du bac avec son voisin (c'est aussi l'ordre de la rangée de l'Accueil). */
export async function moveBac(memberId: string, id: string, direction: -1 | 1): Promise<void> {
  const bacs = await listBacs(memberId, ["active"]);
  const i = bacs.findIndex((b) => b.id === id);
  const j = i + direction;
  if (i < 0 || j < 0 || j >= bacs.length) return;
  const order = [...bacs];
  [order[i], order[j]] = [order[j], order[i]];
  await Promise.all(
    order.map(async (b, position) => {
      if (b.position !== position) check(await db().from("bacs").update({ position }).eq("id", b.id), "Ordre des bacs");
    }),
  );
}

export async function updateBac(memberId: string, id: string, patch: Partial<Pick<Bac, "brief" | "pitch" | "auto_fill">>): Promise<void> {
  const bac = await ownedActive(memberId, id);
  check(await db().from("bacs").update(patch).eq("id", bac.id), "Mise à jour du bac");
}

export interface BacTrack extends TrackInfo {
  placed_at: string;
  source: string;
  isExample: boolean;
}

/** Titres d'un bac, arrivés récemment d'abord. */
export async function bacTracks(memberId: string, bacId: string, limit: number): Promise<BacTrack[]> {
  const [rows, examples] = await Promise.all([
    db()
      .from("placements")
      .select("track_id, placed_at, source, likes(title, artists, cover_url, isrc)")
      .eq("member_id", memberId)
      .eq("bac_id", bacId)
      .order("placed_at", { ascending: false })
      .limit(limit),
    db().from("bac_examples").select("track_id").eq("bac_id", bacId).eq("polarity", "positive"),
  ]);
  const ex = new Set((check(examples, "Lecture des exemples") as { track_id: string }[]).map((e) => e.track_id));
  return (
    check(rows, "Lecture des titres du bac") as unknown as {
      track_id: string;
      placed_at: string;
      source: string;
      likes: { title: string; artists: string[]; cover_url: string | null; isrc: string | null } | null;
    }[]
  ).map((r) => ({
    track_id: r.track_id,
    title: r.likes?.title ?? "Titre inconnu",
    artist: r.likes?.artists[0] ?? "",
    cover_url: r.likes?.cover_url ?? null,
    isrc: r.likes?.isrc ?? null,
    placed_at: r.placed_at,
    source: r.source,
    isExample: ex.has(r.track_id),
  }));
}

/** « Retirer » : sort le titre du bac (et de la playlist), contre-exemple pour l'IA ; sans autre bac, il part dans Divers. */
export async function removeTrack(memberId: string, bacId: string, trackId: string): Promise<void> {
  const bac = await ownedActive(memberId, bacId);
  const current = await bacsOfTrack(memberId, trackId);
  const divers = await ensureDivers(memberId);
  await setTrackBacs(
    memberId,
    trackId,
    current.filter((id) => id !== bac.id && id !== divers.id),
    { source: "manuel", aiChoice: current, forceNegative: true },
  );
}

/** « Retirer de Sortify » : le bac disparaît, la playlist reste dans Spotify ; ses titres sans autre bac vont dans Divers. */
export async function detachBac(memberId: string, bacId: string): Promise<void> {
  const bac = await ownedActive(memberId, bacId);
  const divers = await ensureDivers(memberId);
  const tracks = check(await db().from("placements").select("track_id").eq("bac_id", bac.id), "Lecture du bac") as { track_id: string }[];
  const elsewhere = new Set(
    (
      await inChunks(
        tracks.map((t) => t.track_id),
        async (chunk) =>
          check(
            await db().from("placements").select("track_id").eq("member_id", memberId).neq("bac_id", bac.id).in("track_id", chunk),
            "Lecture des autres bacs",
          ) as { track_id: string }[],
      )
    ).map((t) => t.track_id),
  );
  const orphans = tracks.filter((t) => !elsewhere.has(t.track_id));
  if (orphans.length) {
    check(
      await db()
        .from("placements")
        .upsert(orphans.map((t) => ({ bac_id: divers.id, member_id: memberId, track_id: t.track_id, source: "manuel" })), { onConflict: "bac_id,track_id" }),
      "Titres vers Divers",
    );
  }
  check(await db().from("bacs").delete().eq("id", bac.id), "Retrait du bac");
  await syncMember(memberId);
}

/**
 * Nouveau bac actif : fiche, exemples, titres (fournis, ou trouvés par l'IA dans toute la bibliothèque),
 * puis playlist et pochette dans Spotify. Les titres qui y trouvent leur place quittent Divers.
 */
export async function createActiveBac(
  memberId: string,
  fiche: Fiche,
  exampleIds: string[],
  presetTracks?: { track_id: string; confidence: number | null }[],
): Promise<Bac> {
  const active = await listBacs(memberId, ["active"]);
  const bac = check(
    await db()
      .from("bacs")
      .insert({
        member_id: memberId,
        name: fiche.name,
        sleeve_name: fiche.sleeve_name,
        pitch: fiche.pitch,
        brief: fiche.brief,
        axis: fiche.axis,
        color: nextColor(active.map((b) => b.color)),
        position: active.length,
        status: "active",
      })
      .select("*")
      .single(),
    "Création du bac",
  ) as Bac;
  await setExamples(memberId, bac.id, exampleIds);

  let tracks = presetTracks;
  if (!tracks) {
    const [sortFiche] = await sortFichesFor([bac]);
    tracks = (await fillBac(sortFiche, active.map((b) => b.name), await loadCorpus(memberId))).filter(
      (t) => t.confidence >= INITIAL_PLACE_THRESHOLD,
    );
  }
  const all = new Map(tracks.map((t) => [t.track_id, t.confidence]));
  for (const id of exampleIds) all.set(id, 1);
  const rows = [...all].map(([track_id, confidence]) => ({ bac_id: bac.id, member_id: memberId, track_id, confidence, source: "ia" }));
  for (let i = 0; i < rows.length; i += 500) {
    check(await db().from("placements").upsert(rows.slice(i, i + 500), { onConflict: "bac_id,track_id" }), "Titres du nouveau bac");
  }

  await leaveDivers(memberId, [...all.keys()]);
  const playlistId = await createPlaylist(memberId, bac);
  await uploadCover(memberId, { ...bac, spotify_playlist_id: playlistId });
  await syncMember(memberId);
  return bac;
}

/** Les titres qui ont trouvé un bac quittent la caisse Divers (base et playlist). */
async function leaveDivers(memberId: string, trackIds: string[]): Promise<void> {
  if (trackIds.length === 0) return;
  const divers = await ensureDivers(memberId);
  const inDivers = (
    await inChunks(
      trackIds,
      async (chunk) =>
        check(
          await db().from("placements").select("track_id").eq("bac_id", divers.id).in("track_id", chunk),
          "Lecture de Divers",
        ) as { track_id: string }[],
    )
  ).map((r) => r.track_id);
  if (inDivers.length === 0) return;
  await inChunks(inDivers, async (chunk) => {
    check(await db().from("placements").delete().eq("bac_id", divers.id).in("track_id", chunk), "Sortie de Divers");
    return [];
  });
  if (divers.spotify_playlist_id) await removeFromPlaylist(memberId, divers.spotify_playlist_id, inDivers);
}

/** Fusion de deux bacs actifs : un nouveau bac avec les titres des deux ; les anciennes playlists restent dans Spotify. */
export async function mergeActive(memberId: string, aId: string, bId: string, fiche: Fiche, exampleIds: string[]): Promise<void> {
  const [a, b] = await Promise.all([ownedActive(memberId, aId), ownedActive(memberId, bId)]);
  const rows = check(
    await db().from("placements").select("track_id, confidence").in("bac_id", [a.id, b.id]),
    "Lecture des bacs à fusionner",
  ) as { track_id: string; confidence: number | null }[];
  const union = new Map<string, number | null>();
  for (const r of rows) union.set(r.track_id, Math.max(union.get(r.track_id) ?? 0, r.confidence ?? 0) || null);
  await createActiveBac(memberId, fiche, exampleIds, [...union].map(([track_id, confidence]) => ({ track_id, confidence })));
  check(await db().from("bacs").delete().in("id", [a.id, b.id]), "Retrait des bacs fusionnés");
}

/** Titres de la caisse Divers, likés récemment d'abord. */
export async function diversTracks(memberId: string, limit: number): Promise<{ total: number; tracks: TrackInfo[] }> {
  const divers = await ensureDivers(memberId);
  const { count, error } = await db().from("placements").select("track_id", { count: "exact", head: true }).eq("bac_id", divers.id);
  if (error) throw new Error(`Comptage de Divers : ${error.message}`);
  const rows = check(
    await db()
      .from("likes")
      .select("track_id, title, artists, cover_url, isrc, placements!inner(bac_id)")
      .eq("member_id", memberId)
      .eq("placements.bac_id", divers.id)
      .order("liked_at", { ascending: false })
      .limit(limit),
    "Lecture de Divers",
  ) as unknown as { track_id: string; title: string; artists: string[]; cover_url: string | null; isrc: string | null }[];
  return {
    total: count ?? 0,
    tracks: rows.map((r) => ({ track_id: r.track_id, title: r.title, artist: r.artists[0] ?? "", cover_url: r.cover_url, isrc: r.isrc })),
  };
}
