import { redirect } from "next/navigation";
import { currentMember } from "@/lib/auth";
import { homeFor } from "@/lib/library";
import { SpotifyButton } from "./ui/SpotifyButton";
import { ConnexionView } from "./ui/ConnexionView";

const ERRORS: Record<string, string> = {
  invitation: "Première fois ici ? Il te faut un code d'invitation.",
  code: "Ce code n'est plus valable. Demande-en un nouveau à la personne qui te l'a donné.",
  complet: "Sortify est complet : 5 comptes maximum avec l'app Spotify de Sortify. Passe par « Power user » avec ta propre app.",
};

// Erreurs renvoyées par NextAuth (?error=…) : en mode développement, Spotify refuse
// tout compte qui n'a pas été ajouté au dashboard de l'app.
const SPOTIFY_REFUSED =
  "Spotify a refusé la connexion. Si c'est ta première fois, la personne qui t'a invité doit d'abord ajouter ton compte Spotify à Sortify.";

export default async function ConnexionPage(props: PageProps<"/">) {
  const member = await currentMember();
  if (member) redirect(await homeFor(member.spotify_id));

  const params = await props.searchParams;
  const ours = typeof params.erreur === "string" ? ERRORS[params.erreur] : undefined;
  const error = ours ?? (typeof params.error === "string" ? SPOTIFY_REFUSED : undefined);

  return <ConnexionView error={error} primary={<SpotifyButton />} />;
}
