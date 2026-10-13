import "server-only";
import { affinity, bacSimilarity, type AffinityTrack } from "./affinity";
import { listBacs, type Bac } from "./bacs";
import { coverJpegBase64 } from "./cover";
import { markFor, type SleeveMark } from "./cover-shapes";
import { check, db } from "./db";
import { families } from "./enrichment/families";
import { FAMILY_LABELS } from "./divers";
import { getMember } from "./members";
import { spotify, SpotifyError } from "./spotify/client";
import { addToTop } from "./spotify/playlists";

/**
 * Bacs des potes (13/10/2026, planche `docs/design/idees-potes.jpg`), sans IA :
 * A. vitrine — affinité et bacs partagés de chaque pote ;
 * B. croisement — depuis un de mes bacs, le bac le plus proche chez un pote et ses titres que je n'ai pas (→ « Reco des potes ») ;
 * C. bac commun — une playlist à deux, proposée par l'un, acceptée par l'autre, mise à jour à chaque tri.
 * Rien n'est visible sans l'accord des deux (`members.share_bacs`), et seulement les bacs partagés (`bacs.shared`), jamais Divers.
 */

interface LibTrack extends AffinityTrack {
  title: string;
  cover_url: string | null;
  isrc: string | null;
  liked_at: string;
}

const firstName = (name: string | null, id: string) => (name ?? id).split(" ")[0];

async function library(memberId: string): Promise<Map<string, LibTrack>> {
  const rows: { track_id: string; title: string; artists: string[]; genres: string[]; cover_url: string | null; isrc: string | null; liked_at: string }[] = [];
  for (let from = 0; ; from += 1000) {
    const page = check(
      await db()
        .from("likes")
        .select("track_id, title, artists, genres, cover_url, isrc, liked_at")
        .eq("member_id", memberId)
        .eq("excluded", false)
        .is("unliked_at", null)
        .order("liked_at", { ascending: false })
        .range(from, from + 999),
      "Lecture de la bibliothèque",
    ) as typeof rows;
    rows.push(...page);
    if (page.length < 1000) break;
  }
  return new Map(
    rows.map((r) => [
      r.track_id,
      { track_id: r.track_id, artist: r.artists[0] ?? "", families: [...families(r.genres)], title: r.title, cover_url: r.cover_url, isrc: r.isrc, liked_at: r.liked_at },
    ]),
  );
}

async function trackIdsOf(bacId: string): Promise<string[]> {
  const ids: string[] = [];
  for (let from = 0; ; from += 1000) {
    const rows = check(await db().from("placements").select("track_id").eq("bac_id", bacId).range(from, from + 999), "Titres du bac") as { track_id: string }[];
    ids.push(...rows.map((r) => r.track_id));
    if (rows.length < 1000) break;
  }
  return ids;
}

const sharedBacs = async (memberId: string) => (await listBacs(memberId, ["active"])).filter((b) => b.shared && b.spotify_playlist_id);

async function sharingPotes(meId: string): Promise<{ spotify_id: string; display_name: string | null }[]> {
  return check(
    await db().from("members").select("spotify_id, display_name").eq("share_bacs", true).neq("spotify_id", meId).order("created_at"),
    "Lecture des potes",
  ) as { spotify_id: string; display_name: string | null }[];
}

export interface PoteBacCard {
  id: string;
  name: string;
  sleeve: string;
  color: string;
  mark: SleeveMark;
  count: number;
}

export interface PoteView {
  id: string;
  name: string;
  score: number;
  sharedTracks: number;
  sharedArtists: string[];
  sharedArtistCount: number;
  meeting: string | null;
  bacs: PoteBacCard[];
  common: { id: string; status: "pending" | "active" | "refused"; mine: boolean; playlistId: string | null; tracks: number } | null;
}

export interface PotesOverview {
  /** Le membre a dit oui : il voit les potes qui ont dit oui aussi. */
  sharing: boolean;
  /** Membres qui ont dit oui (hors moi), pour inviter à le faire. */
  waiting: number;
  potes: PoteView[];
}

/** A. Vitrine : chaque pote qui partage, son affinité avec moi, ses bacs partagés, notre bac commun. */
export async function potesOverview(meId: string): Promise<PotesOverview> {
  const me = await getMember(meId);
  const others = await sharingPotes(meId);
  const { count } = await db().from("members").select("spotify_id", { count: "exact", head: true }).neq("spotify_id", meId);
  if (!me?.share_bacs) return { sharing: false, waiting: others.length, potes: [] };
  const mine = [...(await library(meId)).values()];
  const commons = check(
    await db().from("common_bacs").select("*").or(`member_a.eq.${meId},member_b.eq.${meId}`).neq("status", "refused"),
    "Lecture des bacs communs",
  ) as { id: string; member_a: string; member_b: string; status: "pending" | "active"; playlist_id: string | null; tracks: number }[];
  const potes = await Promise.all(
    others.map(async (o) => {
      const theirs = [...(await library(o.spotify_id)).values()];
      const a = affinity(mine, theirs);
      const bacs = await sharedBacs(o.spotify_id);
      const counts = await Promise.all(bacs.map(async (b) => (await trackIdsOf(b.id)).length));
      const c = commons.find((x) => x.member_a === o.spotify_id || x.member_b === o.spotify_id);
      return {
        id: o.spotify_id,
        name: firstName(o.display_name, o.spotify_id),
        score: a.score,
        sharedTracks: a.sharedTracks.length,
        sharedArtists: a.sharedArtists.slice(0, 4),
        sharedArtistCount: a.sharedArtists.length,
        meeting: a.meetingFamily ? (FAMILY_LABELS[a.meetingFamily] ?? a.meetingFamily) : null,
        bacs: bacs.map((b, i) => ({ id: b.id, name: b.name, sleeve: b.sleeve_name ?? b.name, color: b.color, mark: markFor(b), count: counts[i] })),
        common: c ? { id: c.id, status: c.status, mine: c.member_a === meId, playlistId: c.playlist_id, tracks: c.tracks } : null,
      };
    }),
  );
  return { sharing: true, waiting: Math.max(0, (count ?? 0) - others.length), potes };
}

async function assertBothShare(meId: string, poteId: string): Promise<void> {
  const [me, pote] = await Promise.all([getMember(meId), getMember(poteId)]);
  if (!me?.share_bacs) throw new Error("Active d'abord « Montrer mes bacs » dans les Réglages.");
  if (!pote?.share_bacs) throw new Error("Ce pote ne partage pas ses bacs.");
}

export interface PoteBacView {
  pote: string;
  bac: PoteBacCard & { pitch: string; playlistId: string };
  tracks: { track_id: string; title: string; artist: string; cover_url: string | null; isrc: string | null; mine: boolean }[];
}

/** Le contenu d'un bac partagé par un pote. */
export async function poteBac(meId: string, bacId: string): Promise<PoteBacView | null> {
  const bac = check(await db().from("bacs").select("*").eq("id", bacId).maybeSingle(), "Lecture du bac") as Bac | null;
  if (!bac || bac.member_id === meId || bac.status !== "active" || !bac.shared || bac.is_divers || !bac.spotify_playlist_id) return null;
  await assertBothShare(meId, bac.member_id);
  const [pote, theirs, mine, ids] = await Promise.all([getMember(bac.member_id), library(bac.member_id), library(meId), trackIdsOf(bac.id)]);
  const tracks = ids
    .map((id) => theirs.get(id))
    .filter((t): t is LibTrack => Boolean(t))
    .sort((a, b) => Date.parse(b.liked_at) - Date.parse(a.liked_at))
    .map((t) => ({ track_id: t.track_id, title: t.title, artist: t.artist, cover_url: t.cover_url, isrc: t.isrc, mine: mine.has(t.track_id) }));
  return {
    pote: firstName(pote?.display_name ?? null, bac.member_id),
    bac: { id: bac.id, name: bac.name, sleeve: bac.sleeve_name ?? bac.name, color: bac.color, mark: markFor(bac), count: tracks.length, pitch: bac.pitch, playlistId: bac.spotify_playlist_id },
    tracks,
  };
}

const CROSS_MIN = 0.44;

export interface Crossing {
  pote: string;
  bac: PoteBacCard;
  common: number;
  suggestions: { track_id: string; title: string; artist: string; cover_url: string | null; isrc: string | null }[];
}

/** B. Croisement : pour un de mes bacs, le bac le plus proche chez chaque pote et ses titres que je n'ai pas. */
export async function crossingsFor(meId: string, myBacId: string): Promise<Crossing[]> {
  const me = await getMember(meId);
  if (!me?.share_bacs) return [];
  const mine = await library(meId);
  const myTracks = (await trackIdsOf(myBacId)).map((id) => mine.get(id)).filter((t): t is LibTrack => Boolean(t));
  if (myTracks.length === 0) return [];
  const result: Crossing[] = [];
  for (const o of await sharingPotes(meId)) {
    const theirs = await library(o.spotify_id);
    let best: { bac: Bac; tracks: LibTrack[]; sim: number } | null = null;
    for (const bac of await sharedBacs(o.spotify_id)) {
      const tracks = (await trackIdsOf(bac.id)).map((id) => theirs.get(id)).filter((t): t is LibTrack => Boolean(t));
      const sim = bacSimilarity(myTracks, tracks);
      if (!best || sim > best.sim) best = { bac, tracks, sim };
    }
    // En dessous, les deux bacs ne parlent pas de la même musique : mieux vaut ne rien proposer.
    // Calé sur Walid × Jérémy (13/10/2026, scripts/lab/potes-check.mts) : bons rapprochements ≥ 0,46, mauvais ≤ 0,38.
    if (!best || best.sim < CROSS_MIN) continue;
    const suggestions = best.tracks
      .filter((t) => !mine.has(t.track_id))
      .sort((a, b) => Date.parse(b.liked_at) - Date.parse(a.liked_at))
      .slice(0, 8)
      .map((t) => ({ track_id: t.track_id, title: t.title, artist: t.artist, cover_url: t.cover_url, isrc: t.isrc }));
    if (suggestions.length === 0) continue;
    result.push({
      pote: firstName(o.display_name, o.spotify_id),
      bac: { id: best.bac.id, name: best.bac.name, sleeve: best.bac.sleeve_name ?? best.bac.name, color: best.bac.color, mark: markFor(best.bac), count: best.tracks.length },
      common: best.tracks.filter((t) => mine.has(t.track_id)).length,
      suggestions,
    });
  }
  return result;
}

// ── « Reco des potes » : une playlist dans mon Spotify ───────────────────────

const RECO = { name: "Reco des potes", sleeve_name: "Reco des potes", color: "#2bb673", axis: "moment", shape: "sparkle", outline: false, is_divers: false };

async function createReco(memberId: string): Promise<string> {
  const playlist = await spotify<{ id: string }>(memberId, "/me/playlists", {
    method: "POST",
    json: { name: RECO.name, description: "Des titres de tes potes, choisis dans Sortify. Like ce qui te plaît : Sortify le range lundi.", public: false },
  });
  check(await db().from("members").update({ reco_playlist_id: playlist.id }).eq("spotify_id", memberId), "Playlist Reco des potes");
  try {
    await spotify(memberId, `/playlists/${playlist.id}/images`, { method: "PUT", headers: { "Content-Type": "image/jpeg" }, body: await coverJpegBase64(RECO) });
  } catch (error) {
    console.warn("Pochette de « Reco des potes » non envoyée :", error instanceof Error ? error.message : error);
  }
  return playlist.id;
}

async function playlistIds(memberId: string, playlistId: string): Promise<Set<string>> {
  const ids = new Set<string>();
  let url: string | null = `/playlists/${playlistId}/items?limit=100&fields=next,items(item(id))`;
  while (url) {
    const page: { next: string | null; items: { item: { id: string | null } | null }[] } = await spotify(memberId, url);
    for (const it of page.items) if (it.item?.id) ids.add(it.item.id);
    url = page.next;
  }
  return ids;
}

/** Ajoute des titres en haut de « Reco des potes » (sans doublon) ; la crée au premier usage. */
export async function addToReco(meId: string, trackIds: string[]): Promise<number> {
  const me = await getMember(meId);
  if (!me) throw new Error("Membre inconnu.");
  let playlistId = me.reco_playlist_id ?? (await createReco(meId));
  let present: Set<string>;
  try {
    present = await playlistIds(meId, playlistId);
  } catch (error) {
    // Playlist supprimée dans Spotify : on en refait une.
    if (!(error instanceof SpotifyError) || error.status !== 404) throw error;
    playlistId = await createReco(meId);
    present = new Set();
  }
  const fresh = [...new Set(trackIds)].filter((id) => !present.has(id));
  if (fresh.length > 0) await addToTop(meId, playlistId, fresh);
  return fresh.length;
}

// ── C. Bac commun ────────────────────────────────────────────────────────────

const COMMON_MAX = 150;

/** Titres likés par les deux, puis ceux des artistes communs (chez l'un ou l'autre), du plus récent au plus ancien. */
async function commonTracks(a: string, b: string): Promise<string[]> {
  const [la, lb] = await Promise.all([library(a), library(b)]);
  const aff = affinity([...la.values()], [...lb.values()]);
  const artists = new Set(aff.sharedArtists);
  const byArtist = [...la.values(), ...lb.values()]
    .filter((t) => artists.has(t.artist) && !aff.sharedTracks.includes(t.track_id))
    .sort((x, y) => Date.parse(y.liked_at) - Date.parse(x.liked_at))
    .map((t) => t.track_id);
  return [...new Set([...aff.sharedTracks, ...byArtist])].slice(0, COMMON_MAX);
}

/** Propose un bac commun à un pote (une seule demande en cours par paire). */
export async function proposeCommon(meId: string, poteId: string): Promise<void> {
  await assertBothShare(meId, poteId);
  const existing = check(
    await db()
      .from("common_bacs")
      .select("id")
      .or(`and(member_a.eq.${meId},member_b.eq.${poteId}),and(member_a.eq.${poteId},member_b.eq.${meId})`)
      .neq("status", "refused"),
    "Lecture des bacs communs",
  ) as { id: string }[];
  if (existing.length > 0) return;
  check(await db().from("common_bacs").insert({ member_a: meId, member_b: poteId }), "Proposition de bac commun");
}

/** Réponse du pote : accepter crée la playlist (chez celui qui l'a proposée) et la remplit. */
export async function answerCommon(meId: string, id: string, accept: boolean): Promise<void> {
  const row = check(await db().from("common_bacs").select("*").eq("id", id).eq("member_b", meId).eq("status", "pending").maybeSingle(), "Lecture de la proposition") as {
    id: string;
    member_a: string;
    member_b: string;
  } | null;
  if (!row) throw new Error("Cette proposition n'existe plus.");
  if (!accept) {
    check(await db().from("common_bacs").update({ status: "refused", updated_at: new Date().toISOString() }).eq("id", id), "Refus du bac commun");
    return;
  }
  await assertBothShare(meId, row.member_a);
  const [a, b] = await Promise.all([getMember(row.member_a), getMember(row.member_b)]);
  const name = `${firstName(a?.display_name ?? null, row.member_a)} × ${firstName(b?.display_name ?? null, row.member_b)}`;
  const playlist = await spotify<{ id: string }>(row.member_a, "/me/playlists", {
    method: "POST",
    json: { name, description: "Bac commun Sortify : vos titres et vos artistes en commun, mis à jour chaque lundi.", public: false },
  });
  check(await db().from("common_bacs").update({ status: "active", playlist_id: playlist.id, updated_at: new Date().toISOString() }).eq("id", id), "Bac commun créé");
  try {
    await spotify(row.member_a, `/playlists/${playlist.id}/images`, {
      method: "PUT",
      headers: { "Content-Type": "image/jpeg" },
      body: await coverJpegBase64({ name, sleeve_name: name.length > 16 ? name.slice(0, 16) : null, color: "#e85d3a", axis: "moment", shape: "squiggle", outline: false, is_divers: false }),
    });
  } catch (error) {
    console.warn("Pochette du bac commun non envoyée :", error instanceof Error ? error.message : error);
  }
  await fillCommon(id, row.member_a, row.member_b, playlist.id);
}

async function fillCommon(id: string, a: string, b: string, playlistId: string): Promise<void> {
  const ids = await commonTracks(a, b);
  const uris = ids.map((t) => `spotify:track:${t}`);
  await spotify(a, `/playlists/${playlistId}/items`, { method: "PUT", json: { uris: uris.slice(0, 100) } });
  for (let i = 100; i < uris.length; i += 100) await spotify(a, `/playlists/${playlistId}/items`, { method: "POST", json: { uris: uris.slice(i, i + 100) } });
  check(await db().from("common_bacs").update({ tracks: ids.length, updated_at: new Date().toISOString() }).eq("id", id), "Bac commun à jour");
}

/** Après un tri : les bacs communs du membre suivent ses nouveaux likes. */
export async function refreshCommons(memberId: string): Promise<void> {
  const rows = check(
    await db().from("common_bacs").select("id, member_a, member_b, playlist_id").or(`member_a.eq.${memberId},member_b.eq.${memberId}`).eq("status", "active"),
    "Lecture des bacs communs",
  ) as { id: string; member_a: string; member_b: string; playlist_id: string | null }[];
  for (const r of rows) if (r.playlist_id) await fillCommon(r.id, r.member_a, r.member_b, r.playlist_id);
}

/** Propositions de bac commun reçues (Accueil et page Potes). */
export async function pendingCommonsFor(meId: string): Promise<{ id: string; from: string }[]> {
  const rows = check(
    await db().from("common_bacs").select("id, members!common_bacs_member_a_fkey(display_name, spotify_id)").eq("member_b", meId).eq("status", "pending"),
    "Lecture des propositions",
  ) as unknown as { id: string; members: { display_name: string | null; spotify_id: string } | null }[];
  return rows.map((r) => ({ id: r.id, from: firstName(r.members?.display_name ?? null, r.members?.spotify_id ?? "Un pote") }));
}
