"use client";

import { useState, useTransition } from "react";
import { newInvitation } from "./actions";

/**
 * Le pote doit être ajouté dans le dashboard Spotify (mode développement) avant de se connecter, sinon Spotify le refuse :
 * on le rappelle par une case à cocher avant de créer un code. L'API Spotify ne permet pas de le faire à sa place.
 */
export function InviteCard({ code, members, max, dashboardUrl }: { code: string | null; members: number; max: number; dashboardUrl: string }) {
  const [added, setAdded] = useState(false);
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
      {full ? null : (
        <>
          <p className="small" style={{ margin: 0 }}>
            Avant le code : ajoute l&apos;e-mail du compte Spotify de ton pote dans le dashboard Spotify, onglet « User Management » (nom + e-mail).
            Sinon, Spotify refusera sa connexion.{" "}
            <a href={dashboardUrl} target="_blank" rel="noreferrer">
              Ouvrir le dashboard ↗
            </a>
          </p>
          <label className="row" style={{ minHeight: 44, gap: 10, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={added}
              onChange={(e) => setAdded(e.target.checked)}
              style={{ width: 22, height: 22, flex: "none", accentColor: "var(--accent)" }}
            />
            <span className="small">J&apos;ai ajouté son e-mail dans le dashboard Spotify</span>
          </label>
        </>
      )}
      <button
        type="button"
        className={code ? "link-btn" : "btn btn--accent"}
        onClick={create}
        disabled={creating || (!full && !added)} style={code ? { alignSelf: "flex-start", color: "inherit" } : undefined}>
        {creating ? "Création…" : code ? "Créer un autre code" : full ? "Créer un code (power user)" : "Créer un code"}
      </button>
      {error ? (
        <p role="alert" className="small" style={{ margin: 0, color: "var(--accent)" }}>
          {error}
        </p>
      ) : null}
      {full ? (
        <p className="small muted" style={{ margin: 0 }}>
          Les places de l&apos;app Spotify de Sortify sont prises : ton pote peut encore entrer avec sa propre app Spotify (lien « power user » sur la page de
          connexion) et un code.
        </p>
      ) : null}
    </div>
  );
}
