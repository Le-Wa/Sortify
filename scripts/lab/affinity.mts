// Affinité entre membres (13/10/2026) — base seulement, sans IA. Artistes et titres en commun, familles de genre.
// Usage : npm run try -- scripts/lab/affinity.mts
import { loadCorpus } from "@/lib/corpus";
import { db } from "@/lib/db";
import { families } from "@/lib/enrichment/families";

const { data: members } = await db().from("members").select("spotify_id, display_name").order("created_at");
const [a, b] = await Promise.all(members!.slice(0, 2).map((m) => loadCorpus(m.spotify_id)));
const artists = (c: typeof a) => {
  const m = new Map<string, number>();
  for (const t of c) for (const x of t.artists.slice(0, 1)) m.set(x, (m.get(x) ?? 0) + 1);
  return m;
};
const fam = (c: typeof a) => {
  const m = new Map<string, number>();
  for (const t of c) for (const f of families(t.genres)) m.set(f, (m.get(f) ?? 0) + 1 / c.length);
  return m;
};
const [aa, ab] = [artists(a), artists(b)];
const shared = [...aa.keys()].filter((x) => ab.has(x));
const sharedTracks = a.filter((t) => b.some((u) => u.track_id === t.track_id));
const [fa, fb] = [fam(a), fam(b)];
const keys = new Set([...fa.keys(), ...fb.keys()]);
let dot = 0, na = 0, nb = 0;
for (const k of keys) {
  dot += (fa.get(k) ?? 0) * (fb.get(k) ?? 0);
  na += (fa.get(k) ?? 0) ** 2;
  nb += (fb.get(k) ?? 0) ** 2;
}
const cosine = dot / Math.sqrt(na * nb);
// Score : moitié genres (cosinus), moitié artistes (part des titres de chacun signés par un artiste commun).
const cover = (c: typeof a, s: Set<string>) => c.filter((t) => s.has(t.artists[0])).length / c.length;
const s = new Set(shared);
const score = Math.round(100 * (0.5 * cosine + 0.5 * Math.sqrt(cover(a, s) * cover(b, s))));
console.log(`${members![0].display_name} × ${members![1].display_name}`);
console.log(`artistes en commun : ${shared.length} (${shared.sort((x, y) => (ab.get(y)! + aa.get(y)!) - (ab.get(x)! + aa.get(x)!)).slice(0, 12).join(", ")})`);
console.log(`titres en commun : ${sharedTracks.length} (${sharedTracks.slice(0, 8).map((t) => `${t.artists[0]} — ${t.title}`).join(" ; ")})`);
console.log(`genres : cosinus ${cosine.toFixed(2)} ; titres signés par un artiste commun : ${Math.round(100 * cover(a, s))} % / ${Math.round(100 * cover(b, s))} %`);
console.log(`familles A : ${[...fa].sort((x, y) => y[1] - x[1]).slice(0, 5).map(([k, v]) => `${k} ${Math.round(100 * v)}%`).join(", ")}`);
console.log(`familles B : ${[...fb].sort((x, y) => y[1] - x[1]).slice(0, 5).map(([k, v]) => `${k} ${Math.round(100 * v)}%`).join(", ")}`);
console.log(`score d'affinité : ${score} %`);
