"use client";

import { useState, useTransition } from "react";
import { newInvitation } from "./actions";

export function InviteCard({ code, members, max }: { code: string | null; members: number; max: number }) {
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [creating, startCreating] = useTransition();
  const full = members >= max;

  function create() {
    setError(null);
    startCreating(async () => {
      const result = await newInvitation().catch((e: unknown) => ({
        ok: false as const,
        message: e instanceof Error ? e.message : "Erreur inconnue.",
      }));
      if (!result.ok) setError(result.message);
    });
  }

  function copy(value: string) {
    navigator.clipboard.writeText(value).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      },
      (e: unknown) => setError(`Copie impossible : ${e instanceof Error ? e.message : "refusée par le navigateur"}.`),
    );
  }

  return (
    <div className="counter" style={{ gap: 10, padding: 14 }}>
      <div className="row between">
        <span style={{ fontWeight: 600 }}>Inviter un pote</span>
        <span className="mono small muted">
          {members} / {max} places
        </span>
      </div>
      {code ? (
        <div className="row">
          <span className="code-slot">{code}</span>
          <button type="button" className="btn btn--accent btn--sm" onClick={() => copy(code)}>
            {copied ? "Copié" : "Copier"}
          </button>
        </div>
      ) : null}
      <button type="button" className={code ? "link-btn" : "btn btn--accent"} onClick={create} disabled={creating || full} style={code ? { alignSelf: "flex-start", color: "inherit" } : undefined}>
        {full ? "Plus de place" : creating ? "Création…" : code ? "Créer un autre code" : "Créer un code"}
      </button>
      {error ? (
        <p role="alert" className="small" style={{ margin: 0, color: "var(--accent)" }}>
          {error}
        </p>
      ) : null}
      <p className="small muted" style={{ margin: 0 }}>
        Pense aussi à ajouter son compte dans ton dashboard Spotify.
      </p>
    </div>
  );
}
