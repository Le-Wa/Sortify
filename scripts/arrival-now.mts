// Met à jour (ou crée) la playlist « Arrivage de la semaine » de chaque membre, sans attendre le prochain tri.
// Usage : npm run try -- scripts/arrival-now.mts [--all]   (par défaut : le propriétaire seulement)
import { refreshArrivalPlaylist } from "@/lib/arrival-playlist";
import { db } from "@/lib/db";
const query = db().from("members").select("spotify_id, display_name");
const { data: members, error } = await (process.argv.includes("--all") ? query : query.eq("is_owner", true));
if (error) throw new Error(error.message);
for (const m of members ?? []) {
  try {
    console.log(`${m.display_name ?? m.spotify_id} : ${await refreshArrivalPlaylist(m.spotify_id)} titres`);
  } catch (e) {
    console.error(`✗ ${m.display_name ?? m.spotify_id} :`, e instanceof Error ? e.message : e);
  }
}
