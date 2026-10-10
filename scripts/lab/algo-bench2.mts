// Banc d'essai, 2e tour — variantes prometteuses sur le MÊME échantillon et le même juge que algo-bench.mts.
// Usage : npm run try scripts/lab/algo-bench2.mts <dossier sortie>
import { readFileSync, writeFileSync } from "node:fs";
import { sortTracks, type SortOptions, type Sorted } from "@/lib/ai/sort";
import { listBacs, sortFichesFor } from "@/lib/bacs";
import { loadCorpus, type CorpusTrack } from "@/lib/corpus";
import { db } from "@/lib/db";

const out = process.argv[2];
const bench = JSON.parse(readFileSync(`${out}/algo-bench.json`, "utf8")) as { sample: string[]; gold: Record<string, number[]> };
const gold = new Map(Object.entries(bench.gold).map(([k, v]) => [k, new Set(v)]));
const { data: member } = await db().from("members").select("spotify_id").limit(1).single();
const m = member!.spotify_id;
const fiches = await sortFichesFor(await listBacs(m, ["active"]));
const byId = new Map((await loadCorpus(m)).map((t) => [t.track_id, t]));
const sample = bench.sample.map((id) => byId.get(id)!).filter(Boolean);

const { data: isrcRows } = await db().from("likes").select("track_id, isrc").eq("member_id", m).in("track_id", bench.sample);
const isrc = new Map((isrcRows ?? []).map((r) => [r.track_id, r.isrc as string | null]));
async function deezer(code: string | null): Promise<string[]> {
  if (!code) return [];
  const tr = (await (await fetch(`https://api.deezer.com/track/isrc:${code}`)).json()) as { album?: { id?: number } };
  if (!tr.album?.id) return [];
  const al = (await (await fetch(`https://api.deezer.com/album/${tr.album.id}`)).json()) as { genres?: { data: { name: string }[] } };
  return al.genres?.data.map((g) => `deezer:${g.name.toLowerCase()}`) ?? [];
}
const withDeezer: CorpusTrack[] = [];
for (const t of sample) withDeezer.push(t.genres.length ? t : { ...t, genres: await deezer(isrc.get(t.track_id) ?? null) });

const PRICE: Record<string, [number, number]> = { "claude-haiku-5-5": [0.1, 0.5], "claude-sonnet-5-5": [2, 10] };
const variants: { name: string; tracks: CorpusTrack[]; opts: SortOptions }[] = [
  { name: "C. Sonnet low", tracks: sample, opts: { model: "claude-sonnet-5-5" } },
  { name: "C'. Sonnet low, 2e passage", tracks: sample, opts: { model: "claude-sonnet-5-5" } },
  { name: "G. Sonnet low + Deezer", tracks: withDeezer, opts: { model: "claude-sonnet-5-5" } },
  { name: "H. Sonnet medium + Deezer", tracks: withDeezer, opts: { model: "claude-sonnet-5-5", effort: "medium" } },
  { name: "I. Haiku medium + Deezer", tracks: withDeezer, opts: { model: "claude-haiku-5-5", effort: "medium" } },
];

const pct = (a: number, b: number) => (b ? Math.round((100 * a) / b) : 0);
const decide = (s: Sorted, high: number) => ((s.suggestions[0]?.confidence ?? 0) >= high ? "rangé" : (s.suggestions[0]?.confidence ?? 0) >= 0.4 ? "à trier" : "divers");
function score(sorted: Sorted[], high: number) {
  let placed = 0, pending = 0, div = 0, multi = 0, top1 = 0, top1N = 0, tp = 0, pairs = 0, goldPairs = 0, found = 0, divOk = 0, divN = 0;
  for (const s of sorted) {
    const g = gold.get(s.track_id) ?? new Set<number>();
    const top = s.suggestions[0]?.confidence ?? 0;
    const placedBacs = top >= high ? s.suggestions.filter((x) => x.confidence >= 0.5).map((x) => x.bac) : [];
    const cand = s.suggestions.filter((x) => x.confidence >= 0.4).map((x) => x.bac);
    const d = decide(s, high);
    if (d === "rangé") placed++;
    else if (d === "à trier") pending++;
    else div++;
    if (placedBacs.length > 1) multi++;
    if (g.size && s.suggestions[0]) {
      top1N++;
      if (g.has(s.suggestions[0].bac)) top1++;
    }
    pairs += placedBacs.length;
    tp += placedBacs.filter((b) => g.has(b)).length;
    goldPairs += g.size;
    found += [...g].filter((b) => cand.includes(b)).length;
    if (!g.size) {
      divN++;
      if (top < 0.4) divOk++;
    }
  }
  const n = sorted.length;
  return { rangés: pct(placed, n), "à trier": pct(pending, n), divers: pct(div, n), multi: pct(multi, n), top1: pct(top1, top1N), précision: pct(tp, pairs), rappel: pct(found, goldPairs), "accord Divers": pct(divOk, divN) };
}
function calibration(sorted: Sorted[]) {
  return [[0.3, 0.5], [0.5, 0.6], [0.6, 0.7], [0.7, 0.8], [0.8, 0.9], [0.9, 1.01]].map(([lo, hi]) => {
    const inB = sorted.filter((s) => (s.suggestions[0]?.confidence ?? 0) >= lo && (s.suggestions[0]?.confidence ?? 0) < hi);
    return `${lo}–${Math.min(hi, 1)} : ${inB.length} titres, ${pct(inB.filter((s) => gold.get(s.track_id)?.has(s.suggestions[0].bac)).length, inB.length)} % d'accord`;
  });
}

const decisions: Record<string, Sorted[]> = {};
const rows: Record<string, unknown>[] = [];
for (const v of variants) {
  const usage = { input: 0, output: 0 };
  const t0 = Date.now();
  const sorted = await sortTracks(fiches, v.tracks, undefined, { ...v.opts, usage });
  const [pin, pout] = PRICE[v.opts.model ?? "claude-sonnet-5-5"];
  decisions[v.name] = sorted;
  for (const high of [0.6, 0.7]) {
    rows.push({ variante: v.name, seuil: high, s: Math.round((Date.now() - t0) / 1000), "$": Math.round(((usage.input * pin + usage.output * pout) / 1e6) * 1000) / 1000, ...score(sorted, high) });
  }
  console.log(`${v.name} fini`);
}
const a = new Map(decisions[variants[0].name].map((s) => [s.track_id, s]));
const same = decisions[variants[1].name].filter((s) => decide(s, 0.6) === decide(a.get(s.track_id)!, 0.6)).length;
const sameTop = decisions[variants[1].name].filter((s) => (s.suggestions[0]?.bac ?? -1) === (a.get(s.track_id)!.suggestions[0]?.bac ?? -1)).length;

writeFileSync(`${out}/algo-bench2.json`, JSON.stringify({ rows, decisions }, null, 2));
console.table(rows);
console.log("Stabilité Sonnet :", { mêmeDécision: pct(same, sample.length), mêmePremierBac: pct(sameTop, sample.length) });
console.log("Calibration Sonnet low :", calibration(decisions[variants[0].name]));
console.log("Calibration Sonnet low + Deezer :", calibration(decisions[variants[2].name]));
