// Migration de l'algorithme du 11/10/2026 (banc : docs/bench/2026-10-11-banc-essai.md), pour un membre :
//   1. genres : Deezer à la place de Last.fm quand ils se contredisent (homonymes) ;
//   2. fiches : frontières rafraîchies (celles mesurées au banc), Ino Casablanca retiré de Caraïbes ;
//   3. 3 bacs transversaux de plus : Route de nuit, Avant de sortir, Focus instrumental ;
//   4. re-rangement complet en deux familles (scène ≥ 0,5, transversal ≥ 0,6).
// Essai à blanc par défaut (rien n'est modifié, calcul enregistré dans <dossier>/migration.json).
// --apply : applique le calcul enregistré (base, nouvelles playlists + pochettes, playlists reconstruites).
// Toujours conservés : corrections et rangements manuels, exemples des fiches ; contre-exemples respectés.
// Usage : npm run try -- scripts/migrate-algo-2026-10-11.mts <dossier> [--apply]
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import type { Axis } from "@/lib/ai/fiches";
import { sortTracks, type SortFiche, type Sorted } from "@/lib/ai/sort";
import { nextColor } from "@/lib/bac-colors";
import { ensureDivers, examplesFor, listBacs, placeThreshold, type Bac } from "@/lib/bacs";
import { loadCorpus, type CorpusTrack } from "@/lib/corpus";
import { createPlaylist, uploadCover } from "@/lib/creation";
import { db } from "@/lib/db";
import { deezerGenres } from "@/lib/enrichment/deezer";
import { contradicts } from "@/lib/enrichment/families";
import { spotify } from "@/lib/spotify/client";
import { append } from "@/lib/spotify/playlists";

const dir = process.argv[2];
const apply = process.argv.includes("--apply");
const file = `${dir}/migration.json`;

const NEW_BACS: { name: string; sleeve_name: string | null; pitch: string; shape: string; axis: Axis }[] = [
  { name: "Route de nuit", sleeve_name: null, pitch: "Groove hypnotique et basses rondes pour rouler quand la ville dort.", shape: "horizon", axis: "moment" },
  { name: "Avant de sortir", sleeve_name: null, pitch: "Les titres qui donnent de l'aplomb avant la soirée.", shape: "diamond", axis: "moment" },
  { name: "Focus instrumental", sleeve_name: "Focus", pitch: "Des boucles sans paroles pour travailler sans décrocher.", shape: "waves", axis: "ambiance" },
];

const { data: member } = await db().from("members").select("spotify_id").limit(1).single();
const m = member!.spotify_id;
const bacs = await listBacs(m, ["active"]);
const divers = await ensureDivers(m);
const corpus = await loadCorpus(m);
const bench = JSON.parse(readFileSync("docs/bench/2026-10-11/algo-bench3-setup.json", "utf8")) as { refreshed16: SortFiche[] };

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

interface Plan {
  bacOrder: string[]; // ids des bacs existants, puis « new:0 », « new:1 », « new:2 »
  genres: Record<string, string[]>; // nouveaux genres des titres contredits
  briefs: Record<string, string>; // nom du bac → brief
  newExamples: string[][]; // track_ids exemples de chaque nouveau bac
  sorted: Sorted[];
}

// ── 1. Calcul (essai à blanc) ou reprise du calcul enregistré
let plan: Plan;
if (apply) {
  if (!existsSync(file)) throw new Error("Lance d'abord l'essai à blanc.");
  plan = JSON.parse(readFileSync(file, "utf8")) as Plan;
  if (plan.bacOrder.slice(0, bacs.length).join() !== bacs.map((b) => b.id).join()) throw new Error("Les bacs ont changé depuis l'essai à blanc : relance-le.");
} else {
  // Genres : mêmes règles que l'import (lib/import.ts).
  const isrc = new Map<string, string | null>();
  for (let i = 0; i < corpus.length; i += 300) {
    const { data, error } = await db().from("likes").select("track_id, isrc").eq("member_id", m).in("track_id", corpus.slice(i, i + 300).map((t) => t.track_id));
    if (error) throw new Error(error.message);
    for (const r of data ?? []) isrc.set(r.track_id, r.isrc);
  }
  const genres: Record<string, string[]> = {};
  const lastfm = corpus.filter((t) => t.genres.length && !t.genres.some((g) => g.startsWith("deezer:")));
  let k = 0;
  await Promise.all(
    Array.from({ length: 4 }, async () => {
      while (k < lastfm.length) {
        const t = lastfm[k++];
        const dz = await deezerGenres(isrc.get(t.track_id) ?? null);
        if (contradicts(t.genres, dz)) genres[t.track_id] = dz;
      }
    }),
  );
  console.log(`Genres : ${Object.keys(genres).length} titres passent sur Deezer (tags Last.fm contredits).`);

  const briefs: Record<string, string> = {};
  for (const f of bench.refreshed16) briefs[f.name] = f.brief;
  const caraibes = "Caraïbes & latino";
  if (!briefs[caraibes]?.includes("(Ino Casablanca, ")) throw new Error("Fiche Caraïbes inattendue : vérifier le retrait d'Ino Casablanca.");
  briefs[caraibes] = briefs[caraibes].replace("(Ino Casablanca, ", "(");
  for (const b of bacs) if (!briefs[b.name]) throw new Error(`Pas de fiche rafraîchie pour « ${b.name} »`);

  const byLabel = new Map(corpus.map((t) => [`${t.artists[0]} — ${t.title}`, t.track_id]));
  const newExamples = NEW_BACS.map((nb) => (bench.refreshed16.find((f) => f.name === nb.name)?.examples ?? []).map((l) => byLabel.get(l)).filter((id): id is string => Boolean(id)));

  // Fiches du rangement : existantes (brief rafraîchi, exemples et contre-exemples en base) + nouvelles.
  const ex = await examplesFor(bacs.map((b) => b.id));
  const label = (e: { artist: string; title: string }) => `${e.artist} — ${e.title}`;
  const fiches: SortFiche[] = [
    ...bacs.map((b) => ({ name: b.name, axis: b.axis, brief: briefs[b.name], examples: (ex.get(b.id)?.positive ?? []).map(label), counterExamples: (ex.get(b.id)?.negative ?? []).map(label) })),
    ...NEW_BACS.map((nb) => {
      const f = bench.refreshed16.find((x) => x.name === nb.name)!;
      briefs[nb.name] = f.brief;
      return { name: nb.name, axis: nb.axis, brief: f.brief, examples: f.examples, counterExamples: [] };
    }),
  ];
  const tracks: CorpusTrack[] = corpus.map((t) => (genres[t.track_id] ? { ...t, genres: genres[t.track_id] } : t));
  const usage = { input: 0, output: 0 };
  const t0 = Date.now();
  const sorted = await sortTracks(fiches, tracks, undefined, { usage });
  console.log(`Rangement : ${sorted.length} titres en ${Math.round((Date.now() - t0) / 1000)} s, ≈ ${((usage.input * 2 + usage.output * 10) / 1e6).toFixed(2)} $`);
  plan = { bacOrder: [...bacs.map((b) => b.id), ...NEW_BACS.map((_, i) => `new:${i}`)], genres, briefs, newExamples, sorted };
  writeFileSync(file, JSON.stringify(plan));
}

// ── 2. Cible par titre
const placements = await pageAll<{ bac_id: string; track_id: string; source: string }>((f) =>
  db().from("placements").select("bac_id, track_id, source").eq("member_id", m).range(f, f + 999),
);
const examples = await pageAll<{ bac_id: string; track_id: string; polarity: string }>((f) =>
  db().from("bac_examples").select("bac_id, track_id, polarity").eq("member_id", m).range(f, f + 999),
);
const isActive = new Set(bacs.map((b) => b.id));
const protectedPairs = [
  ...placements.filter((p) => (p.source === "correction" || p.source === "manuel") && isActive.has(p.bac_id)),
  ...examples.filter((e) => e.polarity === "positive" && isActive.has(e.bac_id)),
  ...plan.newExamples.flatMap((ids, i) => ids.map((track_id) => ({ track_id, bac_id: `new:${i}` }))),
];
const forbidden = new Set(examples.filter((e) => e.polarity === "negative").map((e) => `${e.track_id}|${e.bac_id}`));
const axisOf = new Map<string, Axis>([...bacs.map((b) => [b.id, b.axis] as const), ...NEW_BACS.map((nb, i) => [`new:${i}`, nb.axis] as const)]);
const name = new Map<string, string>([...bacs.map((b) => [b.id, b.name] as const), [divers.id, "Divers"], ...NEW_BACS.map((nb, i) => [`new:${i}`, nb.name] as const)]);

const current = new Map<string, Set<string>>();
for (const p of placements) (current.get(p.track_id) ?? current.set(p.track_id, new Set()).get(p.track_id)!).add(p.bac_id);
const target = new Map<string, Set<string>>();
for (const s of plan.sorted) {
  const set = new Set<string>(protectedPairs.filter((p) => p.track_id === s.track_id).map((p) => p.bac_id));
  for (const x of s.suggestions) {
    const bacId = plan.bacOrder[x.bac];
    if (x.confidence >= placeThreshold(axisOf.get(bacId)!) && !forbidden.has(`${s.track_id}|${bacId}`)) set.add(bacId);
  }
  target.set(s.track_id, set.size ? set : new Set([divers.id]));
}

// ── 3. Résumé
const order = [...plan.bacOrder, divers.id];
const count = (map: Map<string, Set<string>>, id: string) => [...map.values()].filter((s) => s.has(id)).length;
const real = (s: Set<string>) => [...s].filter((b) => b !== divers.id);
const multi = (map: Map<string, Set<string>>) => [...map.values()].filter((s) => real(s).length > 1).length;
const withTrans = (map: Map<string, Set<string>>) => [...map.values()].filter((s) => real(s).some((b) => axisOf.get(b) !== "scène")).length;
let changed = 0;
for (const t of corpus) {
  const a = [...(current.get(t.track_id) ?? [])].sort().join();
  const b = [...(target.get(t.track_id) ?? [])].sort().join();
  if (a !== b) changed++;
}
const n = corpus.length;
const pc = (x: number) => `${Math.round((100 * x) / n)} %`;
console.log(`\n${changed} titres sur ${n} changent.`);
console.log(`Dans plusieurs bacs : ${pc(multi(current))} → ${pc(multi(target))} · avec un bac transversal : ${pc(withTrans(current))} → ${pc(withTrans(target))} · Divers : ${count(current, divers.id)} → ${count(target, divers.id)}`);
console.log("Bac | avant → après");
for (const id of order) console.log(`${name.get(id)} | ${count(current, id)} → ${count(target, id)}`);
const title = new Map(corpus.map((t) => [t.track_id, `${t.artists[0]} — ${t.title}`]));
for (const [i] of NEW_BACS.entries()) {
  const ids = corpus.filter((t) => target.get(t.track_id)?.has(`new:${i}`)).map((t) => title.get(t.track_id));
  console.log(`\n${NEW_BACS[i].name} (${ids.length}) : ${ids.slice(0, 12).join(" · ")}`);
}
const ino = corpus.filter((t) => t.artists.includes("Ino Casablanca")).map((t) => `${t.title} → ${real(target.get(t.track_id) ?? new Set()).map((b) => name.get(b)).join(", ") || "Divers"}`);
console.log(`\nIno Casablanca : ${ino.join(" · ")}`);
const hugel = corpus.filter((t) => t.artists[0] === "HUGEL").map((t) => `${t.title} → ${real(target.get(t.track_id) ?? new Set()).map((b) => name.get(b)).join(", ") || "Divers"}`);
console.log(`HUGEL : ${hugel.join(" · ")}`);

if (!apply) {
  console.log(`\nEssai à blanc : rien n'a été modifié. Calcul enregistré dans ${file}.`);
  process.exit(0);
}

// ── 4. Application
const backup = `${dir}/migration-backup-${Date.now()}.json`;
const { data: oldGenres } = await db().from("likes").select("track_id, genres").eq("member_id", m).in("track_id", Object.keys(plan.genres));
writeFileSync(backup, JSON.stringify({ placements, bacs: bacs.map((b) => ({ id: b.id, name: b.name, brief: b.brief, playlist: b.spotify_playlist_id })), genres: oldGenres }));
console.log(`Sauvegarde : ${backup}`);

for (const [trackId, g] of Object.entries(plan.genres)) {
  const { error } = await db().from("likes").update({ genres: g }).eq("member_id", m).eq("track_id", trackId);
  if (error) throw new Error(error.message);
}
for (const b of bacs) {
  const { error } = await db().from("bacs").update({ brief: plan.briefs[b.name] }).eq("id", b.id);
  if (error) throw new Error(error.message);
}
console.log("✓ genres et fiches");

// Nouveaux bacs (couleurs libres, à la suite de la rangée d'accueil).
const used = bacs.map((b) => b.color);
const created: Bac[] = [];
for (const [i, nb] of NEW_BACS.entries()) {
  const color = nextColor(used);
  used.push(color);
  const { data, error } = await db()
    .from("bacs")
    .insert({ member_id: m, name: nb.name, sleeve_name: nb.sleeve_name, pitch: nb.pitch, brief: plan.briefs[nb.name], axis: nb.axis, shape: nb.shape, color, position: bacs.length + i, status: "active" })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  const bac = data as Bac;
  if (plan.newExamples[i].length) {
    const { error: e } = await db().from("bac_examples").insert(plan.newExamples[i].map((track_id) => ({ bac_id: bac.id, member_id: m, track_id, polarity: "positive" })));
    if (e) throw new Error(e.message);
  }
  created.push(bac);
  plan.bacOrder[bacs.length + i] = bac.id;
  for (const set of target.values()) if (set.delete(`new:${i}`)) set.add(bac.id);
}
console.log(`✓ ${created.length} bacs créés`);

for (const b of [...bacs, ...created, divers]) {
  const want = corpus.filter((t) => target.get(t.track_id)?.has(b.id)).map((t) => t.track_id); // plus récents d'abord
  const keep = new Set(want);
  const drop = placements.filter((p) => p.bac_id === b.id && !keep.has(p.track_id)).map((p) => p.track_id);
  for (let i = 0; i < drop.length; i += 150) {
    const { error } = await db().from("placements").delete().eq("bac_id", b.id).in("track_id", drop.slice(i, i + 150));
    if (error) throw new Error(error.message);
  }
  const had = new Set(placements.filter((p) => p.bac_id === b.id).map((p) => p.track_id));
  const idx = plan.bacOrder.indexOf(b.id);
  const conf = (id: string) => plan.sorted.find((s) => s.track_id === id)?.suggestions.find((x) => x.bac === idx)?.confidence ?? null;
  const fresh = want.filter((id) => !had.has(id));
  for (let i = 0; i < fresh.length; i += 500) {
    const { error } = await db()
      .from("placements")
      .insert(fresh.slice(i, i + 500).map((track_id) => ({ bac_id: b.id, member_id: m, track_id, confidence: conf(track_id), source: "ia", synced_at: new Date().toISOString() })));
    if (error) throw new Error(error.message);
  }
  let playlistId = b.spotify_playlist_id;
  if (!playlistId) {
    playlistId = await createPlaylist(m, b);
    await uploadCover(m, { ...b, spotify_playlist_id: playlistId });
  }
  await spotify(m, `/playlists/${playlistId}/items`, { method: "PUT", json: { uris: want.slice(0, 100).map((id) => `spotify:track:${id}`) } });
  await append(m, playlistId, want.slice(100));
  const { error } = await db().from("placements").update({ synced_at: new Date().toISOString() }).eq("bac_id", b.id).is("synced_at", null);
  if (error) throw new Error(error.message);
  console.log(`✓ ${b.name} : ${want.length} titres`);
}
console.log("Appliqué.");
