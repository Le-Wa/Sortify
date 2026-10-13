import "server-only";
import { getBac, type Bac } from "./bacs";
import { check, db } from "./db";
import { camelot, djOrder, keyDistance, tempoGap } from "./dj-order";
import { spotify } from "./spotify/client";

/**
 * Ordre d'une playlist de bac dans Spotify (13/10/2026). « dj » : enchaînement par tempo, tonalité et énergie
 * (`lib/dj-order.ts`) ; « recents » : du plus récent au plus ancien like. Réécrit la playlist : aperçu d'abord.
 */

const CHUNK = 100;
const uri = (id: string) => `spotify:track:${id}`;

interface Audio {
  tempo?: number;
  key?: number;
  mode?: number;
  energy?: number;
}

/** Titres de la playlist, dans l'ordre de Spotify. */
async function playlistOrder(memberId: string, playlistId: string): Promise<string[]> {
  const ids: string[] = [];
  let url: string | null = `/playlists/${playlistId}/items?limit=100&fields=next,items(item(id,type))`;
  while (url) {
    const page: { next: string | null; items: { item: { id: string | null; type?: string } | null }[] } = await spotify(memberId, url);
    for (const it of page.items) if (it.item?.id && (it.item.type ?? "track") === "track") ids.push(it.item.id);
    url = page.next;
  }
  return [...new Set(ids)];
}

async function likesOf(memberId: string, ids: string[]) {
  const rows: { track_id: string; title: string; artists: string[]; liked_at: string; audio: Audio | null }[] = [];
  for (let i = 0; i < ids.length; i += 200) {
    rows.push(
      ...(check(
        await db().from("likes").select("track_id, title, artists, liked_at, audio").eq("member_id", memberId).in("track_id", ids.slice(i, i + 200)),
        "Lecture des titres du bac",
      ) as typeof rows),
    );
  }
  return new Map(rows.map((r) => [r.track_id, r]));
}

/** Nouvel ordre d'un bac, sans rien écrire. */
async function computeOrder(memberId: string, bac: Bac, order: "dj" | "recents") {
  if (!bac.spotify_playlist_id) throw new Error("Ce bac n'a pas encore de playlist.");
  const current = await playlistOrder(memberId, bac.spotify_playlist_id);
  const likes = await likesOf(memberId, current);
  const next =
    order === "dj"
      ? djOrder(current.map((id) => ({ id, ...(likes.get(id)?.audio ?? {}) })))
      : [
          ...current.filter((id) => likes.has(id)).sort((a, b) => Date.parse(likes.get(b)!.liked_at) - Date.parse(likes.get(a)!.liked_at)),
          ...current.filter((id) => !likes.has(id)),
        ];
  return { current, next, likes };
}

/** Part des enchaînements « propres » : tempo à ± 6 % et tonalités compatibles. */
function smoothness(ids: string[], audio: (id: string) => Audio | undefined) {
  let tempo = 0, key = 0, pairs = 0;
  for (let i = 1; i < ids.length; i++) {
    const a = audio(ids[i - 1]);
    const b = audio(ids[i]);
    if (!a?.tempo || !b?.tempo) continue;
    pairs++;
    if (tempoGap(a.tempo, b.tempo) <= 0.06) tempo++;
    if (keyDistance(camelot(a.key, a.mode), camelot(b.key, b.mode)) === 0) key++;
  }
  const pct = (n: number) => (pairs ? Math.round((100 * n) / pairs) : 0);
  return { tempo: pct(tempo), key: pct(key) };
}

export interface DjPreview {
  total: number;
  /** Titres dont on connaît le tempo. */
  withTempo: number;
  before: { tempo: number; key: number };
  after: { tempo: number; key: number };
  first: { title: string; artist: string; bpm: number | null; key: string | null; energy: number | null }[];
}

/** Aperçu (essai à blanc) de l'ordre DJ d'un bac. */
export async function djPreview(memberId: string, bacId: string): Promise<DjPreview> {
  const bac = await getBac(memberId, bacId);
  if (!bac || bac.status !== "active") throw new Error("Ce bac n'existe plus.");
  const { current, next, likes } = await computeOrder(memberId, bac, "dj");
  const audio = (id: string) => likes.get(id)?.audio ?? undefined;
  return {
    total: current.length,
    withTempo: current.filter((id) => audio(id)?.tempo).length,
    before: smoothness(current, audio),
    after: smoothness(next, audio),
    first: next.slice(0, 12).map((id) => {
      const l = likes.get(id);
      const a = l?.audio;
      return { title: l?.title ?? "Titre ajouté à la main", artist: l?.artists[0] ?? "", bpm: a?.tempo ?? null, key: camelot(a?.key, a?.mode), energy: a?.energy ?? null };
    }),
  };
}

/** Réécrit la playlist dans l'ordre demandé et le retient pour les prochains tris. */
export async function applyOrder(memberId: string, bacId: string, order: "dj" | "recents"): Promise<void> {
  const bac = await getBac(memberId, bacId);
  if (!bac || bac.status !== "active") throw new Error("Ce bac n'existe plus.");
  await writeOrder(memberId, bac, order);
  check(await db().from("bacs").update({ play_order: order }).eq("id", bac.id), "Ordre du bac");
}

async function writeOrder(memberId: string, bac: Bac, order: "dj" | "recents"): Promise<void> {
  const { current, next } = await computeOrder(memberId, bac, order);
  if (next.length !== current.length) throw new Error("Ordre incomplet : playlist laissée telle quelle.");
  // PUT remplace le contenu par les 100 premiers, puis le reste est ajouté à la suite.
  await spotify(memberId, `/playlists/${bac.spotify_playlist_id}/items`, { method: "PUT", json: { uris: next.slice(0, CHUNK).map(uri) } });
  for (let i = CHUNK; i < next.length; i += CHUNK) {
    await spotify(memberId, `/playlists/${bac.spotify_playlist_id}/items`, { method: "POST", json: { uris: next.slice(i, i + CHUNK).map(uri) } });
  }
}

/** Après un ajout (tri, anciens likes) : un bac en ordre DJ est réordonné pour que les nouveaux titres trouvent leur place. */
export async function keepDjOrder(memberId: string, bac: Bac): Promise<void> {
  if (bac.play_order !== "dj" || !bac.spotify_playlist_id) return;
  await writeOrder(memberId, bac, "dj");
}
