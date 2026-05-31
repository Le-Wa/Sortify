"use client";

type Props = {
  onYes: () => void;
  onNo: () => void;
};

export default function S3Mode({ onYes, onNo }: Props) {
  return (
    <div className="ob-screen">
      <h2 className="ob-step-title">Tu as des playlists organisées ?</h2>
      <p className="ob-step-desc">
        Des playlists que tu as créées pour classer tes musiques par genre, humeur, ou contexte.
      </p>

      <div className="ob-choice-grid">
        <button className="ob-choice-card" onClick={onYes}>
          <span className="ob-choice-icon">🎵</span>
          <strong>Oui</strong>
          <span className="ob-choice-note">Importer ou partir de mes playlists</span>
        </button>
        <button className="ob-choice-card" onClick={onNo}>
          <span className="ob-choice-icon">✨</span>
          <strong>Non</strong>
          <span className="ob-choice-note">Laisser Sortify analyser ma bibliothèque</span>
        </button>
      </div>
    </div>
  );
}
