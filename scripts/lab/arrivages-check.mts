// Vérifie les arrivages (likes par semaine et par bac) d'un membre. Lecture seule.
import { arrivals } from "@/lib/arrivages";
import { db } from "@/lib/db";
import { nextCron } from "@/lib/dates";
import { weekLabel } from "@/lib/weeks";
const { data: member } = await db().from("members").select("spotify_id").order("created_at").limit(1).single();
for (const w of await arrivals(member!.spotify_id)) {
  console.log(`${weekLabel(w.key)} : ${w.total} likes · ${w.pending} à trier · ${w.divers.length} Divers · ${w.bacs.map((b) => `${b.name} +${b.tracks.length}`).join(", ")}`);
}
console.log("Prochain tri :", nextCron().toISOString());
