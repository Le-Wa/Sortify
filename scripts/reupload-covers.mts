// Renvoie à Spotify la pochette Sortify de chaque bac actif (après un changement de design des pochettes).
// Usage : npm run try -- scripts/reupload-covers.mts
import { db } from "@/lib/db";
import { coverJpegBase64 } from "@/lib/cover";
import { spotify } from "@/lib/spotify/client";

const { data: bacs, error } = await db().from("bacs").select("id, member_id, name, sleeve_name, color, axis, shape, is_divers, spotify_playlist_id").eq("status", "active").not("spotify_playlist_id", "is", null);
if (error) throw new Error(error.message);
let ok = 0;
for (const bac of bacs ?? []) {
  try {
    await spotify(bac.member_id, `/playlists/${bac.spotify_playlist_id}/images`, {
      method: "PUT",
      headers: { "Content-Type": "image/jpeg" },
      body: await coverJpegBase64(bac),
    });
    await db().from("bacs").update({ cover_uploaded_at: new Date().toISOString() }).eq("id", bac.id);
    ok++;
  } catch (e) {
    console.error(`✗ ${bac.name} :`, e instanceof Error ? e.message : e);
  }
}
console.log(`${ok} / ${bacs?.length ?? 0} pochettes envoyées`);
