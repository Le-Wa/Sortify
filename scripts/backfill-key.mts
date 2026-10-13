// Ajoute la tonalité (key, mode) de ReccoBeats aux likes qui ont déjà des données audio (ordre DJ, 13/10/2026).
// Base seulement, sans IA. Usage : npm run try -- scripts/backfill-key.mts
import { db } from "@/lib/db";
import { audioFeatures, RECCOBEATS_BATCH } from "@/lib/enrichment/reccobeats";

const rows: { member_id: string; track_id: string; audio: Record<string, number> }[] = [];
for (let from = 0; ; from += 1000) {
  const { data, error } = await db().from("likes").select("member_id, track_id, audio").not("audio", "is", null).range(from, from + 999);
  if (error) throw new Error(error.message);
  rows.push(...((data ?? []) as typeof rows));
  if ((data ?? []).length < 1000) break;
}
const todo = rows.filter((r) => r.audio.key === undefined);
let found = 0;
for (let i = 0; i < todo.length; i += RECCOBEATS_BATCH) {
  const chunk = todo.slice(i, i + RECCOBEATS_BATCH);
  const features = await audioFeatures([...new Set(chunk.map((l) => l.track_id))]);
  for (const like of chunk) {
    const f = features.get(like.track_id);
    if (f?.key === undefined) continue;
    const { error } = await db()
      .from("likes")
      .update({ audio: { ...like.audio, key: f.key, mode: f.mode } })
      .eq("member_id", like.member_id)
      .eq("track_id", like.track_id);
    if (error) throw new Error(error.message);
    found++;
  }
}
console.log(`Tonalité ajoutée à ${found} / ${todo.length} likes`);
