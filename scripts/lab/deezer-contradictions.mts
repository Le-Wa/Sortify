// Genres Deezer de tous les likes, comparés aux tags Last.fm : combien de titres ont des tags douteux ?
// Lecture seule. Usage : npm run try -- scripts/lab/deezer-contradictions.mts <dossier>
import { writeFileSync } from "node:fs";
import { loadCorpus } from "@/lib/corpus";
import { db } from "@/lib/db";
import { deezerGenres } from "@/lib/enrichment/deezer";
import { contradicts } from "./tag-families";

const out = process.argv[2];
const { data: member } = await db().from("members").select("spotify_id").limit(1).single();
const m = member!.spotify_id;
const corpus = await loadCorpus(m);
const isrc = new Map<string, string | null>();
for (let i = 0; i < corpus.length; i += 300) {
  const { data, error } = await db().from("likes").select("track_id, isrc").eq("member_id", m).in("track_id", corpus.slice(i, i + 300).map((t) => t.track_id));
  if (error) throw new Error(error.message);
  for (const r of data ?? []) isrc.set(r.track_id, r.isrc);
}
const deezer: Record<string, string[]> = {};
let k = 0;
await Promise.all(
  Array.from({ length: 4 }, async () => {
    while (k < corpus.length) {
      const t = corpus[k++];
      deezer[t.track_id] = t.genres.some((g) => g.startsWith("deezer:")) ? t.genres.filter((g) => g.startsWith("deezer:")) : await deezerGenres(isrc.get(t.track_id) ?? null);
      if (k % 100 === 0) console.log(k);
    }
  }),
);
const lastfm = corpus.filter((t) => t.genres.length && !t.genres.some((g) => g.startsWith("deezer:")));
const withDeezer = lastfm.filter((t) => deezer[t.track_id]?.length);
const contra = withDeezer.filter((t) => contradicts(t.genres, deezer[t.track_id]));
console.log(`Likes : ${corpus.length} · avec tags Last.fm : ${lastfm.length} · dont avec genres Deezer : ${withDeezer.length} · contradiction : ${contra.length}`);
const byArtist = new Map<string, number>();
for (const t of contra) byArtist.set(t.artists[0], (byArtist.get(t.artists[0]) ?? 0) + 1);
console.log([...byArtist].sort((a, b) => b[1] - a[1]).slice(0, 40).map(([a, n]) => `${a} (${n})`).join(", "));
for (const t of contra.slice(0, 40)) console.log(`${t.artists[0]} — ${t.title} | ${t.genres.slice(0, 5).join(", ")} | ${deezer[t.track_id].join(", ")}`);
writeFileSync(`${out}/deezer-all.json`, JSON.stringify({ deezer, contradictions: contra.map((t) => t.track_id) }, null, 2));
