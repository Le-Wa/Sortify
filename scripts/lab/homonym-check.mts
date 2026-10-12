// Vérifie la détection des homonymes par artiste sur quelques likes (aucune écriture dans likes ;
// le verdict par artiste est gardé dans artist_tags, comme à l'import).
import { genresForLikes } from "@/lib/import";
import { db } from "@/lib/db";
const { data, error } = await db()
  .from("likes")
  .select("track_id, title, artists, cover_url, isrc, liked_at")
  .overlaps("artists", ["HUGEL", "FEEL", "Jorja Smith", "Burna Boy"])
  .limit(12);
if (error) throw new Error(error.message);
const t0 = Date.now();
const genres = await genresForLikes(data ?? []);
for (const l of data ?? []) console.log(`${l.artists[0]} — ${l.title} : ${(genres.get(l.track_id) ?? []).slice(0, 4).join(", ")}`);
const { data: v } = await db().from("artist_tags").select("artist, homonym").in("artist", ["HUGEL", "FEEL", "Jorja Smith", "Burna Boy"]);
console.log("verdicts :", JSON.stringify(v), `· ${Math.round((Date.now() - t0) / 100) / 10} s`);
