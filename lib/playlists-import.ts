import "server-only";
import { playlistFiche } from "./ai/fiches";
import { insertFiches, listBacs } from "./bacs";
import { loadCorpus, type CorpusTrack } from "./corpus";
import { check, db } from "./db";
import { families } from "./enrichment/families";
import { getMember } from "./members";
import { spotify } from "./spotify/client";
import { splitByFamily, type PlaylistPart } from "./playlist-split";

/**
 * Import des playlists à l'onboarding (13/10/2026, planche `docs/design/idees-2.jpg`, `docs/analyses/2026-10-13-import-playlists.md`).
 * Après l'import des likes, la personne coche ses playlists qui sont de vrais « bacs ». Chacune devient un bac Sortify
 * (copie : sa playlist ne bouge pas), écrit par l'IA à partir de ses titres likés. Une playlist trop large (aucune
 * famille de genre ne fait la moitié) est découpée par famille, ou gardée comme simple indice pour l'analyse.
 */

/** En dessous, une playlist n'est pas proposée (trop peu de titres pour faire un bac). */
const MIN_TRACKS = 15;
const MIN_LIKED = 10;
/** Au plus, pour borner les appels à Spotify et à l'IA. */
const MAX_CANDIDATES = 20;
/** Lectures de playlists en même temps : au-delà, Spotify répond 429 (constaté le 13/10/2026 avec 25 en parallèle). */
const CONCURRENCY = 3;
export const MAX_CHOICES = 8;

export type PlaylistMode = "bac" | "split" | "indice";
export interface PlaylistChoice {
  id: string;
  name: string;
  mode: PlaylistMode;
}

export type { PlaylistPart };

export interface PlaylistCandidate {
  id: string;
  name: string;
  image: string | null;
  total: number;
  liked: number;
  /** Trop large pour un seul bac : on propose de la découper. */
  broad: boolean;
  parts: PlaylistPart[];
}

interface SpotifyPlaylist {
  id: string;
  name: string;
  owner: { id: string };
  images?: { url: string }[] | null;
  items?: { total?: number } | null;
  tracks?: { total?: number } | null;
}

/** Playlists de Sortify lui-même (bacs, arrivage, reco, bacs communs) : jamais proposées. */
async function sortifyPlaylists(memberId: string): Promise<Set<string>> {
  const [bacs, member, commons] = await Promise.all([
    db().from("bacs").select("spotify_playlist_id").eq("member_id", memberId).not("spotify_playlist_id", "is", null),
    getMember(memberId),
    db().from("common_bacs").select("playlist_id").or(`member_a.eq.${memberId},member_b.eq.${memberId}`),
  ]);
  if (bacs.error || commons.error) throw new Error(`Playlists Sortify : ${(bacs.error ?? commons.error)!.message}`);
  return new Set(
    [
      ...(bacs.data ?? []).map((b) => b.spotify_playlist_id as string),
      member?.arrival_playlist_id,
      member?.reco_playlist_id,
      ...(commons.data ?? []).map((c) => c.playlist_id as string | null),
    ].filter((x): x is string => Boolean(x)),
  );
}

/** Playlists que la personne possède, assez grandes, hors Sortify. */
async function ownedPlaylists(memberId: string): Promise<SpotifyPlaylist[]> {
  const exclude = await sortifyPlaylists(memberId);
  const out: SpotifyPlaylist[] = [];
  let url: string | null = "/me/playlists?limit=50";
  for (let pages = 0; url && pages < 6; pages++) {
    const page: { items: SpotifyPlaylist[]; next: string | null } = await spotify(memberId, url);
    for (const p of page.items) {
      const total = p.items?.total ?? p.tracks?.total ?? 0;
      if (p.owner?.id === memberId && !exclude.has(p.id) && total >= MIN_TRACKS) out.push(p);
    }
    url = page.next;
  }
  return out;
}

/** L'étape « Tes playlists » a-t-elle un sens ? (vérification rapide, sans lire les titres) */
export async function hasPlaylistCandidates(memberId: string): Promise<boolean> {
  return (await ownedPlaylists(memberId)).length > 0;
}

async function playlistTrackIds(memberId: string, playlistId: string): Promise<string[]> {
  const ids: string[] = [];
  let url: string | null = `/playlists/${playlistId}/items?limit=100&fields=next,items(item(id,type))`;
  for (let pages = 0; url && pages < 10; pages++) {
    const page: { next: string | null; items: { item: { id: string | null; type?: string } | null }[] } = await spotify(memberId, url);
    for (const it of page.items) if (it.item?.id && (it.item.type ?? "track") === "track") ids.push(it.item.id);
    url = page.next;
  }
  return [...new Set(ids)];
}

async function analysePlaylist(memberId: string, p: { id: string }, corpus: Map<string, CorpusTrack>) {
  const liked = (await playlistTrackIds(memberId, p.id)).map((id) => corpus.get(id)).filter((t): t is CorpusTrack => Boolean(t));
  return { liked, ...splitByFamily(liked.map((t) => ({ track_id: t.track_id, families: [...families(t.genres)] }))) };
}

/** Écran « Tes playlists » : les candidates, avec leurs titres likés et leur découpage éventuel. */
export async function playlistCandidates(memberId: string): Promise<PlaylistCandidate[]> {
  const corpus = new Map((await loadCorpus(memberId)).map((t) => [t.track_id, t]));
  const owned = (await ownedPlaylists(memberId)).slice(0, MAX_CANDIDATES);
  const result: PlaylistCandidate[] = [];
  let next = 0;
  async function worker() {
    while (next < owned.length) {
      const p = owned[next++];
      try {
        const a = await analysePlaylist(memberId, p, corpus);
        result.push({
          id: p.id,
          name: p.name,
          image: p.images?.[0]?.url ?? null,
          total: p.items?.total ?? p.tracks?.total ?? 0,
          liked: a.liked.length,
          broad: a.broad,
          parts: a.parts.map(({ family, label, count }) => ({ family, label, count })),
        });
      } catch (error) {
        // Une playlist illisible (Spotify saturé, supprimée) n'empêche pas de proposer les autres.
        console.warn(`Playlist « ${p.name} » ignorée :`, error instanceof Error ? error.message : error);
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  // Dans l'ordre de la bibliothèque Spotify de la personne.
  const order = new Map(owned.map((p, i) => [p.id, i]));
  return result.filter((c) => c.liked >= MIN_LIKED).sort((a, b) => order.get(a.id)! - order.get(b.id)!);
}

/** Choix de la personne (ou « Passer ») : l'analyse peut démarrer, en commençant par ces playlists. */
export async function savePlaylistChoices(memberId: string, choices: PlaylistChoice[]): Promise<void> {
  check(
    await db()
      .from("members")
      .update({ playlist_choices: choices.slice(0, MAX_CHOICES), playlists_done_at: new Date().toISOString() })
      .eq("spotify_id", memberId),
    "Choix des playlists",
  );
}

export async function playlistChoices(memberId: string): Promise<PlaylistChoice[]> {
  const row = check(await db().from("members").select("playlist_choices").eq("spotify_id", memberId).single(), "Lecture des choix") as {
    playlist_choices: PlaylistChoice[] | null;
  };
  return row.playlist_choices ?? [];
}

/**
 * Étape « playlists » de l'analyse : une playlist choisie par unité de travail. « bac » → un bac ; « split » → un bac par
 * morceau ; « indice » → rien ici (l'analyse le lit). Les titres likés de la playlist y sont rangés d'office (choix de la personne).
 */
export async function importPlaylistUnit(memberId: string, index: number): Promise<boolean> {
  const choices = (await playlistChoices(memberId)).filter((c) => c.mode !== "indice");
  if (index === 0) {
    // Relance après un échec : on repart de zéro plutôt que de doubler les bacs déjà créés.
    check(
      await db().from("bacs").delete().eq("member_id", memberId).in("status", ["proposed", "removed"]).not("from_playlist", "is", null),
      "Effacement des bacs de playlists",
    );
  }
  const choice = choices[index];
  if (!choice) return false;
  const corpus = new Map((await loadCorpus(memberId)).map((t) => [t.track_id, t]));
  const a = await analysePlaylist(memberId, choice, corpus);
  const parts = choice.mode === "split" && a.parts.length >= 2 ? a.parts.map((p) => ({ label: p.label, tracks: p.ids.map((id) => corpus.get(id)!) })) : [{ label: null, tracks: a.liked }];
  for (const part of parts) {
    if (part.tracks.length < MIN_LIKED) continue;
    const existing = await listBacs(memberId, ["proposed", "active"]);
    const fiche = await playlistFiche(
      choice.name,
      part.label,
      existing.map((b) => ({ name: b.name, pitch: b.pitch, axis: b.axis })),
      part.tracks,
    );
    const [bac] = await insertFiches(memberId, [fiche], part.tracks, {
      startPosition: existing.length,
      usedColors: existing.map((b) => b.color),
      usedShapes: existing.map((b) => b.shape),
      needsFill: false,
    });
    check(await db().from("bacs").update({ from_playlist: choice.name.slice(0, 120) }).eq("id", bac.id), "Origine du bac");
    const rows = part.tracks.map((t) => ({ bac_id: bac.id, member_id: memberId, track_id: t.track_id, confidence: 1, source: "manuel" as const }));
    for (let i = 0; i < rows.length; i += 500) {
      check(await db().from("placements").upsert(rows.slice(i, i + 500), { onConflict: "bac_id,track_id" }), "Titres de la playlist");
    }
  }
  return index + 1 < choices.length;
}

/** Playlists gardées comme indice, pour la consigne de l'analyse. */
export async function playlistHints(memberId: string): Promise<{ name: string; artists: string[] }[]> {
  const hints = (await playlistChoices(memberId)).filter((c) => c.mode === "indice");
  if (hints.length === 0) return [];
  const corpus = new Map((await loadCorpus(memberId)).map((t) => [t.track_id, t]));
  return Promise.all(
    hints.map(async (h) => {
      const a = await analysePlaylist(memberId, h, corpus);
      const count = new Map<string, number>();
      for (const t of a.liked) count.set(t.artists[0] ?? "", (count.get(t.artists[0] ?? "") ?? 0) + 1);
      return { name: h.name, artists: [...count].sort((x, y) => y[1] - x[1]).slice(0, 6).map(([n]) => n).filter(Boolean) };
    }),
  );
}
