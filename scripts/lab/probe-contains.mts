// Sonde : quel endpoint Spotify dit si des titres sont toujours likés ?
import { db } from "@/lib/db";
import { spotify } from "@/lib/spotify/client";

const { data: m } = await db().from("members").select("spotify_id").limit(1).single();
const { data: likes } = await db().from("likes").select("track_id").limit(3);
const ids = likes!.map((l) => l.track_id);
for (const path of [`/me/tracks/contains?ids=${ids.join(",")}`, `/me/library/contains?uris=${ids.map((i) => `spotify:track:${i}`).join(",")}`]) {
  try {
    console.log(path.split("?")[0], "→", JSON.stringify(await spotify(m!.spotify_id, path)));
  } catch (e) {
    console.log(path.split("?")[0], "→", (e as Error).message.slice(0, 150));
  }
}
