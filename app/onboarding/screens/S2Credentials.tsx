"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";

type Props = {
  onSuccess: () => void;
  onDevBypass: () => void;
  onBack: () => void;
};

export default function S2Credentials({ onSuccess, onDevBypass, onBack }: Props) {
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

        {process.env.NODE_ENV !== "production" && (
          <button
            type="button"
            className="ob-cta-secondary"
            style={{ marginTop: 4, fontSize: 12 }}
            onClick={async () => {
              setLoading(true);
              setError(null);
              try {
                const res = await fetch("/api/dev/byok-skip", { method: "POST" });
                const data = await res.json();
                if (!res.ok) { setError(data.error ?? "Erreur"); return; }
                // Bypass OAuth — sign in directly with the handoff token
                const result = await signIn("byok-handoff", { token: data.token, redirect: false });
                if (result?.ok) onDevBypass();
                else setError("Sign-in échoué");
              } finally {
                setLoading(false);
              }
            }}
            disabled={loading}
          >
            ⚡ Dev — bypasser l&apos;OAuth Spotify
          </button>
        )}
      </form>
    </div>
  );
}
