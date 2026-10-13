// Que contient Divers ? Familles de genres, artistes récurrents, tags manquants. Lecture seule.
// Usage : npm run try -- scripts/lab/divers-profile.mts
import { db } from "@/lib/db";
import { families } from "@/lib/enrichment/families";

const { data: members } = await db().from("members").select("spotify_id, display_name");
for (const m of members ?? []) {
  const { data: divers } = await db().from("bacs").select("id").eq("member_id", m.spotify_id).eq("is_divers", true).single();
  const ids: string[] = [];
  for (let from = 0; ; from += 1000) {
    const { data } = await db().from("placements").select("track_id").eq("bac_id", divers!.id).range(from, from + 999);
    ids.push(...(data ?? []).map((r) => r.track_id));
    if ((data ?? []).length < 1000) break;
  }
  const likes: { track_id: string; artists: string[]; genres: string[]; released_year: number | null }[] = [];
  for (let i = 0; i < ids.length; i += 200) {
    const { data } = await db().from("likes").select("track_id, artists, genres, released_year").eq("member_id", m.spotify_id).in("track_id", ids.slice(i, i + 200));
    likes.push(...((data ?? []) as typeof likes));
  }
  const fam = new Map<string, number>();
  let none = 0;
  for (const l of likes) {
    const f = [...families(l.genres)];
    if (!f.length) none++;
    for (const x of f) fam.set(x, (fam.get(x) ?? 0) + 1);
  }
  const art = new Map<string, number>();
  for (const l of likes) art.set(l.artists[0], (art.get(l.artists[0]) ?? 0) + 1);
  const decades = new Map<string, number>();
  for (const l of likes) {
    const d = l.released_year ? `${Math.floor(l.released_year / 10) * 10}s` : "?";
    decades.set(d, (decades.get(d) ?? 0) + 1);
  }
  const top = (mp: Map<string, number>, n: number) => [...mp].sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, v]) => `${k} ${v}`).join(" · ");
  console.log(`\n${m.display_name} : Divers ${likes.length} titres ; sans famille de genre ${none}`);
  console.log("  familles :", top(fam, 9));
  console.log("  décennies :", top(decades, 6));
  const multi = [...art].filter(([, v]) => v >= 3);
  console.log(`  artistes à 3+ titres : ${multi.length} (${multi.reduce((n, [, v]) => n + v, 0)} titres) — ${top(new Map(multi), 8)}`);
}
