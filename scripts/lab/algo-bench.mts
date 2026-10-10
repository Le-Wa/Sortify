// Banc d'essai — algorithme de rangement comparé à un juge IA (lecture seule : rien n'est écrit en base ni dans Spotify).
// Usage : npm run try scripts/lab/algo-bench.mts <dossier sortie>
import { writeFileSync } from "node:fs";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { sortTracks, type SortFiche, type SortOptions, type Sorted } from "@/lib/ai/sort";
import { ensureDivers, listBacs, sortFichesFor } from "@/lib/bacs";
import { claude, responseText } from "@/lib/claude";
import { loadCorpus, trackLine, type CorpusTrack } from "@/lib/corpus";
import { db } from "@/lib/db";

const out = process.argv[2];
const HIGH = 0.6;
const PLACE = 0.5;
const LOW = 0.4;
const PRICE: Record<string, [number, number]> = {
  "claude-haiku-5-5": [0.1, 0.5],
  "claude-sonnet-5-5": [2, 10],
  "claude-opus-5-5": [4, 20],
};

const { data: member } = await db().from("members").select("spotify_id").limit(1).single();
const m = member!.spotify_id;
const bacs = await listBacs(m, ["active"]);
const fiches = await sortFichesFor(bacs);
const divers = await ensureDivers(m);
const corpus = await loadCorpus(m);

// Échantillon : 160 titres au hasard (hors exemples des fiches) + 40 titres de Divers.
const { data: ex } = await db().from("bac_examples").select("track_id").eq("member_id", m);
const examples = new Set((ex ?? []).map((e) => e.track_id));
const { data: dv } = await db().from("placements").select("track_id").eq("bac_id", divers.id);
const inDivers = new Set((dv ?? []).map((d) => d.track_id));
const shuffle = <T,>(a: T[]) => [...a].sort(() => Math.random() - 0.5);
const pool = corpus.filter((t) => !examples.has(t.track_id));
const sample = [...shuffle(pool.filter((t) => !inDivers.has(t.track_id))).slice(0, 160), ...shuffle(pool.filter((t) => inDivers.has(t.track_id))).slice(0, 40)];
console.log(`Échantillon : ${sample.length} titres (${sample.filter((t) => inDivers.has(t.track_id)).length} de Divers), ${bacs.length} bacs`);

// Genres Deezer pour les titres sans tag (variante « + Deezer » et juge).
async function deezerGenres(isrc: string | null): Promise<string[]> {
  if (!isrc) return [];
  const tr = (await (await fetch(`https://api.deezer.com/track/isrc:${isrc}`)).json()) as { album?: { id?: number } };
  if (!tr.album?.id) return [];
  const al = (await (await fetch(`https://api.deezer.com/album/${tr.album.id}`)).json()) as { genres?: { data: { name: string }[] } };
  return al.genres?.data.map((g) => g.name.toLowerCase()) ?? [];
}
const { data: isrcRows } = await db().from("likes").select("track_id, isrc").eq("member_id", m).in("track_id", sample.map((t) => t.track_id));
const isrc = new Map((isrcRows ?? []).map((r) => [r.track_id, r.isrc as string | null]));
const withDeezer: CorpusTrack[] = [];
for (const t of sample) {
  if (t.genres.length > 0) withDeezer.push(t);
  else {
    withDeezer.push({ ...t, genres: (await deezerGenres(isrc.get(t.track_id) ?? null)).map((g) => `deezer:${g}`) });
    await new Promise((r) => setTimeout(r, 120));
  }
}
const untagged = sample.filter((t) => t.genres.length === 0).length;
console.log(`Sans tag : ${untagged}, dont ${withDeezer.filter((t, i) => sample[i].genres.length === 0 && t.genres.length > 0).length} complétés par Deezer`);

// ── Juge : Opus 5.5, effort élevé, range indépendamment chaque titre (0 à 3 bacs).
const judgeSchema = z.object({ titres: z.array(z.object({ id: z.number().int(), bacs: z.array(z.number().int()) })) });
function fichesBlock(f: SortFiche[]) {
  return f
    .map((x, i) => [`### Bac ${i + 1} — ${x.name} (${x.axis})`, x.brief, `Exemples : ${x.examples.join(" ; ")}`, x.counterExamples?.length ? `N'y vont pas : ${x.counterExamples.join(" ; ")}` : ""].filter(Boolean).join("\n"))
    .join("\n\n");
}
const judgeUsage = { input: 0, output: 0 };
async function judge(tracks: CorpusTrack[]): Promise<Map<string, Set<number>>> {
  const res = new Map<string, Set<number>>();
  const BATCH = 25;
  const batches = Array.from({ length: Math.ceil(tracks.length / BATCH) }, (_, k) => k * BATCH);
  await Promise.all(
    batches.map(async (start) => {
      const chunk = tracks.slice(start, start + BATCH);
      const msg = await claude().messages.create({
        model: "claude-opus-5-5",
        max_tokens: 16000,
        output_config: { effort: "high", format: zodOutputFormat(judgeSchema) },
        system: `Tu es un disquaire exigeant. Voici les bacs (playlists) d'une personne :\n\n${fichesBlock(fiches)}\n\nPour chaque titre, donne les numéros des bacs où il a clairement sa place selon les fiches (0 à 3). Liste vide si aucun bac ne lui convient vraiment (il ira dans « Divers »). Sois rigoureux : un titre ne va dans un bac que si un connaisseur qui lit la fiche l'y mettrait sans hésiter. Format : numéro | artistes — titre | année | tags | én da va ac (les tags « deezer: » sont des genres d'album Deezer, plus grossiers).`,
        messages: [{ role: "user", content: chunk.map((t, i) => trackLine(t, start + i)).join("\n") }],
      });
      judgeUsage.input += msg.usage.input_tokens;
      judgeUsage.output += msg.usage.output_tokens;
      const parsed = judgeSchema.parse(JSON.parse(responseText(msg, "Juge")));
      for (const r of parsed.titres) {
        const t = tracks[r.id];
        if (t) res.set(t.track_id, new Set(r.bacs.filter((b) => b >= 1 && b <= fiches.length).map((b) => b - 1)));
      }
    }),
  );
  return res;
}

let t0 = Date.now();
const gold = await judge(withDeezer);
const judgeTime = (Date.now() - t0) / 1000;
console.log(`Juge : ${gold.size} titres en ${judgeTime.toFixed(0)} s`);

// ── Variantes
interface Variant {
  name: string;
  tracks: CorpusTrack[];
  opts: SortOptions;
}
const strip = (t: CorpusTrack): CorpusTrack => ({ ...t, genres: [], audio: null });
const variants: Variant[] = [
  { name: "A. Haiku low, lots de 20", tracks: sample, opts: { model: "claude-haiku-5-5" } },
  { name: "A'. idem, 2e passage (stabilité)", tracks: sample, opts: { model: "claude-haiku-5-5" } },
  { name: "B. Haiku medium", tracks: sample, opts: { model: "claude-haiku-5-5", effort: "medium" } },
  { name: "C. Sonnet 5.5 low (défaut depuis le banc)", tracks: sample, opts: { model: "claude-sonnet-5-5" } },
  { name: "D. Haiku low, lots de 5", tracks: sample, opts: { model: "claude-haiku-5-5", batch: 5 } },
  { name: "E. Haiku low, sans tags ni audio", tracks: sample.map(strip), opts: { model: "claude-haiku-5-5" } },
  { name: "F. Haiku low + Deezer si sans tag", tracks: withDeezer, opts: { model: "claude-haiku-5-5" } },
];

interface Scores {
  name: string;
  seconds: number;
  cost: number;
  placed: number;
  pending: number;
  divers: number;
  multi: number;
  top1: number;
  precision: number;
  recall: number;
  diversAgree: number;
}
const decisions: Record<string, Sorted[]> = {};
const scores: Scores[] = [];

function score(name: string, sorted: Sorted[], seconds: number, cost: number): Scores {
  let placed = 0, pending = 0, toDivers = 0, multi = 0, top1Hit = 0, top1N = 0, tp = 0, placedPairs = 0, goldPairs = 0, goldFound = 0, divAgree = 0, divN = 0;
  for (const s of sorted) {
    const g = gold.get(s.track_id) ?? new Set<number>();
    const top = s.suggestions[0]?.confidence ?? 0;
    const placedBacs = top >= HIGH ? s.suggestions.filter((x) => x.confidence >= PLACE).map((x) => x.bac) : [];
    const candidate = s.suggestions.filter((x) => x.confidence >= LOW).map((x) => x.bac);
    if (placedBacs.length) placed++;
    else if (top >= LOW) pending++;
    else toDivers++;
    if (placedBacs.length > 1) multi++;
    if (g.size && s.suggestions[0]) {
      top1N++;
      if (g.has(s.suggestions[0].bac)) top1Hit++;
    }
    placedPairs += placedBacs.length;
    tp += placedBacs.filter((b) => g.has(b)).length;
    goldPairs += g.size;
    goldFound += [...g].filter((b) => candidate.includes(b)).length;
    if (g.size === 0) {
      divN++;
      if (top < LOW) divAgree++;
    }
  }
  const pct = (a: number, b: number) => (b ? Math.round((100 * a) / b) : 0);
  const n = sorted.length;
  return {
    name,
    seconds: Math.round(seconds),
    cost: Math.round(cost * 1000) / 1000,
    placed: pct(placed, n),
    pending: pct(pending, n),
    divers: pct(toDivers, n),
    multi: pct(multi, n),
    top1: pct(top1Hit, top1N),
    precision: pct(tp, placedPairs),
    recall: pct(goldFound, goldPairs),
    diversAgree: pct(divAgree, divN),
  };
}

for (const v of variants) {
  const usage = { input: 0, output: 0 };
  t0 = Date.now();
  const sorted = await sortTracks(fiches, v.tracks, undefined, { ...v.opts, usage });
  const seconds = (Date.now() - t0) / 1000;
  const [pin, pout] = PRICE[v.opts.model ?? "claude-sonnet-5-5"];
  const cost = (usage.input * pin + usage.output * pout) / 1e6;
  decisions[v.name] = sorted;
  scores.push(score(v.name, sorted, seconds, cost));
  console.log(`${v.name} : ${seconds.toFixed(0)} s`);
}

// Stabilité : A vs A'
const a = new Map(decisions[variants[0].name].map((s) => [s.track_id, s]));
let sameTop = 0, sameDecision = 0;
const decide = (s: Sorted) => ((s.suggestions[0]?.confidence ?? 0) >= HIGH ? "rangé" : (s.suggestions[0]?.confidence ?? 0) >= LOW ? "à trier" : "divers");
for (const s of decisions[variants[1].name]) {
  const o = a.get(s.track_id)!;
  if ((o.suggestions[0]?.bac ?? -1) === (s.suggestions[0]?.bac ?? -1)) sameTop++;
  if (decide(o) === decide(s)) sameDecision++;
}

// Calibration de la variante actuelle : confiance du 1er choix vs accord du juge.
const calib: { bucket: string; n: number; agree: number }[] = [];
for (const [lo, hi] of [[0.3, 0.5], [0.5, 0.6], [0.6, 0.7], [0.7, 0.8], [0.8, 0.9], [0.9, 1.01]]) {
  const inB = decisions[variants[0].name].filter((s) => (s.suggestions[0]?.confidence ?? 0) >= lo && (s.suggestions[0]?.confidence ?? 0) < hi);
  const ok = inB.filter((s) => gold.get(s.track_id)?.has(s.suggestions[0].bac)).length;
  calib.push({ bucket: `${lo}–${Math.min(hi, 1)}`, n: inB.length, agree: inB.length ? Math.round((100 * ok) / inB.length) : 0 });
}

// Désaccords typiques (variante actuelle vs juge), pour comprendre les erreurs.
const names = fiches.map((f) => f.name);
const errors = decisions[variants[0].name]
  .filter((s) => {
    const g = gold.get(s.track_id) ?? new Set();
    const top = s.suggestions[0];
    return top && top.confidence >= HIGH && !g.has(top.bac);
  })
  .slice(0, 15)
  .map((s) => {
    const t = sample.find((x) => x.track_id === s.track_id)!;
    return `${t.artists[0]} — ${t.title} [${t.genres.slice(0, 3).join(", ") || "sans tag"}] : IA → ${s.suggestions.map((x) => `${names[x.bac]} ${x.confidence}`).join(", ")} | juge → ${[...(gold.get(s.track_id) ?? [])].map((b) => names[b]).join(", ") || "Divers"}`;
  });

const judgeCost = (judgeUsage.input * 4 + judgeUsage.output * 20) / 1e6;
const report = { scores, stability: { sameTop: Math.round((100 * sameTop) / sample.length), sameDecision: Math.round((100 * sameDecision) / sample.length) }, calib, errors, judge: { seconds: Math.round(judgeTime), cost: Math.round(judgeCost * 100) / 100, divers: [...gold.values()].filter((g) => g.size === 0).length } };
writeFileSync(`${out}/algo-bench.json`, JSON.stringify({ report, sample: sample.map((t) => t.track_id), gold: Object.fromEntries([...gold].map(([k, v]) => [k, [...v]])), decisions }, null, 2));

console.log("\nVariante | s | $ | rangés | à trier | divers | multi | top1 | précision | rappel | accord Divers");
for (const s of scores) console.log(`${s.name} | ${s.seconds} | ${s.cost} | ${s.placed} | ${s.pending} | ${s.divers} | ${s.multi} | ${s.top1} | ${s.precision} | ${s.recall} | ${s.diversAgree}`);
console.log("\nStabilité A/A' :", report.stability, "\nCalibration A :", calib, "\nJuge :", report.judge, "\nErreurs typiques :\n" + errors.join("\n"));
