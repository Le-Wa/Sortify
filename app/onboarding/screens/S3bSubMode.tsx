"use client";

type Props = {
  onImport: () => void;
  onScratch: () => void;
  onBack: () => void;
};

export default function S3bSubMode({ onImport, onScratch, onBack }: Props) {
  return (
    <div className="ob-screen">
      <button className="ob-back" onClick={onBack}>← Retour</button>
      <h2 className="ob-step-title">Comment veux-tu organiser ?</h2>

      <div className="ob-choice-grid">
        <button className="ob-choice-card" onClick={onImport}>
          <span className="ob-choice-icon">📥</span>
          <strong>Importer mes playlists</strong>
          <span className="ob-choice-note">
            Sortify apprend de tes playlists existantes et classe automatiquement le reste
          </span>
        </button>
        <button className="ob-choice-card" onClick={onScratch}>
          <span className="ob-choice-icon">🎨</span>
          <strong>Nouvelle organisation</strong>
          <span className="ob-choice-note">
            Tu définis des catégories et Sortify remplit tout
          </span>
        </button>
      </div>
    </div>
  );
}
