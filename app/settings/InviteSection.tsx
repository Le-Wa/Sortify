"use client";

import { useState } from "react";

export default function InviteSection() {
  const [code, setCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/invites/generate", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Erreur inattendue");
        return;
      }
      setCode(data.code);
    } finally {
      setLoading(false);
    }
  }

  async function copy() {
    if (!code) return;
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <section className="s-card" style={{ marginTop: "1.5rem" }}>
      <h3 className="s-section-title">Invitations</h3>
      <p style={{ color: "var(--ink-dim)", marginBottom: "1rem", fontSize: "0.875rem" }}>
        Partage Sortify avec quelqu&apos;un. Le code expire après 7 jours (max 5 actifs).
      </p>

      {!code ? (
        <div>
          {error && <p className="ob-error" style={{ marginBottom: "0.75rem" }}>{error}</p>}
          <button className="s-btn s-btn-primary" onClick={generate} disabled={loading}>
            {loading ? "Génération…" : "Générer un code d'invitation"}
          </button>
        </div>
      ) : (
        <div className="ob-invite-result">
          <code className="ob-invite-code">{code}</code>
          <button className="s-btn s-btn-sm" onClick={copy}>
            {copied ? "Copié !" : "Copier"}
          </button>
          <button
            className="s-btn s-btn-sm"
            onClick={() => setCode(null)}
            style={{ marginLeft: "0.5rem" }}
          >
            Nouveau code
          </button>
        </div>
      )}
    </section>
  );
}
