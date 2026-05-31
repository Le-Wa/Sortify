"use client";

import { useState } from "react";

type Props = {
  onSuccess: () => void;
  onBack: () => void;
};

export default function SInvite({ onSuccess, onBack }: Props) {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/invites/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Erreur inattendue");
        return;
      }
      onSuccess();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="ob-screen">
      <button className="ob-back" onClick={onBack}>← Retour</button>
      <h2 className="ob-step-title">Code d&apos;invitation</h2>
      <p className="ob-step-desc">Entre le code partagé par ton invitant.</p>

      <form className="ob-form" onSubmit={handleSubmit}>
        <input
          className="ob-input"
          type="text"
          placeholder="BEAT-A1B2C"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          autoFocus
          autoComplete="off"
          spellCheck={false}
        />
        {error && <p className="ob-error">{error}</p>}
        <button className="s-btn s-btn-primary ob-cta" disabled={!code.trim() || loading}>
          {loading ? "Vérification…" : "Continuer"}
        </button>
      </form>
    </div>
  );
}
