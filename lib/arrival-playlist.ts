import "server-only";
import { coverJpegBase64 } from "./cover";
import { check, db } from "./db";
import { getMember } from "./members";
import { spotify, SpotifyError } from "./spotify/client";

const NAME = "Arrivage de la semaine";
const DESCRIPTION = "Tes likes des 7 derniers jours, tous bacs confondus. Mise à jour par Sortify à chaque tri.";
/** Pochette de l'arrivage : noire, étoile de fête, comme un bac à part. */
const COVER = { name: NAME, sleeve_name: "Arrivage", color: "#111111", axis: "moment", shape: "starburst", outline: false, is_divers: false };

async function createPlaylist(memberId: string): Promise<string> {
  const playlist = await spotify<{ id: string }>(memberId, "/me/playlists", {
    method: "POST",
    json: { name: NAME, description: DESCRIPTION, public: false },
  });
  check(await db().from("members").update({ arrival_playlist_id: playlist.id }).eq("spotify_id", memberId), "Playlist de l'arrivage");
  try {
    await spotify(memberId, `/playlists/${playlist.id}/images`, { method: "PUT", headers: { "Content-Type": "image/jpeg" }, body: await coverJpegBase64(COVER) });
  } catch (error) {
    // Sans pochette, la playlist reste utile : on n'arrête rien.
    console.warn("Pochette de l'arrivage non envoyée :", error instanceof Error ? error.message : error);
  }
  return playlist.id;
}

/**
 * Remplit la playlist « Arrivage de la semaine » avec les likes des 7 derniers jours (plus récents en haut),
 * après chaque tri. La crée au premier passage. Renvoie le nombre de titres, ou null si le membre l'a désactivée.
 */
export async function refreshArrivalPlaylist(memberId: string, now = new Date()): Promise<number | null> {
  const member = await getMember(memberId);
  if (!member?.arrival_playlist) return null;
  const since = new Date(now.getTime() - 7 * 86_400_000).toISOString();
  const likes = check(
    await db()
      .from("likes")
      .select("track_id")
      .eq("member_id", memberId)
      .eq("excluded", false)
      .is("unliked_at", null)
      .gte("liked_at", since)
      .order("liked_at", { ascending: false })
      .limit(100),
    "Lecture de l'arrivage",
  ) as { track_id: string }[];
  const uris = likes.map((l) => `spotify:track:${l.track_id}`);

  let playlistId = member.arrival_playlist_id ?? (await createPlaylist(memberId));
  try {
    await spotify(memberId, `/playlists/${playlistId}/items`, { method: "PUT", json: { uris } });
  } catch (error) {
    // Playlist introuvable (supprimée pour de bon) : on en refait une.
    if (!(error instanceof SpotifyError) || error.status !== 404) throw error;
    playlistId = await createPlaylist(memberId);
    await spotify(memberId, `/playlists/${playlistId}/items`, { method: "PUT", json: { uris } });
  }
  return uris.length;
}
