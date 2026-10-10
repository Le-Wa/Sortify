// Complète avec les genres d'album Deezer les likes restés sans aucun tag (une fois, après l'ajout du repli Deezer).
// Usage : npm run try scripts/backfill-deezer.mts
import { db } from "@/lib/db";
import { deezerGenres } from "@/lib/enrichment/deezer";

const { data, error } = await db().from("likes").select("member_id, track_id, isrc").eq("genres", "{}").not("enriched_at", "is", null);
if (error) throw new Error(error.message);
let filled = 0;
for (const like of data ?? []) {
  const genres = await deezerGenres(like.isrc);
  if (genres.length === 0) continue;
  const { error: e } = await db().from("likes").update({ genres }).eq("member_id", like.member_id).eq("track_id", like.track_id);
  if (e) throw new Error(e.message);
  filled++;
}
console.log(`${filled} / ${data?.length ?? 0} likes sans tag complétés par Deezer`);
