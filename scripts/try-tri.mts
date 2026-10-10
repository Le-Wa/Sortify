// Répartition rangé / À trier / Divers selon les seuils du tri quotidien, sans rien écrire.
import { sortTracks } from "@/lib/ai/sort";
import { listBacs, sortFichesFor } from "@/lib/bacs";
import { loadCorpus } from "@/lib/corpus";
import { db } from "@/lib/db";

const { data: member } = await db().from("members").select("spotify_id").limit(1).single();
const id = member!.spotify_id;
const corpus = (await loadCorpus(id)).sort(() => Math.random() - 0.5).slice(0, 240);
const bacs = await listBacs(id, ["active"]);
const sorted = await sortTracks(await sortFichesFor(bacs), corpus);
for (const [high, low] of [[0.65, 0.4], [0.6, 0.4], [0.7, 0.45], [0.75, 0.5]]) {
  let placed = 0, pending = 0, divers = 0, multi = 0;
  for (const s of sorted) {
    const sure = s.suggestions.filter((x) => x.confidence >= high);
    if (sure.length) { placed++; if (sure.length > 1) multi++; }
    else if ((s.suggestions[0]?.confidence ?? 0) >= low) pending++;
    else divers++;
  }
  const pct = (n: number) => `${Math.round((100 * n) / sorted.length)} %`;
  console.log(`haut ${high} / bas ${low} → rangés ${pct(placed)} (multi ${pct(multi)}), À trier ${pct(pending)}, Divers ${pct(divers)}`);
}
