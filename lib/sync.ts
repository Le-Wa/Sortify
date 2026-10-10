import "server-only";
import type { Bac } from "./bacs";
import { coverJpegBase64 } from "./cover";
import { check, db } from "./db";
import { spotify } from "./spotify/client";
import { addToTop } from "./spotify/playlists";

/**
 * Pousse dans Spotify les placements pas encore synchronisés des bacs actifs (nouveaux titres en haut,
 * le plus récent tout en haut), et renvoie les pochettes qui avaient échoué (réessai silencieux, spec 01).
 * Renvoie le nombre de titres ajoutés.
 */
export async function syncMember(memberId: string): Promise<number> {
  const bacs = check(
    await db().from("bacs").select("*").eq("member_id", memberId).eq("status", "active").not("spotify_playlist_id", "is", null),
    "Lecture des bacs actifs",
  ) as Bac[];

  let added = 0;
  for (const bac of bacs) {
    if (!bac.cover_uploaded_at) await retryCover(memberId, bac);
    const rows = check(
      await db()
        .from("likes")
        .select("track_id, liked_at, placements!inner(bac_id, synced_at)")
        .eq("member_id", memberId)
        .eq("placements.bac_id", bac.id)
        .is("placements.synced_at", null)
        .order("liked_at", { ascending: false }),
      "Lecture des titres à pousser",
    ) as { track_id: string }[];
    if (rows.length === 0) continue;
    const ids = rows.map((r) => r.track_id);
    await addToTop(memberId, bac.spotify_playlist_id!, ids);
    for (let i = 0; i < ids.length; i += 200) {
      check(
        await db()
          .from("placements")
          .update({ synced_at: new Date().toISOString() })
          .eq("bac_id", bac.id)
          .in("track_id", ids.slice(i, i + 200)),
        "Titres poussés",
      );
    }
    added += ids.length;
  }
  return added;
}

async function retryCover(memberId: string, bac: Bac): Promise<void> {
  try {
    await spotify(memberId, `/playlists/${bac.spotify_playlist_id}/images`, {
      method: "PUT",
      headers: { "Content-Type": "image/jpeg" },
      body: await coverJpegBase64(bac),
    });
    check(await db().from("bacs").update({ cover_uploaded_at: new Date().toISOString() }).eq("id", bac.id), "Pochette envoyée");
  } catch (error) {
    console.warn(`Pochette de « ${bac.name} » toujours pas envoyée :`, error instanceof Error ? error.message : error);
  }
}
