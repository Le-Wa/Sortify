// Redemande à ReccoBeats les données audio des likes qui n'en ont pas (sans risque : base seulement).
// Usage : npm run try scripts/refresh-audio.mts
import { db } from "@/lib/db";
import { audioFeatures, RECCOBEATS_BATCH } from "@/lib/enrichment/reccobeats";

const { data, error } = await db().from("likes").select("member_id, track_id").is("audio", null);
if (error) throw new Error(error.message);
let found = 0;
for (let i = 0; i < (data ?? []).length; i += RECCOBEATS_BATCH) {
  const chunk = data!.slice(i, i + RECCOBEATS_BATCH);
  const features = await audioFeatures(chunk.map((l) => l.track_id));
  for (const like of chunk) {
    const audio = features.get(like.track_id);
    if (!audio) continue;
    const { error: e } = await db().from("likes").update({ audio }).eq("member_id", like.member_id).eq("track_id", like.track_id);
    if (e) throw new Error(e.message);
    found++;
  }
}
console.log(`${found} / ${data?.length ?? 0} likes sans audio complétés par ReccoBeats`);
