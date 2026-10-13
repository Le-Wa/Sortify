// Bacs des potes, essai à blanc (lecture seule, sans IA, sans toucher à l'accord des membres) :
// affinité, et pour chacun de mes bacs le bac le plus proche chez le pote (croisement B), comme le ferait lib/potes.ts.
// Usage : npm run try -- scripts/lab/potes-check.mts
import { affinity, bacSimilarity, type AffinityTrack } from "@/lib/affinity";
import { listBacs } from "@/lib/bacs";
import { db } from "@/lib/db";
import { families } from "@/lib/enrichment/families";

const { data: members } = await db().from("members").select("spotify_id, display_name").order("created_at");
const [me, pote] = members!;
async function lib(id: string) {
  const rows: { track_id: string; artists: string[]; genres: string[]; title: string }[] = [];
  for (let from = 0; ; from += 1000) {
    const { data } = await db().from("likes").select("track_id, artists, genres, title").eq("member_id", id).range(from, from + 999);
    rows.push(...(data ?? []));
    if ((data ?? []).length < 1000) break;
  }
  return new Map(rows.map((r) => [r.track_id, { track_id: r.track_id, artist: r.artists[0] ?? "", families: [...families(r.genres)], title: r.title }]));
}
async function bacTracks(memberId: string, l: Map<string, AffinityTrack & { title: string }>) {
  const out = [];
  for (const b of await listBacs(memberId, ["active"])) {
    const { data } = await db().from("placements").select("track_id").eq("bac_id", b.id).limit(2000);
    out.push({ name: b.name, tracks: (data ?? []).map((r) => l.get(r.track_id)).filter((t): t is AffinityTrack & { title: string } => Boolean(t)) });
  }
  return out;
}
const [lm, lp] = await Promise.all([lib(me.spotify_id), lib(pote.spotify_id)]);
const a = affinity([...lm.values()], [...lp.values()]);
console.log(`Affinité ${a.score} % · ${a.sharedTracks.length} titres · ${a.sharedArtists.length} artistes · rencontre : ${a.meetingFamily}`);
const [bm, bp] = await Promise.all([bacTracks(me.spotify_id, lm), bacTracks(pote.spotify_id, lp)]);
for (const mine of bm) {
  const best = bp.map((t) => ({ t, sim: bacSimilarity(mine.tracks, t.tracks) })).sort((x, y) => y.sim - x.sim)[0];
  const sugg = best.t.tracks.filter((t) => !lm.has(t.track_id)).length;
  console.log(`${mine.name.padEnd(24)} → ${best.sim >= 0.44 ? best.t.name : "(rien)"} ${best.sim.toFixed(2)} · ${sugg} titres à découvrir`);
}
