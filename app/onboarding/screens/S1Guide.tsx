"use client";

const REDIRECT_URI = "https://sortify.app/api/auth/spotify-byok/callback";

type Props = { onNext: () => void; onBack: () => void };

export default function S1Guide({ onNext, onBack }: Props) {
  return (
    <div className="ob-screen">
      <button className="ob-back" onClick={onBack}>← Retour</button>
      <h2 className="ob-step-title">Créer ton app Spotify</h2>
      <p className="ob-step-desc">
        Sortify a besoin de son propre accès à ton compte. Ça prend 2 minutes.
      </p>

      <ol className="ob-steps-list">
        <li>
          Ouvre{" "}
          <a
            href="https://developer.spotify.com/dashboard"
            target="_blank"
            rel="noopener noreferrer"
            className="ob-link"
          >
            developer.spotify.com/dashboard
          </a>
        </li>
        <li>Clique sur <strong>Create app</strong></li>
        <li>
          Dans <strong>Redirect URIs</strong>, ajoute exactement :
          <div className="ob-code-block">
            <code>{REDIRECT_URI}</code>
            <button
              className="ob-copy-btn"
              onClick={() => navigator.clipboard.writeText(REDIRECT_URI)}
            >
              Copier
            </button>
          </div>
        </li>
        <li>Coche <strong>Web API</strong> dans les APIs, puis sauvegarde</li>
        <li>Copie le <strong>Client ID</strong> et le <strong>Client Secret</strong></li>
      </ol>

      <button className="s-btn s-btn-primary ob-cta" onClick={onNext}>
        C&apos;est fait →
      </button>
    </div>
  );
}
