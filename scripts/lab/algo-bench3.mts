// Banc d'essai, 3e tour (11/10/2026) — plan pour l'algorithme, mesuré avant tout déploiement. Lecture seule.
// Compare au rangement actuel : genres Deezer en plus (si désaccord / toujours), fiches aux frontières rafraîchies,
// rangement en deux familles (scène / transversal), et 3 bacs transversaux de plus (simulés, rien n'est créé).
// Prérequis : scripts/lab/deezer-contradictions.mts <dossier> (genres Deezer de tous les likes).
// Usage : npm run try -- scripts/lab/algo-bench3.mts <dossier>
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { AXES } from "@/lib/ai/fiches";
import { sortTracks, type SortFiche, type SortOptions, type Sorted } from "@/lib/ai/sort";
import { ensureDivers, listBacs, sortFichesFor } from "@/lib/bacs";
import { claude, responseText } from "@/lib/claude";
import { loadCorpus, trackLine, type CorpusTrack } from "@/lib/corpus";
import { db } from "@/lib/db";
import { contradicts } from "./tag-families";

const out = process.argv[2];
const HIGH = 0.6, PLACE = 0.5, LOW = 0.4;
const OPUS = "claude-opus-5-5";
const cachePath = `${out}/algo-bench3-setup.json`;

const { data: member } = await db().from("members").select("spotify_id").limit(1).single();
const m = member!.spotify_id;
const bacs = await listBacs(m, ["active"]);
const fiches13 = await sortFichesFor(bacs);
const divers = await ensureDivers(m);
const corpus = await loadCorpus(m);
const byId = new Map(corpus.map((t) => [t.track_id, t]));
const { deezer, contradictions } = JSON.parse(readFileSync(`${out}/deezer-all.json`, "utf8")) as { deezer: Record<string, string[]>; contradictions: string[] };

// ── Échantillon fixe (graine), réutilisable : 160 titres hors exemples et hors Divers + 40 de Divers,
// plus une sonde de titres dont les tags Last.fm contredisent Deezer (40 au plus, hors échantillon).
function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = rng(20261011);
const shuffle = <T,>(a: T[]) => a.map((x) => [rand(), x] as const).sort((p, q) => p[0] - q[0]).map(([, x]) => x);
const { data: ex } = await db().from("bac_examples").select("track_id").eq("member_id", m);
const examples = new Set((ex ?? []).map((e) => e.track_id));
const { data: dv } = await db().from("placements").select("track_id").eq("bac_id", divers.id);
const inDivers = new Set((dv ?? []).map((d) => d.track_id));
const contra = new Set(contradictions);
const pool = corpus.filter((t) => !examples.has(t.track_id) && !contra.has(t.track_id));
const sampleIds = [...shuffle(pool.filter((t) => !inDivers.has(t.track_id))).slice(0, 160), ...shuffle(pool.filter((t) => inDivers.has(t.track_id))).slice(0, 40)].map((t) => t.track_id);
const probeIds = shuffle(corpus.filter((t) => contra.has(t.track_id) && !examples.has(t.track_id))).slice(0, 40).map((t) => t.track_id);
const allIds = [...sampleIds, ...probeIds];
const probe = new Set(probeIds);
console.log(`Échantillon ${sampleIds.length} + sonde ${probeIds.length} (tags contredits par Deezer)`);

// Variantes d'enrichissement des titres.
const base = allIds.map((id) => byId.get(id)!);
const addDeezer = (t: CorpusTrack, when: "contradiction" | "always"): CorpusTrack => {
  if (t.genres.some((g) => g.startsWith("deezer:"))) return t;
  const dz = deezer[t.track_id] ?? [];
  if (!dz.length || (when === "contradiction" && !contra.has(t.track_id))) return t;
  return { ...t, genres: [...t.genres.slice(0, 5), ...dz] };
};
const withContra = base.map((t) => addDeezer(t, "contradiction"));
const withAll = base.map((t) => addDeezer(t, "always"));

// ── Préparation par Opus (mise en cache) : fiches rafraîchies et bacs transversaux en plus.
interface Setup {
  refreshed13: SortFiche[];
  extra: SortFiche[];
  refreshed16: SortFiche[];
}
const ficheText = (f: SortFiche) => `### ${f.name} (${f.axis})\n${f.brief}`;

async function refresh(fiches: SortFiche[]): Promise<SortFiche[]> {
  const schema = z.object({ bacs: z.array(z.object({ name: z.string(), brief: z.string() })) });
  const msg = await claude().messages.create({
    model: OPUS,
    max_tokens: 16000,
    output_config: { effort: "medium", format: zodOutputFormat(schema) },
    system: `Tu tiens à jour les fiches des bacs (playlists) d'une personne. Des bacs ont été ajoutés, fusionnés ou retirés : certaines fiches citent, dans leurs frontières, des bacs qui n'existent plus, ou ignorent des bacs nouveaux.
Pour chaque fiche, réécris seulement les phrases de frontière (« À la frontière », « Dehors », « vont dans… ») pour qu'elles ne citent que des bacs de la liste ci-dessous, avec leur nom exact entre « », et qu'elles renvoient au bon voisin. Pour un bac de scène, tu peux ajouter qu'un titre peut AUSSI aller dans un bac transversal (ambiance / moment) qui lui correspond. Garde tout le reste mot pour mot. Renvoie toutes les fiches, dans le même ordre, avec leur nom exact.`,
    messages: [{ role: "user", content: fiches.map(ficheText).join("\n\n") }],
  });
  const parsed = schema.parse(JSON.parse(responseText(msg, "Fiches rafraîchies")));
  return fiches.map((f) => ({ ...f, brief: parsed.bacs.find((b) => b.name === f.name)?.brief ?? f.brief }));
}

async function proposeTransversal(fiches: SortFiche[]): Promise<SortFiche[]> {
  const schema = z.object({
    bacs: z.array(z.object({ name: z.string(), axis: z.enum(AXES), brief: z.string(), examples: z.array(z.number().int()) })),
  });
  const lines = corpus.map((t, i) => trackLine(t, i)).join("\n");
  const stream = claude().messages.stream({
    model: OPUS,
    max_tokens: 16000,
    output_config: { effort: "medium", format: zodOutputFormat(schema) },
    system: `Tu es un disquaire passionné. Voici les bacs actuels d'une personne (scènes surtout, et deux bacs d'ambiance) :

${fiches.map(ficheText).join("\n\n")}

Propose 3 bacs transversaux de plus (axe « ambiance » ou « moment »), qui traversent les scènes : chacun doit pouvoir accueillir des titres d'au moins 3 bacs de scène différents, et ne pas doubler « Groove joyeux » ni « Fin de nuit ». Pense usage et humeur (ex. : se concentrer, route de nuit, avant de sortir, dimanche…), d'après ce que la bibliothèque contient vraiment.
Pour chacun : name (1 à 4 mots, français), axis, brief (3 à 5 lignes : ce qui y va, de quelles scènes, critères d'énergie ou d'humeur, ce qui n'y va pas), examples (6 à 8 numéros de titres du corpus, de scènes variées).
Format du corpus : numéro | artistes — titre | année | tags | én da va ac.`,
    messages: [{ role: "user", content: `<titres>\n${lines}\n</titres>` }],
  });
  const parsed = schema.parse(JSON.parse(responseText(await stream.finalMessage(), "Bacs transversaux")));
  return parsed.bacs.map((b) => ({
    name: b.name,
    axis: b.axis,
    brief: b.brief,
    examples: b.examples.map((i) => corpus[i]).filter(Boolean).map((t) => `${t.artists[0]} — ${t.title}`),
    counterExamples: [],
  }));
}

let setup: Setup;
if (existsSync(cachePath)) setup = JSON.parse(readFileSync(cachePath, "utf8")) as Setup;
else {
  const [refreshed13, extra] = await Promise.all([refresh(fiches13), proposeTransversal(fiches13)]);
  const refreshed16 = await refresh([...fiches13, ...extra]);
  setup = { refreshed13, extra, refreshed16 };
  writeFileSync(cachePath, JSON.stringify(setup, null, 2));
}
console.log(`Bacs transversaux proposés : ${setup.extra.map((f) => `${f.name} (${f.axis})`).join(", ")}`);

// Noms de bacs disparus encore cités dans les fiches.
function staleRefs(fiches: SortFiche[]): string[] {
  const names = new Set(fiches.map((f) => f.name));
  const refs = fiches.flatMap((f) => [...f.brief.matchAll(/« ([^»]+) »/g)].map((r) => r[1].trim()));
  return [...new Set(refs.filter((r) => !names.has(r) && r.length < 30 && /^[A-ZÉ]/.test(r)))];
}
console.log(`Bacs disparus cités — actuelles : ${staleRefs(fiches13).join(", ") || "aucun"} · rafraîchies : ${staleRefs(setup.refreshed13).join(", ") || "aucun"} · 16 bacs : ${staleRefs(setup.refreshed16).join(", ") || "aucun"}`);

// ── Juge : Opus 5.5 effort élevé, sur les 16 bacs (fiches rafraîchies), avec Last.fm ET Deezer pour chaque titre.
const judgeSchema = z.object({ titres: z.array(z.object({ id: z.number().int(), bacs: z.array(z.number().int()) })) });
const judgeFiches = setup.refreshed16;
async function judge(tracks: CorpusTrack[]): Promise<Map<string, Set<number>>> {
  const res = new Map<string, Set<number>>();
  const BATCH = 25;
  const block = judgeFiches
    .map((x, i) => [`### Bac ${i + 1} — ${x.name} (${x.axis})`, x.brief, `Exemples : ${x.examples.join(" ; ")}`, x.counterExamples?.length ? `N'y vont pas : ${x.counterExamples.join(" ; ")}` : ""].filter(Boolean).join("\n"))
    .join("\n\n");
  await Promise.all(
    Array.from({ length: Math.ceil(tracks.length / BATCH) }, (_, k) => k * BATCH).map(async (start) => {
      const chunk = tracks.slice(start, start + BATCH);
      const msg = await claude().messages.create({
        model: OPUS,
        max_tokens: 16000,
        output_config: { effort: "high", format: zodOutputFormat(judgeSchema) },
        system: `Tu es un disquaire exigeant. Voici les bacs (playlists) d'une personne :\n\n${block}\n\nPour chaque titre, donne les numéros des bacs où il a clairement sa place selon les fiches (0 à 3) : son bac de scène s'il en a un, et les bacs d'ambiance ou de moment où il colle aussi. Liste vide si aucun bac ne lui convient vraiment (il ira dans « Divers »). Sois rigoureux : un titre ne va dans un bac que si un connaisseur qui lit la fiche l'y mettrait sans hésiter. Méfie-toi des tags : ce sont souvent ceux de l'artiste, parfois faux ; les tags « deezer: » sont les genres de l'album sur Deezer, grossiers mais propres au disque. Format : numéro | artistes — titre | année | tags | én da va ac.`,
        messages: [{ role: "user", content: chunk.map((t, i) => trackLine(t, start + i)).join("\n") }],
      });
      for (const r of judgeSchema.parse(JSON.parse(responseText(msg, "Juge"))).titres) {
        const t = tracks[r.id];
        if (t) res.set(t.track_id, new Set(r.bacs.filter((b) => b >= 1 && b <= judgeFiches.length).map((b) => b - 1)));
      }
    }),
  );
  return res;
}
const goldPath = `${out}/algo-bench3-gold.json`;
let gold: Map<string, Set<number>>;
if (existsSync(goldPath)) gold = new Map(Object.entries(JSON.parse(readFileSync(goldPath, "utf8")) as Record<string, number[]>).map(([k, v]) => [k, new Set(v)]));
else {
  gold = await judge(withAll);
  writeFileSync(goldPath, JSON.stringify(Object.fromEntries([...gold].map(([k, v]) => [k, [...v]]))));
}
console.log(`Juge : ${gold.size} titres, ${[...gold.values()].filter((g) => g.size === 0).length} en Divers`);

// ── Variantes (Sonnet 5.5 low, comme l'app)
interface Variant {
  name: string;
  fiches: SortFiche[];
  tracks: CorpusTrack[];
  opts: SortOptions;
}
const variants: Variant[] = [
  { name: "V0. actuel", fiches: fiches13, tracks: base, opts: {} },
  { name: "V0'. actuel, 2e passage", fiches: fiches13, tracks: base, opts: {} },
  { name: "V1. + Deezer si désaccord", fiches: fiches13, tracks: withContra, opts: {} },
  { name: "V2. + Deezer toujours", fiches: fiches13, tracks: withAll, opts: {} },
  { name: "V3. fiches rafraîchies", fiches: setup.refreshed13, tracks: base, opts: {} },
  { name: "V4. rafraîchies + deux familles", fiches: setup.refreshed13, tracks: base, opts: { families: true } },
  { name: "V5. 16 bacs, rafraîchies", fiches: setup.refreshed16, tracks: base, opts: {} },
  { name: "V6. 16 bacs, deux familles, Deezer si désaccord", fiches: setup.refreshed16, tracks: withContra, opts: { families: true } },
  { name: "V6'. idem, 2e passage", fiches: setup.refreshed16, tracks: withContra, opts: { families: true } },
];

const pct = (a: number, b: number) => (b ? Math.round((100 * a) / b) : 0);
const decide = (s: Sorted) => ((s.suggestions[0]?.confidence ?? 0) >= HIGH ? "rangé" : (s.suggestions[0]?.confidence ?? 0) >= LOW ? "à trier" : "divers");

function score(sorted: Sorted[], fiches: SortFiche[], ids: Set<string>) {
  // Les variantes à 13 bacs sont jugées sur les 13 premiers bacs du juge (même ordre).
  const n = fiches.length;
  const transversal = (b: number) => fiches[b].axis !== "scène";
  let placed = 0, pending = 0, div = 0, multi = 0, withTrans = 0, top1 = 0, top1N = 0, tp = 0, pairs = 0, goldPairs = 0, found = 0, divOk = 0, divN = 0;
  const rows = sorted.filter((s) => ids.has(s.track_id));
  for (const s of rows) {
    const g = new Set([...(gold.get(s.track_id) ?? [])].filter((b) => b < n));
    const top = s.suggestions[0]?.confidence ?? 0;
    const placedBacs = top >= HIGH ? s.suggestions.filter((x) => x.confidence >= PLACE).map((x) => x.bac) : [];
    const cand = s.suggestions.filter((x) => x.confidence >= LOW).map((x) => x.bac);
    const d = decide(s);
    if (d === "rangé") placed++;
    else if (d === "à trier") pending++;
    else div++;
    if (placedBacs.length > 1) multi++;
    if (placedBacs.some(transversal)) withTrans++;
    if (g.size && s.suggestions[0]) {
      top1N++;
      if (g.has(s.suggestions[0].bac)) top1++;
    }
    pairs += placedBacs.length;
    tp += placedBacs.filter((b) => g.has(b)).length;
    goldPairs += g.size;
    found += [...g].filter((b) => cand.includes(b)).length;
    if (g.size === 0) {
      divN++;
      if (top < LOW) divOk++;
    }
  }
  const N = rows.length;
  return { rangés: pct(placed, N), àTrier: pct(pending, N), divers: pct(div, N), multi: pct(multi, N), transversal: pct(withTrans, N), top1: pct(top1, top1N), précision: pct(tp, pairs), rappel: pct(found, goldPairs), accordDivers: pct(divOk, divN) };
}

const sampleSet = new Set(sampleIds);
const decisions: Record<string, Sorted[]> = {};
const results: Record<string, unknown>[] = [];
for (const v of variants) {
  const usage = { input: 0, output: 0 };
  const t0 = Date.now();
  const sorted = await sortTracks(v.fiches, v.tracks, undefined, { ...v.opts, usage });
  const seconds = Math.round((Date.now() - t0) / 1000);
  decisions[v.name] = sorted;
  const cost = Math.round(((usage.input * 2 + usage.output * 10) / 1e6) * 100) / 100;
  const row = { variante: v.name, s: seconds, $: cost, ...score(sorted, v.fiches, sampleSet), sonde_top1: score(sorted, v.fiches, probe).top1, sonde_précision: score(sorted, v.fiches, probe).précision };
  results.push(row);
  console.log(JSON.stringify(row));
}

function stability(a: string, b: string) {
  const first = new Map(decisions[a].map((s) => [s.track_id, s]));
  let same = 0, sameTop = 0;
  for (const s of decisions[b]) {
    const o = first.get(s.track_id)!;
    if (decide(o) === decide(s)) same++;
    if ((o.suggestions[0]?.bac ?? -1) === (s.suggestions[0]?.bac ?? -1)) sameTop++;
  }
  return { mêmeDécision: pct(same, decisions[b].length), même1erBac: pct(sameTop, decisions[b].length) };
}

// Détail de la sonde : actuel contre V6, pour lire les cas.
const label = (fiches: SortFiche[], s: Sorted | undefined) => s?.suggestions.map((x) => `${fiches[x.bac].name} ${x.confidence}`).join(", ") || "Divers";
const probeDetail = probeIds.map((id) => {
  const t = byId.get(id)!;
  return `${t.artists[0]} — ${t.title} | lastfm: ${t.genres.slice(0, 4).join(", ")} | ${(deezer[id] ?? []).join(", ")}\n   actuel → ${label(fiches13, decisions["V0. actuel"].find((s) => s.track_id === id))}\n   V6 → ${label(setup.refreshed16, decisions[variants[7].name].find((s) => s.track_id === id))}\n   juge → ${[...(gold.get(id) ?? [])].map((b) => judgeFiches[b].name).join(", ") || "Divers"}`;
});

const report = { results, stabilitéActuel: stability(variants[0].name, variants[1].name), stabilitéV6: stability(variants[7].name, variants[8].name), extra: setup.extra, stale: { actuelles: staleRefs(fiches13), rafraîchies: staleRefs(setup.refreshed13) } };
writeFileSync(`${out}/algo-bench3.json`, JSON.stringify({ report, sampleIds, probeIds, decisions }, null, 2));
writeFileSync(`${out}/algo-bench3-sonde.txt`, probeDetail.join("\n"));
console.log("\n", JSON.stringify(report.stabilitéActuel), JSON.stringify(report.stabilitéV6));
