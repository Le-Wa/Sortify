import Link from "next/link";
import { powerRedirectUri } from "@/lib/power-login";
import { PowerForm, PowerIntro } from "./PowerForm";

const ERRORS: Record<string, string> = {
  expire: "La connexion a pris trop de temps : recommence.",
  refus: "Connexion annulée ou refusée par Spotify.",
  cle: "Il manque ta clé Anthropic : recommence en la donnant.",
  spotify: "Spotify n'a pas pu finir la connexion : vérifie l'adresse de redirection de ton app.",
};

/** Power user : se connecter avec sa propre app Spotify (hors limite des 5 comptes de l'app de Sortify, ses propres quotas). */
export default async function PowerPage(props: PageProps<"/power">) {
  const { erreur } = await props.searchParams;
  const error = typeof erreur === "string" ? ERRORS[erreur] : undefined;
  return (
    <main className="page page--bare">
      <Link href="/" className="back">
        ‹ Connexion
      </Link>
      <PowerIntro redirectUri={powerRedirectUri()} />
      {error ? (
        <p className="notice notice--error" role="alert">
          {error}
        </p>
      ) : null}
      <PowerForm />
    </main>
  );
}
