// Vérifie la playlist « Arrivage de la semaine » du propriétaire dans Spotify. Lecture seule.
import { db } from "@/lib/db";
import { spotify } from "@/lib/spotify/client";
const { data } = await db().from("members").select("spotify_id, arrival_playlist_id").eq("is_owner", true).single();
const p = await spotify<{ name: string; images?: { url: string }[]; items?: { total: number }; tracks?: { total: number } }>(data!.spotify_id, `/playlists/${data!.arrival_playlist_id}`);
console.log(p.name, "·", p.items?.total ?? p.tracks?.total, "titres ·", p.images?.length ? "pochette OK" : "sans pochette");
