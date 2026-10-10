// Banc d'essai — fiabilité du juge : un second juge (Fable 5.1) range le même échantillon ; on mesure l'accord avec Opus.
// Usage : npm run try scripts/lab/judge-check.mts <dossier sortie> (après algo-bench.mts)
import { readFileSync, writeFileSync } from "node:fs";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { listBacs, sortFichesFor } from "@/lib/bacs";
import { claude, responseText } from "@/lib/claude";
import { loadCorpus, trackLine } from "@/lib/corpus";
import { db } from "@/lib/db";

const out = process.argv[2];
const bench = JSON.parse(readFileSync(`${out}/algo-bench.json`, "utf8")) as { sample: string[]; gold: Record<string, number[]> };
const { data: member } = await db().from("members").select("spotify_id").limit(1).single();
const m = member!.spotify_id;
const fiches = await sortFichesFor(await listBacs(m, ["active"]));
const byId = new Map((await loadCorpus(m)).map((t) => [t.track_id, t]));
const tracks = bench.sample.map((id) => byId.get(id)!).filter(Boolean);

const schema = z.object({ titres: z.array(z.object({ id: z.number().int(), bacs: z.array(z.number().int()) })) });
const block = fiches
  .map((x, i) => [`### Bac ${i + 1} — ${x.name} (${x.axis})`, x.brief, `Exemples : ${x.examples.join(" ; ")}`].join("\n"))
  .join("\n\n");
const second = new Map<string, Set<number>>();
const BATCH = 50;
await Promise.all(
  Array.from({ length: Math.ceil(tracks.length / BATCH) }, (_, k) => k * BATCH).map(async (start) => {
    const chunk = tracks.slice(start, start + BATCH);
    const msg = await claude()
      .beta.messages.stream({
        model: "claude-fable-5-1",
        max_tokens: 32000,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        output_config: { effort: "medium", format: zodOutputFormat(schema) },
        system: `Tu es un disquaire exigeant. Voici les bacs (playlists) d'une personne :\n\n${block}\n\nPour chaque titre, donne les numéros des bacs où il a clairement sa place selon les fiches (0 à 3). Liste vide si aucun ne lui convient vraiment. Format : numéro | artistes — titre | année | tags | én da va ac.`,
        messages: [{ role: "user", content: chunk.map((t, i) => trackLine(t, start + i)).join("\n") }],
      })
      .finalMessage();
    for (const r of schema.parse(JSON.parse(responseText(msg, "Second juge"))).titres) {
      const t = chunk[r.id - start];
      if (t) second.set(t.track_id, new Set(r.bacs.filter((b) => b >= 1 && b <= fiches.length).map((b) => b - 1)));
    }
  }),
);

let pairsA = 0, pairsB = 0, common = 0, sameEmpty = 0, emptyA = 0, overlap = 0;
for (const t of tracks) {
  const a = new Set(bench.gold[t.track_id] ?? []);
  const b = second.get(t.track_id) ?? new Set<number>();
  pairsA += a.size;
  pairsB += b.size;
  common += [...a].filter((x) => b.has(x)).length;
  if (a.size === 0) {
    emptyA++;
    if (b.size === 0) sameEmpty++;
  }
  if ((a.size === 0 && b.size === 0) || [...a].some((x) => b.has(x))) overlap++;
}
const pct = (x: number, y: number) => Math.round((100 * x) / y);
const result = {
  titres: tracks.length,
  "accord sur au moins un bac (ou Divers des deux côtés)": `${pct(overlap, tracks.length)} %`,
  "paires Opus retrouvées par Fable": `${pct(common, pairsA)} %`,
  "paires Fable retrouvées par Opus": `${pct(common, pairsB)} %`,
  "Divers d'Opus confirmés par Fable": `${sameEmpty} / ${emptyA}`,
  "bacs par titre (Opus / Fable)": `${(pairsA / tracks.length).toFixed(2)} / ${(pairsB / tracks.length).toFixed(2)}`,
};
writeFileSync(`${out}/judge-check.json`, JSON.stringify({ result, second: Object.fromEntries([...second].map(([k, v]) => [k, [...v]])) }, null, 2));
console.log(result);
