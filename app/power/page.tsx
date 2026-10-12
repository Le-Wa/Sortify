import Link from "next/link";
import { powerRedirectUri } from "@/lib/power-login";
import { PowerForm } from "./PowerForm";

const ERRORS: Record<string, string> = {
  expire: "La connexion a pris trop de temps : recommence.",
  refus: "Connexion annulée ou refusée par Spotify.",
  code: "Code d'invitation invalide ou déjà utilisé.",
  invitation: "Il te faut un code d'invitation pour entrer dans Sortify.",
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
      <h1 className="display">Ta propre app Spotify</h1>
      <p className="muted" style={{ margin: 0 }}>
        Pour les power users : Sortify passe par ton app Spotify plutôt que par la sienne. Compte 5 minutes.
      </p>
      <ol className="small stack" style={{ gap: 6, paddingLeft: 18, margin: 0 }}>
        <li>
          Sur{" "}
          <a href="https://developer.spotify.com/dashboard" target="_blank" rel="noreferrer">
            developer.spotify.com/dashboard
          </a>
          , crée une app (API : « Web API »).
        </li>
        <li>
          Dans ses réglages, ajoute cette adresse de redirection (Redirect URI) :
          <br />
          <code className="mono" style={{ wordBreak: "break-all" }}>
            {powerRedirectUri()}
          </code>
        </li>
        <li>Dans « User Management », ajoute l&apos;e-mail de ton compte Spotify.</li>
        <li>Copie le Client ID et le Client Secret ci-dessous. Le secret est vérifié, puis gardé chiffré.</li>
      </ol>
      {error ? (
        <p className="notice notice--error" role="alert">
          {error}
        </p>
      ) : null}
      <PowerForm />
    </main>
  );
}
