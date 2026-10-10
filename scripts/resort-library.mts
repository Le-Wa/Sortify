// Re-rangement de toute la bibliothèque d'un membre avec le moteur actuel.
//   Essai à blanc (par défaut) : calcule, enregistre <dossier>/resort.json et affiche les différences, sans rien modifier.
//   --apply : applique le calcul enregistré (base + playlists Spotify reconstruites, plus récents en haut).
// Toujours conservés : corrections et rangements manuels, titres exemples des fiches ; contre-exemples respectés.
// Usage : npm run try scripts/resort-library.mts <dossier> [--apply]
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { sortTracks, type Sorted } from "@/lib/ai/sort";
import { ensureDivers, INITIAL_PLACE_THRESHOLD, listBacs, sortFichesFor, type Bac } from "@/lib/bacs";
import { loadCorpus } from "@/lib/corpus";
import { db } from "@/lib/db";
import { spotify } from "@/lib/spotify/client";
import { append } from "@/lib/spotify/playlists";

const dir = process.argv[2];
const apply = process.argv.includes("--apply");
const reuse = apply || process.argv.includes("--reuse"); // --reuse : réaffiche le calcul enregistré sans le refaire
const file = `${dir}/resort.json`;

const { data: member } = await db().from("members").select("spotify_id").limit(1).single();
const m = member!.spotify_id;
const bacs = await listBacs(m, ["active"]);
const divers = await ensureDivers(m);
const all: Bac[] = [...bacs, divers];
const name = new Map(all.map((b) => [b.id, b.name]));
const corpus = await loadCorpus(m);

async function pageAll<T>(query: (from: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await query(from);
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []));
    if ((data ?? []).length < 1000) break;
  }
  return rows;
}
const placements = await pageAll<{ bac_id: string; track_id: string; source: string }>((f) =>
  db().from("placements").select("bac_id, track_id, source").eq("member_id", m).range(f, f + 999),
);
const examples = await pageAll<{ bac_id: string; track_id: string; polarity: string }>((f) =>
  db().from("bac_examples").select("bac_id, track_id, polarity").eq("member_id", m).range(f, f + 999),
);

const current = new Map<string, Set<string>>();
for (const p of placements) (current.get(p.track_id) ?? current.set(p.track_id, new Set()).get(p.track_id)!).add(p.bac_id);
const isActive = new Set(bacs.map((b) => b.id));
const protectedPairs = new Set(
  [
    ...placements.filter((p) => (p.source === "correction" || p.source === "manuel") && isActive.has(p.bac_id)),
    ...examples.filter((e) => e.polarity === "positive" && isActive.has(e.bac_id)),
  ].map((p) => `${p.track_id}|${p.bac_id}`),
);
const forbidden = new Set(examples.filter((e) => e.polarity === "negative").map((e) => `${e.track_id}|${e.bac_id}`));

// 1. Calcul (ou reprise du calcul enregistré pour --apply)
let sorted: Sorted[];
let bacOrder: string[];
if (reuse) {
  if (!existsSync(file)) throw new Error("Lance d'abord l'essai à blanc.");
  ({ sorted, bacOrder } = JSON.parse(readFileSync(file, "utf8")) as { sorted: Sorted[]; bacOrder: string[] });
  if (bacOrder.join() !== bacs.map((b) => b.id).join()) throw new Error("Les bacs ont changé depuis l'essai à blanc : relance-le.");
} else {
  const usage = { input: 0, output: 0 };
  const t0 = Date.now();
  sorted = await sortTracks(await sortFichesFor(bacs), corpus, undefined, { usage });
  bacOrder = bacs.map((b) => b.id);
  writeFileSync(file, JSON.stringify({ sorted, bacOrder }));
  console.log(`Calcul : ${sorted.length} titres en ${Math.round((Date.now() - t0) / 1000)} s, ≈ ${((usage.input * 2 + usage.output * 10) / 1e6).toFixed(2)} $`);
}

// 2. Cible par titre
const target = new Map<string, Set<string>>();
for (const s of sorted) {
  const set = new Set<string>();
  for (const key of protectedPairs) if (key.startsWith(`${s.track_id}|`)) set.add(key.split("|")[1]);
  for (const x of s.suggestions) {
    const bacId = bacOrder[x.bac];
    if (x.confidence >= INITIAL_PLACE_THRESHOLD && !forbidden.has(`${s.track_id}|${bacId}`)) set.add(bacId);
  }
  target.set(s.track_id, set.size ? set : new Set([divers.id]));
}

// 3. Différences
const adds = new Map<string, string[]>();
const removes = new Map<string, string[]>();
let changed = 0;
for (const t of corpus) {
  const before = current.get(t.track_id) ?? new Set<string>();
  const after = target.get(t.track_id) ?? new Set([divers.id]);
  let diff = false;
  for (const b of after) {
    if (before.has(b)) continue;
    if (!adds.has(b)) adds.set(b, []);
    adds.get(b)!.push(t.track_id);
    diff = true;
  }
  for (const b of before) {
    if (after.has(b) || !name.has(b)) continue;
    if (!removes.has(b)) removes.set(b, []);
    removes.get(b)!.push(t.track_id);
    diff = true;
  }
  if (diff) changed++;
}
const count = (map: Map<string, Set<string>>, bacId: string) => [...map.values()].filter((s) => s.has(bacId)).length;
const multi = (map: Map<string, Set<string>>) => [...map.values()].filter((s) => [...s].filter((b) => b !== divers.id).length > 1).length;
console.log(`\n${changed} titres sur ${corpus.length} changent. Plusieurs bacs : ${multi(current)} → ${multi(target)} titres.`);
console.log("Bac | avant → après | + ajoutés | − retirés");
for (const b of all) {
  console.log(`${b.name} | ${count(current, b.id)} → ${count(target, b.id)} | +${adds.get(b.id)?.length ?? 0} | −${removes.get(b.id)?.length ?? 0}`);
}
const title = new Map(corpus.map((t) => [t.track_id, `${t.artists[0]} — ${t.title}`]));
const label = (ids: Iterable<string>) => [...ids].map((b) => name.get(b)).sort().join(", ") || "—";
console.log("\nExemples par bac (retirés / ajoutés) :");
for (const b of all) {
  const out = (removes.get(b.id) ?? []).slice(0, 4).map((id) => `   − ${title.get(id)} → ${label(target.get(id) ?? [])}`);
  const inn = (adds.get(b.id) ?? []).slice(0, 3).map((id) => `   + ${title.get(id)} (avant : ${label(current.get(id) ?? [])})`);
  if (out.length || inn.length) console.log(`${b.name}\n${[...out, ...inn].join("\n")}`);
}

// 4. Application
if (apply) {
  // Sauvegarde de l'état actuel (placements + ordre des playlists) pour pouvoir revenir en arrière.
  const backup = `${dir}/resort-backup-${Date.now()}.json`;
  writeFileSync(backup, JSON.stringify({ placements, bacs: all.map((b) => ({ id: b.id, name: b.name, playlist: b.spotify_playlist_id })) }));
  console.log(`Sauvegarde de l'état actuel : ${backup}`);
  for (const b of all) {
    const want = corpus.filter((t) => target.get(t.track_id)?.has(b.id)).map((t) => t.track_id); // corpus = plus récents d'abord
    const keep = new Set(want);
    const drop = placements.filter((p) => p.bac_id === b.id && !keep.has(p.track_id)).map((p) => p.track_id);
    for (let i = 0; i < drop.length; i += 150) {
      const { error } = await db().from("placements").delete().eq("bac_id", b.id).in("track_id", drop.slice(i, i + 150));
      if (error) throw new Error(error.message);
    }
    const had = new Set(placements.filter((p) => p.bac_id === b.id).map((p) => p.track_id));
    const fresh = sorted.filter((s) => keep.has(s.track_id) && !had.has(s.track_id));
    const conf = (s: Sorted) => s.suggestions.find((x) => bacOrder[x.bac] === b.id)?.confidence ?? null;
    for (let i = 0; i < fresh.length; i += 500) {
      const { error } = await db()
        .from("placements")
        .insert(fresh.slice(i, i + 500).map((s) => ({ bac_id: b.id, member_id: m, track_id: s.track_id, confidence: conf(s), source: "ia", synced_at: new Date().toISOString() })));
      if (error) throw new Error(error.message);
    }
    if (b.spotify_playlist_id) {
      // Reconstruction : on remplace le contenu, puis on ajoute la suite (ordre conservé : plus récents en haut).
      await spotify(m, `/playlists/${b.spotify_playlist_id}/items`, { method: "PUT", json: { uris: want.slice(0, 100).map((id) => `spotify:track:${id}`) } });
      await append(m, b.spotify_playlist_id, want.slice(100));
    }
    const { error } = await db().from("placements").update({ synced_at: new Date().toISOString() }).eq("bac_id", b.id).is("synced_at", null);
    if (error) throw new Error(error.message);
    console.log(`✓ ${b.name} : ${want.length} titres`);
  }
  console.log("Appliqué.");
} else {
  console.log(`\nEssai à blanc : rien n'a été modifié. Calcul enregistré dans ${file}.`);
}
