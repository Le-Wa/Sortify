"use client";

import { useState } from "react";

type Props = {
  onSuccess: () => void;
  onBack: () => void;
};

export default function S2Credentials({ onSuccess, onBack }: Props) {
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/onboarding/credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client_id: clientId.trim(), client_secret: clientSecret.trim() }),
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

  const isValid = clientId.trim().length === 32 && clientSecret.trim().length === 32;

  return (
    <div className="ob-screen">
      <button className="ob-back" onClick={onBack}>← Retour</button>
      <h2 className="ob-step-title">Tes credentials Spotify</h2>
      <p className="ob-step-desc">
        Copie ton Client ID et ton Client Secret depuis le dashboard Spotify.
      </p>

      <form className="ob-form" onSubmit={handleSubmit}>
        <label className="ob-label">
          Client ID
          <input
            className="ob-input ob-input-mono"
            type="text"
            placeholder="32 caractères hexadécimaux"
            value={clientId}
            onChange={(e) => setClientId(e.target.value.trim())}
            autoComplete="off"
            spellCheck={false}
            maxLength={32}
          />
        </label>

        <label className="ob-label">
          Client Secret
          <input
            className="ob-input ob-input-mono"
            type="password"
            placeholder="32 caractères hexadécimaux"
            value={clientSecret}
            onChange={(e) => setClientSecret(e.target.value.trim())}
            autoComplete="new-password"
            spellCheck={false}
            maxLength={32}
          />
        </label>

        {error && <p className="ob-error">{error}</p>}

        <p className="ob-security-note">
          🔒 Le Client Secret est chiffré (AES-256-GCM) avant stockage et n&apos;est jamais retourné.
        </p>

        <button className="s-btn s-btn-primary ob-cta" disabled={!isValid || loading}>
          {loading ? "Vérification…" : "Valider et connecter Spotify →"}
        </button>
      </form>
    </div>
  );
}
