// Essai des retouches de la proposition, sans rien écrire en base.
import { alternativeFiche, customFiche, mergedFiche } from "@/lib/ai/fiches";
import { listBacs } from "@/lib/bacs";
import { loadCorpus, sampleCorpus } from "@/lib/corpus";
import { db } from "@/lib/db";

const { data: member } = await db().from("members").select("spotify_id").limit(1).single();
const id = member!.spotify_id;
const corpus = sampleCorpus(await loadCorpus(id));
const bacs = (await listBacs(id, ["proposed"])).map((b) => ({ name: b.name, pitch: b.pitch, axis: b.axis }));
const show = (label: string, f: { name: string; pitch: string; axis: string; examples: number[] }, t: number) =>
  console.log(`${label} (${((Date.now() - t) / 1000).toFixed(0)} s) → ${f.name} [${f.axis}] — ${f.pitch}\n   ex: ${f.examples.map((i) => `${corpus[i].artists[0]} — ${corpus[i].title}`).join(" ; ")}`);

let t = Date.now();
show(`Autre idée pour « ${bacs[9].name} »`, await alternativeFiche(bacs[9], bacs.filter((_, i) => i !== 9), corpus), t);
t = Date.now();
show(`Fusion « ${bacs[4].name} » + « ${bacs[0].name} »`, await mergedFiche(bacs[4], bacs[0], bacs.filter((_, i) => i !== 4 && i !== 0), corpus), t);
t = Date.now();
show("Sur mesure « du jazz pour cuisiner le dimanche »", await customFiche("du jazz pour cuisiner le dimanche", bacs, corpus), t);
