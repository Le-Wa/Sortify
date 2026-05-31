"use client";

type Props = {
  onByok: () => void;
  onInvite: () => void;
};

export default function S0Landing({ onByok, onInvite }: Props) {
  return (
    <div className="ob-screen">
      <div className="ob-hero">
        <h1 className="ob-title">Sortify</h1>
        <p className="ob-subtitle">Ton moteur de tri Spotify, en autonomie totale.</p>
      </div>

      <div className="ob-actions">
        <button className="s-btn s-btn-primary ob-cta" onClick={onByok}>
          Créer mon accès Spotify
        </button>
        <button className="s-btn ob-cta-secondary" onClick={onInvite}>
          J&apos;ai un code d&apos;invitation
        </button>
      </div>
    </div>
  );
}
