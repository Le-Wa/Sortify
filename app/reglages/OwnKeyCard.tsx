"use client";

import { useState, useTransition } from "react";
import { saveAnthropicKey } from "./actions";

/** Onboarding « power user » : ta propre clé Anthropic, l'IA de Sortify est alors facturée sur ton compte. */
export function OwnKeyCard({ hint }: { hint: string | null }) {
  const [key, setKey] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function save(value: string | null) {
    setError(null);
    start(async () => {
      const result = await saveAnthropicKey(value).catch((e: unknown) => ({ ok: false as const, message: e instanceof Error ? e.message : "Erreur" }));
      if (result.ok) setKey("");
      else setError(result.message);
    });
  }

  return (
    <div className="panel">
      <span className="row between">
        <b style={{ fontSize: 15 }}>Ta clé Anthropic</b>
        <span className="mono small muted">facultatif</span>
      </span>
      {hint ? (
        <>
          <span className="small">
            Clé <span className="mono">••••{hint}</span> enregistrée : l&apos;IA de Sortify (analyse, tri, nouveaux bacs) passe par ton compte Anthropic.
          </span>
          <button type="button" className="btn btn--ghost btn--sm" disabled={pending} onClick={() => save(null)}>
            {pending ? "…" : "Retirer ma clé"}
          </button>
        </>
      ) : (
        <form
          className="stack"
          onSubmit={(e) => {
            e.preventDefault();
            save(key);
          }}
        >
          <span className="small muted">
            Pour les power users : avec ta propre clé, l&apos;IA de Sortify est facturée sur ton compte Anthropic (environ 0,2 centime par titre rangé, quelques
            dollars pour une première analyse). Elle est vérifiée, puis gardée chiffrée.
          </span>
          <input
            className="field"
            type="password"
            autoComplete="off"
            spellCheck={false}
            placeholder="sk-ant-…"
            value={key}
            aria-label="Clé Anthropic"
            onChange={(e) => setKey(e.target.value)}
          />
          <button type="submit" className="btn btn--sm" disabled={pending || key.trim().length < 10}>
            {pending ? "Vérification…" : "Enregistrer ma clé"}
          </button>
        </form>
      )}
      {error ? (
        <p className="notice notice--error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
