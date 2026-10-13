import "server-only";
import { ensureDivers, listBacs } from "./bacs";
import { addExample } from "./daily";
import { check, db } from "./db";
import { families } from "./enrichment/families";
import { MAX_BACS_PER_TRACK } from "./limits";
import { removeFromPlaylist } from "./spotify/playlists";
import { syncMember } from "./sync";

/**
 * Caisse Divers à ranger facilement (13/10/2026, planche `docs/design/idees-1.jpg`) : filtres par famille de genre,
 * regroupement par artiste, rangement par lot, et avis de l'IA gardé quand il existe (`divers_hints`).
 */

export { FAMILY_LABELS } from "./family-labels";

export interface DiversItem {
  track_id: string;
  title: string;
  artist: string;
  cover_url: string | null;
  isrc: string | null;
  /** Familles de genre (clés de FAMILY_LABELS) ; vide = sans genre connu. */
  families: string[];
  /** Avis gardé de l'IA : bacs actifs proposés, du plus sûr au moins sûr. */
  hint: { bac_id: string; confidence: number }[];
  reason: string | null;
}

/** Tout Divers, du plus récent au plus ancien like. */
export async function diversCatalog(memberId: string): Promise<DiversItem[]> {
  const divers = await ensureDivers(memberId);
  const rows: { track_id: string; title: string; artists: string[]; cover_url: string | null; isrc: string | null; genres: string[] }[] = [];
  // PostgREST plafonne à 1 000 lignes par requête.
  for (let from = 0; ; from += 1000) {
    const page = check(
      await db()
        .from("likes")
        .select("track_id, title, artists, cover_url, isrc, genres, placements!inner(bac_id)")
        .eq("member_id", memberId)
        .eq("placements.bac_id", divers.id)
        .order("liked_at", { ascending: false })
        .range(from, from + 999),
      "Lecture de Divers",
    ) as unknown as typeof rows;
    rows.push(...page);
    if (page.length < 1000) break;
  }
  const active = new Set((await listBacs(memberId, ["active"])).map((b) => b.id));
  const hints = new Map<string, { suggestions: { bac_id: string; confidence: number }[]; reason: string | null }>();
  const ids = rows.map((r) => r.track_id);
  for (let i = 0; i < ids.length; i += 300) {
    const page = check(
      await db().from("divers_hints").select("track_id, suggestions, reason").eq("member_id", memberId).in("track_id", ids.slice(i, i + 300)),
      "Lecture des avis gardés",
    ) as { track_id: string; suggestions: { bac_id: string; confidence: number }[]; reason: string | null }[];
    for (const h of page) hints.set(h.track_id, h);
  }
  return rows.map((r) => {
    const h = hints.get(r.track_id);
    return {
      track_id: r.track_id,
      title: r.title,
      artist: r.artists[0] ?? "",
      cover_url: r.cover_url,
      isrc: r.isrc,
      families: [...families(r.genres)],
      hint: (h?.suggestions ?? []).filter((s) => active.has(s.bac_id)),
      reason: h?.reason ?? null,
    };
  });
}

/**
 * Rangement par lot depuis Divers : les titres quittent Divers (et sa playlist) pour ces bacs, en une seule synchro.
 * Les premiers titres deviennent des exemples du bac (choix de la personne) ; au-delà, ça n'apprend plus grand-chose.
 */
export async function placeManyFromDivers(memberId: string, trackIds: string[], bacIds: string[]): Promise<number> {
  const divers = await ensureDivers(memberId);
  const active = new Set((await listBacs(memberId, ["active"])).map((b) => b.id));
  const chosen = [...new Set(bacIds)].filter((id) => active.has(id)).slice(0, MAX_BACS_PER_TRACK);
  if (chosen.length === 0) throw new Error("Choisis au moins un bac.");
  // Seulement des titres encore dans Divers.
  const inDivers = new Set<string>();
  for (let i = 0; i < trackIds.length; i += 300) {
    const rows = check(
      await db().from("placements").select("track_id").eq("bac_id", divers.id).in("track_id", trackIds.slice(i, i + 300)),
      "Lecture de Divers",
    ) as { track_id: string }[];
    for (const r of rows) inDivers.add(r.track_id);
  }
  const ids = trackIds.filter((id) => inDivers.has(id));
  if (ids.length === 0) return 0;

  const rows = ids.flatMap((track_id) => chosen.map((bac_id) => ({ bac_id, member_id: memberId, track_id, confidence: null, source: "manuel" as const })));
  for (let i = 0; i < rows.length; i += 500) {
    check(await db().from("placements").upsert(rows.slice(i, i + 500), { onConflict: "bac_id,track_id" }), "Rangement par lot");
  }
  for (let i = 0; i < ids.length; i += 300) {
    const chunk = ids.slice(i, i + 300);
    check(await db().from("placements").delete().eq("bac_id", divers.id).in("track_id", chunk), "Sortie de Divers");
    check(await db().from("divers_hints").delete().eq("member_id", memberId).in("track_id", chunk), "Avis gardés utilisés");
  }
  if (divers.spotify_playlist_id) await removeFromPlaylist(memberId, divers.spotify_playlist_id, ids);
  for (const id of ids.slice(0, 3)) for (const bacId of chosen) await addExample(memberId, bacId, id, "positive");
  await syncMember(memberId);
  return ids.length;
}
