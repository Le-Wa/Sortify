import { notFound } from "next/navigation";
import { requireMember } from "@/lib/auth";
import { playlistCandidates } from "@/lib/playlists-import";
import { PlaylistsScreen } from "../../revelation/PlaylistsScreen";

/**
 * Planche vivante de l'étape « Tes playlists » (développement seulement) : tes vraies playlists, lecture seule.
 * Valider ne fait rien pour un membre qui a déjà ses bacs (l'action le refuse).
 */
export default async function PlaylistsLab() {
  if (process.env.NODE_ENV === "production") notFound();
  const member = await requireMember();
  return (
    <main className="page page--bare">
      <PlaylistsScreen candidates={await playlistCandidates(member.spotify_id)} />
    </main>
  );
}
