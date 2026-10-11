import "server-only";
import { leaveDivers } from "./bac-admin";
import { ensureDivers, listBacs, type Bac } from "./bacs";
import { addExample } from "./daily";
import { check, db } from "./db";
import { getMember } from "./members";
import { spotify } from "./spotify/client";
import { removeFromPlaylist } from "./spotify/playlists";

export interface ReconcileStats {
  unliked: number;
  removedInSpotify: number;
  addedInSpotify: number;
  /** Détail lisible (titres concernés), utile pour un essai à blanc. */
  details: string[];
}

const CONTAINS_CHUNK = 40;
const IN_CHUNK = 150;

async function pageAll<T>(query: (from: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>, context: string): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += 1000) {
    const page = check(await query(from), context) as T[];
    rows.push(...page);
    if (page.length < 1000) break;
  }
  return rows;
}

/**
 * Prend en compte ce que la personne a changé directement dans Spotify (à chaque tri) :
 * - like retiré : retiré des playlists Sortify, ou gardé selon le réglage ;
 * - titre retiré à la main d'une playlist Sortify : correction (contre-exemple, Divers s'il n'a plus de bac) ;
 * - titre liké ajouté à la main dans une playlist Sortify : rangement manuel, exemple pour l'IA, sort de Divers.
 */
export async function reconcileSpotify(memberId: string, opts: { dryRun?: boolean } = {}): Promise<ReconcileStats> {
  const stats: ReconcileStats = { unliked: 0, removedInSpotify: 0, addedInSpotify: 0, details: [] };
  const dry = opts.dryRun ?? false;
  const member = await getMember(memberId);
  if (!member) throw new Error(`Membre inconnu : ${memberId}`);
  const bacs: Bac[] = [...(await listBacs(memberId, ["active"])), await ensureDivers(memberId)].filter((b) => b.spotify_playlist_id);

  stats.unliked = await handleUnlikes(memberId, member.unlike_action, bacs, dry, stats.details);
  for (const bac of bacs) {
    const { removed, added } = await reconcilePlaylist(memberId, bac, dry, stats.details);
    stats.removedInSpotify += removed;
    stats.addedInSpotify += added;
  }
  return stats;
}

async function handleUnlikes(memberId: string, action: "retirer" | "garder", bacs: Bac[], dry: boolean, details: string[]): Promise<number> {
  const likes = await pageAll<{ track_id: string }>(
    (f) => db().from("likes").select("track_id").eq("member_id", memberId).is("unliked_at", null).range(f, f + 999),
    "Lecture des likes",
  );
  const gone: string[] = [];
  for (let i = 0; i < likes.length; i += CONTAINS_CHUNK) {
    const ids = likes.slice(i, i + CONTAINS_CHUNK).map((l) => l.track_id);
    const saved = await spotify<boolean[]>(memberId, `/me/library/contains?uris=${ids.map((id) => `spotify:track:${id}`).join(",")}`);
    ids.forEach((id, k) => {
      if (saved[k] === false) gone.push(id);
    });
  }
  if (gone.length === 0) return 0;
  details.push(`${gone.length} like(s) retiré(s) dans Spotify → ${action === "retirer" ? "retirés des playlists" : "gardés"} : ${gone.slice(0, 10).join(", ")}`);
  if (dry) return gone.length;

  for (let i = 0; i < gone.length; i += IN_CHUNK) {
    const chunk = gone.slice(i, i + IN_CHUNK);
    if (action === "garder") {
      // Gardé dans les playlists ; Sortify ne le suit plus.
      check(
        await db().from("likes").update({ unliked_at: new Date().toISOString(), excluded: true }).eq("member_id", memberId).in("track_id", chunk),
        "Like retiré (gardé)",
      );
      continue;
    }
    // Retiré de toutes les playlists, puis oublié (les placements, exemples et « À trier » suivent en cascade).
    const placed = check(
      await db().from("placements").select("bac_id, track_id").eq("member_id", memberId).in("track_id", chunk),
      "Lecture des placements",
    ) as { bac_id: string; track_id: string }[];
    for (const bac of bacs) {
      const ids = placed.filter((p) => p.bac_id === bac.id).map((p) => p.track_id);
      if (ids.length) await removeFromPlaylist(memberId, bac.spotify_playlist_id!, ids);
    }
    check(await db().from("likes").delete().eq("member_id", memberId).in("track_id", chunk), "Oubli des likes retirés");
  }
  return gone.length;
}

async function playlistTracks(memberId: string, playlistId: string): Promise<Set<string>> {
  const ids = new Set<string>();
  let url: string | null = `/playlists/${playlistId}/items?limit=100&fields=next,items(item(id,type))`;
  while (url) {
    const page: { next: string | null; items: { item: { id: string | null; type?: string } | null }[] } = await spotify(memberId, url);
    for (const it of page.items) if (it.item?.id && (it.item.type ?? "track") === "track") ids.add(it.item.id);
    url = page.next;
  }
  return ids;
}

async function reconcilePlaylist(memberId: string, bac: Bac, dry: boolean, details: string[]): Promise<{ removed: number; added: number }> {
  let inSpotify: Set<string>;
  try {
    inSpotify = await playlistTracks(memberId, bac.spotify_playlist_id!);
  } catch (error) {
    // Playlist supprimée ou inaccessible : on ne touche à rien, le reste du tri continue.
    console.warn(`Playlist de « ${bac.name} » illisible :`, error instanceof Error ? error.message : error);
    return { removed: 0, added: 0 };
  }
  const placements = await pageAll<{ track_id: string; synced_at: string | null }>(
    (f) => db().from("placements").select("track_id, synced_at").eq("bac_id", bac.id).range(f, f + 999),
    "Lecture des placements",
  );
  const known = new Set(placements.map((p) => p.track_id));

  // Retirés à la main : seulement ceux déjà poussés (les autres attendent la synchro).
  const removed = placements.filter((p) => p.synced_at && !inSpotify.has(p.track_id)).map((p) => p.track_id);
  if (removed.length) details.push(`« ${bac.name} » : ${removed.length} retiré(s) à la main dans Spotify : ${removed.slice(0, 10).join(", ")}`);
  for (const trackId of dry ? [] : removed) {
    check(await db().from("placements").delete().eq("bac_id", bac.id).eq("track_id", trackId), "Retrait fait dans Spotify");
    if (bac.is_divers) {
      // Sorti de Divers : la personne ne veut plus le voir ranger automatiquement.
      check(await db().from("likes").update({ excluded: true }).eq("member_id", memberId).eq("track_id", trackId), "Titre exclu");
      continue;
    }
    await addExample(memberId, bac.id, trackId, "negative");
    const left = check(await db().from("placements").select("bac_id").eq("member_id", memberId).eq("track_id", trackId), "Autres bacs") as unknown[];
    if (left.length === 0) {
      const divers = await ensureDivers(memberId);
      check(
        await db().from("placements").upsert({ bac_id: divers.id, member_id: memberId, track_id: trackId, source: "manuel" }, { onConflict: "bac_id,track_id" }),
        "Vers Divers",
      );
    }
  }

  // Ajoutés à la main : seulement des titres likés que Sortify connaît.
  const candidates = [...inSpotify].filter((id) => !known.has(id));
  const liked: string[] = [];
  for (let i = 0; i < candidates.length; i += IN_CHUNK) {
    const rows = check(
      await db().from("likes").select("track_id").eq("member_id", memberId).is("unliked_at", null).in("track_id", candidates.slice(i, i + IN_CHUNK)),
      "Lecture des likes ajoutés",
    ) as { track_id: string }[];
    liked.push(...rows.map((r) => r.track_id));
  }
  if (liked.length) details.push(`« ${bac.name} » : ${liked.length} ajouté(s) à la main dans Spotify : ${liked.slice(0, 10).join(", ")}`);
  if (liked.length && !dry) {
    const now = new Date().toISOString();
    check(
      await db()
        .from("placements")
        .upsert(liked.map((track_id) => ({ bac_id: bac.id, member_id: memberId, track_id, source: "manuel", synced_at: now })), { onConflict: "bac_id,track_id" }),
      "Ajout fait dans Spotify",
    );
    check(await db().from("likes").update({ excluded: false }).eq("member_id", memberId).in("track_id", liked), "Titre réintégré");
    check(await db().from("pending").delete().eq("member_id", memberId).in("track_id", liked), "Sortie de « À trier »");
    if (!bac.is_divers) {
      for (const id of liked) await addExample(memberId, bac.id, id, "positive");
      await leaveDivers(memberId, liked);
    }
  }
  return { removed: removed.length, added: liked.length };
}
