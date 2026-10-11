import Link from "next/link";
import { redirect } from "next/navigation";
import { currentMember } from "@/lib/auth";
import { homeFor } from "@/lib/library";
import { Sleeve } from "./ui/Sleeve";
import { SpotifyButton } from "./ui/SpotifyButton";

const ERRORS: Record<string, string> = {
  invitation: "Première fois ici ? Il te faut un code d'invitation.",
  code: "Ce code n'est plus valable. Demande-en un nouveau à la personne qui te l'a donné.",
  complet: "Sortify est complet : 25 comptes maximum.",
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

  return (
    <main className="page page--bare">
      <div className="row between label">
        <span className="display display--s">Sortify</span>
        <span>Disquaire perso · bac 00</span>
      </div>

      <div className="hero-stack" aria-hidden="true">
        <Sleeve name="Soirée potes" color="#FF6A13" size={196} rotate={-9} className="hero-a" />
        <Sleeve name="Club 2h du mat'" color="#2448D8" size={196} rotate={6} className="hero-b" />
        <Sleeve name="Dimanche lent" color="#FF9FCB" size={196} corner="168 titres" rotate={-1.5} className="hero-c" />
      </div>

      <h1 className="display display--xl">
        Tu likes.
        <br />
        Sortify range.
      </h1>

      <ol className="steps">
        <li>
          <span className="mono">01</span>
          <span>
            <b>Tu likes sur Spotify</b>, comme d&apos;habitude.
          </span>
        </li>
        <li>
          <span className="mono">02</span>
          <span>
            <b>L&apos;IA imagine tes bacs</b> à partir de 2 ans de likes.
          </span>
        </li>
        <li>
          <span className="mono">03</span>
          <span>
            <b>Elle range chaque nouveau like</b>, tous les jours.
          </span>
        </li>
      </ol>

      <div className="grow" />

      {error ? (
        <p className="notice notice--error" role="alert">
          {error}
        </p>
      ) : null}

      <div className="stack">
        <SpotifyButton />
        <p className="small muted" style={{ textAlign: "center", margin: 0 }}>
          Tes playlists actuelles ne sont pas touchées.
        </p>
        <Link href="/invitation" className="link-btn" style={{ alignSelf: "center", display: "flex", alignItems: "center" }}>
          Première fois ? J&apos;ai un code d&apos;invitation
        </Link>
      </div>
    </main>
  );
}
