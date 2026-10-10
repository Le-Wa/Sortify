import "server-only";
import { spotify } from "./client";

const CHUNK = 100; // limite Spotify par appel
const uri = (trackId: string) => `spotify:track:${trackId}`;

/**
 * Ajoute des titres en haut d'une playlist, dans l'ordre donné (le premier tout en haut).
 * Spec 01 : les nouveaux titres sont ajoutés en haut.
 */
export async function addToTop(memberId: string, playlistId: string, trackIds: string[]): Promise<void> {
  for (let i = 0; i < trackIds.length; i += CHUNK) {
    await spotify(memberId, `/playlists/${playlistId}/items`, {
      method: "POST",
      json: { uris: trackIds.slice(i, i + CHUNK).map(uri), position: i },
    });
  }
}

/** Ajoute des titres à la fin (création initiale : du plus récent au plus ancien). */
export async function append(memberId: string, playlistId: string, trackIds: string[]): Promise<void> {
  for (let i = 0; i < trackIds.length; i += CHUNK) {
    await spotify(memberId, `/playlists/${playlistId}/items`, {
      method: "POST",
      json: { uris: trackIds.slice(i, i + CHUNK).map(uri) },
    });
  }
}

export async function removeFromPlaylist(memberId: string, playlistId: string, trackIds: string[]): Promise<void> {
  for (let i = 0; i < trackIds.length; i += CHUNK) {
    await spotify(memberId, `/playlists/${playlistId}/items`, {
      method: "DELETE",
      json: { items: trackIds.slice(i, i + CHUNK).map((id) => ({ uri: uri(id) })) },
    });
  }
}
