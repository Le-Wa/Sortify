// Vérification rapide du rangement par défaut (modèle et appel de l'app), sur 10 titres, sans écriture.
import { sortTracks } from "@/lib/ai/sort";
import { listBacs, sortFichesFor } from "@/lib/bacs";
import { loadCorpus } from "@/lib/corpus";
import { db } from "@/lib/db";

const { data: member } = await db().from("members").select("spotify_id").limit(1).single();
const m = member!.spotify_id;
const bacs = await listBacs(m, ["active"]);
const tracks = (await loadCorpus(m)).filter((t) => t.genres.some((g) => g.startsWith("deezer:"))).slice(0, 10);
const usage = { input: 0, output: 0 };
const t0 = Date.now();
const sorted = await sortTracks(await sortFichesFor(bacs), tracks, undefined, { usage });
console.log(`${sorted.length} titres en ${((Date.now() - t0) / 1000).toFixed(0)} s, tokens ${usage.input} → ${usage.output}`);
for (const s of sorted) {
  const t = tracks.find((x) => x.track_id === s.track_id)!;
  console.log(`- ${t.artists[0]} — ${t.title} [${t.genres.join(", ")}] → ${s.suggestions.map((x) => `${bacs[x.bac].name} ${x.confidence}`).join(", ") || "Divers"}`);
}
