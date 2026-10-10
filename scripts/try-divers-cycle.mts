// Aller-retour réversible : un titre de Divers → Afrobeats, puis « Retirer » → retour dans Divers. Vérifie Spotify à chaque étape.
import { removeTrack } from "@/lib/bac-admin";
import { ensureDivers, listBacs } from "@/lib/bacs";
import { bacsOfTrack, setTrackBacs } from "@/lib/daily";
import { db } from "@/lib/db";
import { spotify } from "@/lib/spotify/client";

const { data: member } = await db().from("members").select("spotify_id").limit(1).single();
const m = member!.spotify_id;
const afro = (await listBacs(m, ["active"])).find((b) => b.name.startsWith("Afrobeats"))!;
const divers = await ensureDivers(m);
const { data: like } = await db().from("likes").select("track_id, title").eq("member_id", m).eq("title", "Awilo").single();
const track = like!.track_id;

const top = async (playlist: string) =>
  ((await spotify<{ items: { item: { id: string } }[] }>(m, `/playlists/${playlist}/items?limit=3`)).items.map((i) => i.item.id).includes(track));
const state = async (label: string) =>
  console.log(label, "| bacs :", (await bacsOfTrack(m, track)).map((id) => (id === afro.id ? "Afrobeats" : id === divers.id ? "Divers" : id)), "| en haut d'Afrobeats :", await top(afro.spotify_playlist_id!), "| en haut de Divers :", await top(divers.spotify_playlist_id!));

await state("Avant");
await setTrackBacs(m, track, [afro.id], { source: "manuel", aiChoice: await bacsOfTrack(m, track) });
await state("Rangé depuis Divers");
await removeTrack(m, afro.id, track);
await state("Retiré d'Afrobeats");
const { data: ex } = await db().from("bac_examples").select("polarity").eq("bac_id", afro.id).eq("track_id", track);
console.log("Exemple laissé pour l'IA :", JSON.stringify(ex));
await db().from("bac_examples").delete().eq("bac_id", afro.id).eq("track_id", track);
console.log("Contre-exemple de test effacé.");
