// Banc d'essai — ajouter les genres Deezer à TOUS les titres (pas seulement en repli) aide-t-il Sonnet ?
// Même échantillon et même juge que algo-bench.mts. Usage : npm run try scripts/lab/deezer-all.mts <dossier>
import { readFileSync, writeFileSync } from "node:fs";
import { sortTracks, type Sorted } from "@/lib/ai/sort";
import { listBacs, sortFichesFor } from "@/lib/bacs";
import { loadCorpus, type CorpusTrack } from "@/lib/corpus";
import { db } from "@/lib/db";
import { deezerGenres } from "@/lib/enrichment/deezer";

const out = process.argv[2];
const bench = JSON.parse(readFileSync(`${out}/algo-bench.json`, "utf8")) as { sample: string[]; gold: Record<string, number[]> };
const gold = new Map(Object.entries(bench.gold).map(([k, v]) => [k, new Set(v)]));
const { data: member } = await db().from("members").select("spotify_id").limit(1).single();
const m = member!.spotify_id;
const fiches = await sortFichesFor(await listBacs(m, ["active"]));
const byId = new Map((await loadCorpus(m)).map((t) => [t.track_id, t]));
// Note : depuis le repli Deezer, les titres sans tag Last.fm ont déjà leurs genres « deezer: ».
const base = bench.sample.map((id) => byId.get(id)!).filter(Boolean);
const { data: rows } = await db().from("likes").select("track_id, isrc").eq("member_id", m).in("track_id", bench.sample);
const isrc = new Map((rows ?? []).map((r) => [r.track_id, r.isrc as string | null]));
const enriched: CorpusTrack[] = [];
for (const t of base) {
  if (t.genres.some((g) => g.startsWith("deezer:"))) enriched.push(t);
  else enriched.push({ ...t, genres: [...t.genres, ...(await deezerGenres(isrc.get(t.track_id) ?? null))] });
}
console.log(`Titres avec genres Deezer : ${enriched.filter((t) => t.genres.some((g) => g.startsWith("deezer:"))).length} / ${enriched.length}`);

const pct = (a: number, b: number) => (b ? Math.round((100 * a) / b) : 0);
function score(sorted: Sorted[]) {
  let top1 = 0, n1 = 0, tp = 0, pairs = 0, gp = 0, found = 0, pending = 0, div = 0;
  for (const s of sorted) {
    const g = gold.get(s.track_id) ?? new Set<number>();
    const top = s.suggestions[0]?.confidence ?? 0;
    const placed = top >= 0.6 ? s.suggestions.filter((x) => x.confidence >= 0.5).map((x) => x.bac) : [];
    if (!placed.length && top >= 0.4) pending++;
    if (top < 0.4) div++;
    if (g.size && s.suggestions[0]) {
      n1++;
      if (g.has(s.suggestions[0].bac)) top1++;
    }
    pairs += placed.length;
    tp += placed.filter((b) => g.has(b)).length;
    gp += g.size;
    found += [...g].filter((b) => s.suggestions.some((x) => x.bac === b && x.confidence >= 0.4)).length;
  }
  return { top1: pct(top1, n1), précision: pct(tp, pairs), rappel: pct(found, gp), "à trier": pct(pending, sorted.length), divers: pct(div, sorted.length) };
}
const results: Record<string, unknown> = {};
for (const [label, tracks] of [
  ["Last.fm (+ Deezer en repli) — actuel", base],
  ["Last.fm + Deezer pour tous", enriched],
  ["Last.fm (+ repli), 2e passage", base],
  ["Last.fm + Deezer pour tous, 2e passage", enriched],
] as const) {
  results[label] = score(await sortTracks(fiches, tracks));
  console.log(label, results[label]);
}
writeFileSync(`${out}/deezer-all.json`, JSON.stringify(results, null, 2));
