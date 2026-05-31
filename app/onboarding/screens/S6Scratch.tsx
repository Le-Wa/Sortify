"use client";

import { useState } from "react";

type Props = {
  onNext: (name: string) => void;
  onBack: () => void;
};

export default function S6Scratch({ onNext, onBack }: Props) {
  const [name, setName] = useState("");

  return (
    <div className="ob-screen">
      <button className="ob-back" onClick={onBack}>← Retour</button>
      <h2 className="ob-step-title">Première playlist</h2>
      <p className="ob-step-desc">Quel nom pour cette catégorie musicale ?</p>

      <form
        className="ob-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) onNext(name.trim());
        }}
      >
        <input
          className="ob-input"
          type="text"
          placeholder="ex: Deep Work, Soirée, Running…"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
          maxLength={80}
        />
        <button className="s-btn s-btn-primary ob-cta" disabled={!name.trim()}>
          Suivant →
        </button>
      </form>
    </div>
  );
}
