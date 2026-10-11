// Complément du banc 3 : sur la sonde (tags contredits par Deezer), remplacer les tags Last.fm par Deezer au lieu de les ajouter.
// Usage : npm run try -- scripts/lab/algo-bench3-replace.mts <dossier>
import { readFileSync } from "node:fs";
import { sortTracks } from "@/lib/ai/sort";
import { listBacs, sortFichesFor } from "@/lib/bacs";
import { loadCorpus } from "@/lib/corpus";
import { db } from "@/lib/db";

const out = process.argv[2];
const { probeIds } = JSON.parse(readFileSync(`${out}/algo-bench3.json`, "utf8")) as { probeIds: string[] };
const gold = JSON.parse(readFileSync(`${out}/algo-bench3-gold.json`, "utf8")) as Record<string, number[]>;
const { deezer } = JSON.parse(readFileSync(`${out}/deezer-all.json`, "utf8")) as { deezer: Record<string, string[]> };
const { data: member } = await db().from("members").select("spotify_id").limit(1).single();
const m = member!.spotify_id;
const fiches = await sortFichesFor(await listBacs(m, ["active"]));
const byId = new Map((await loadCorpus(m)).map((t) => [t.track_id, t]));
const tracks = probeIds.map((id) => ({ ...byId.get(id)!, genres: deezer[id] ?? [] }));
for (const pass of [1, 2]) {
  const sorted = await sortTracks(fiches, tracks);
  let ok = 0, n = 0;
  for (const s of sorted) {
    const g = new Set((gold[s.track_id] ?? []).filter((b) => b < fiches.length));
    if (g.size && s.suggestions[0]) {
      n++;
      if (g.has(s.suggestions[0].bac)) ok++;
    }
  }
  console.log(`Remplacer par Deezer, passage ${pass} : top 1 sonde ${Math.round((100 * ok) / n)} % (${ok}/${n})`);
}
