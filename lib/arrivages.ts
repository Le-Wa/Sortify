import "server-only";
import { listBacs } from "./bacs";
import { markFor, type SleeveMark } from "./cover-shapes";
import { check, db } from "./db";
import { weekKey } from "./dates";

/** Nombre de semaines montrées dans l'onglet Arrivages. */
export const WEEKS = 8;

export interface ArrivalTrack {
  track_id: string;
  title: string;
  artist: string;
  cover_url: string | null;
}

export interface ArrivalBac {
  id: string;
  name: string;
  sleeve: string;
  color: string;
  mark: SleeveMark;
  tracks: ArrivalTrack[];
}

export interface Week {
  key: string; // lundi, AAAA-MM-JJ
  total: number;
  bacs: ArrivalBac[]; // bacs qui ont reçu des titres, du plus servi au moins servi
  pending: number; // titres encore « À trier »
  divers: ArrivalTrack[];
}

/** Les likes des dernières semaines, regroupés par semaine (lundi → dimanche, heure de Paris) et par bac. */
export async function arrivals(memberId: string, now = new Date()): Promise<Week[]> {
  const start = new Date(weekKey(now));
  start.setUTCDate(start.getUTCDate() - 7 * (WEEKS - 1) - 1); // un jour de marge pour le fuseau
  const likes = check(
    await db()
      .from("likes")
      .select("track_id, title, artists, cover_url, liked_at")
      .eq("member_id", memberId)
      .eq("excluded", false)
      .is("unliked_at", null)
      .gte("liked_at", start.toISOString())
      .order("liked_at", { ascending: false })
      .limit(2000),
    "Lecture des arrivages",
  ) as { track_id: string; title: string; artists: string[]; cover_url: string | null; liked_at: string }[];
  const ids = likes.map((l) => l.track_id);

  const placements: { track_id: string; bac_id: string }[] = [];
  const pending = new Set<string>();
  for (let i = 0; i < ids.length; i += 300) {
    const slice = ids.slice(i, i + 300);
    const [p, q] = await Promise.all([
      db().from("placements").select("track_id, bac_id").eq("member_id", memberId).in("track_id", slice),
      db().from("pending").select("track_id").eq("member_id", memberId).in("track_id", slice),
    ]);
    placements.push(...(check(p, "Lecture des rangements") as { track_id: string; bac_id: string }[]));
    for (const r of check(q, "Lecture de « À trier »") as { track_id: string }[]) pending.add(r.track_id);
  }
  const bacs = new Map((await listBacs(memberId, ["active"])).map((b) => [b.id, b]));
  const bacsOf = new Map<string, string[]>();
  for (const p of placements) if (bacs.has(p.bac_id)) bacsOf.set(p.track_id, [...(bacsOf.get(p.track_id) ?? []), p.bac_id]);

  const weeks = new Map<string, Week>();
  for (let k = 0; k < WEEKS; k++) {
    const d = new Date(weekKey(now));
    d.setUTCDate(d.getUTCDate() - 7 * k);
    const key = d.toISOString().slice(0, 10);
    weeks.set(key, { key, total: 0, bacs: [], pending: 0, divers: [] });
  }
  const byBac = new Map<string, Map<string, ArrivalBac>>(); // semaine → bac → titres
  for (const like of likes) {
    const week = weeks.get(weekKey(new Date(like.liked_at)));
    if (!week) continue;
    week.total++;
    const track = { track_id: like.track_id, title: like.title, artist: like.artists[0] ?? "", cover_url: like.cover_url };
    const placed = bacsOf.get(like.track_id) ?? [];
    if (pending.has(like.track_id)) week.pending++;
    else if (placed.length === 0) week.divers.push(track);
    for (const id of placed) {
      const bac = bacs.get(id)!;
      const perWeek = byBac.get(week.key) ?? byBac.set(week.key, new Map()).get(week.key)!;
      const entry =
        perWeek.get(id) ??
        perWeek.set(id, { id, name: bac.name, sleeve: bac.sleeve_name ?? bac.name, color: bac.color, mark: markFor(bac), tracks: [] }).get(id)!;
      entry.tracks.push(track);
    }
  }
  for (const week of weeks.values()) week.bacs = [...(byBac.get(week.key)?.values() ?? [])].sort((a, b) => b.tracks.length - a.tracks.length);
  return [...weeks.values()];
}
