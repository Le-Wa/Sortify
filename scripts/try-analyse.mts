// Essai de l'analyse sur une vraie bibliothèque (hors app). Usage : tsx --conditions=react-server scripts/try-analyse.ts <dossier sortie>
import { writeFileSync } from "node:fs";
import { proposeFiches } from "@/lib/ai/fiches";
import { sortTracks } from "@/lib/ai/sort";
import { loadCorpus, sampleCorpus } from "@/lib/corpus";
import { db } from "@/lib/db";

const out = process.argv[2];
const { data: member } = await db().from("members").select("spotify_id").limit(1).single();
const corpus = sampleCorpus(await loadCorpus(member!.spotify_id));
console.log("corpus", corpus.length);

let t = Date.now();
const fiches = await proposeFiches(corpus);
console.log(`fiches: ${fiches.length} en ${((Date.now() - t) / 1000).toFixed(0)} s`);
writeFileSync(`${out}/fiches.json`, JSON.stringify(fiches, null, 2));

t = Date.now();
const sorted = await sortTracks(
  fiches.map((f) => ({
    name: f.name,
    axis: f.axis,
    brief: f.brief,
    examples: f.examples.map((i) => `${corpus[i].artists[0]} — ${corpus[i].title}`),
  })),
  corpus,
);
console.log(`rangement: ${sorted.length} titres en ${((Date.now() - t) / 1000).toFixed(0)} s`);
writeFileSync(`${out}/sorted.json`, JSON.stringify(sorted));

for (const threshold of [0.5, 0.6, 0.7]) {
  const placed = sorted.map((s) => s.suggestions.filter((x) => x.confidence >= threshold));
  const covered = placed.filter((p) => p.length > 0).length;
  const multi = placed.filter((p) => p.length > 1).length;
  console.log(`seuil ${threshold}: couverture ${((covered / sorted.length) * 100).toFixed(0)} %, multi ${((multi / sorted.length) * 100).toFixed(0)} %`);
}
fiches.forEach((f, i) => {
  const n = sorted.filter((s) => s.suggestions.some((x) => x.bac === i && x.confidence >= 0.6)).length;
  console.log(`${String(n).padStart(4)}  ${f.name} (${f.axis}) — ${f.pitch}`);
});
