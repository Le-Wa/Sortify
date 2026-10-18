// Délike une liste de titres (albums likés en bloc, choisis par Walid le 18/10/2026), puis retire ces titres des playlists Sortify.
// Usage : npm run try -- scripts/unlike-albums.mts <fichier.json> [--apply]
// Sans --apply : essai à blanc (lecture seule). Le fichier sert aussi de sauvegarde (re-liker : PUT /me/library?uris=…).
import { readFileSync } from "node:fs";
import { db } from "@/lib/db";
import { reconcileSpotify } from "@/lib/reconcile";
import { spotify } from "@/lib/spotify/client";

const CHUNK = 40;
const file = process.argv.find((a) => a.endsWith(".json"));
if (!file) throw new Error("Fichier JSON des titres attendu");
const apply = process.argv.includes("--apply");
const ids = JSON.parse(readFileSync(file, "utf8")) as string[];

const { data: owner, error } = await db().from("members").select("spotify_id").eq("is_owner", true).single();
if (error || !owner) throw new Error(`Propriétaire introuvable : ${error?.message}`);
const memberId = owner.spotify_id as string;
const uris = (chunk: string[]) => chunk.map((id) => `spotify:track:${id}`).join(",");

const liked: string[] = [];
for (let i = 0; i < ids.length; i += CHUNK) {
  const chunk = ids.slice(i, i + CHUNK);
  const saved = await spotify<boolean[]>(memberId, `/me/library/contains?uris=${uris(chunk)}`);
  chunk.forEach((id, k) => saved[k] && liked.push(id));
}
console.log(`${ids.length} titres dans la liste, ${liked.length} encore likés dans Spotify.`);
if (!apply) {
  console.log("Essai à blanc : rien n'a changé. Relancer avec --apply pour déliker.");
  process.exit(0);
}

for (let i = 0; i < liked.length; i += CHUNK) {
  await spotify(memberId, `/me/library?uris=${uris(liked.slice(i, i + CHUNK))}`, { method: "DELETE" });
}
console.log(`${liked.length} titres délikés. Retrait des playlists Sortify…`);
const stats = await reconcileSpotify(memberId);
console.log(`Likes retirés pris en compte : ${stats.unliked}`);
