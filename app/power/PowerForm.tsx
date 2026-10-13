"use client";

import { useState, useTransition } from "react";
import { startPowerLogin } from "./actions";

export function PowerForm() {
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [code, setCode] = useState("");
  const [anthropicKey, setAnthropicKey] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <form
      className="stack"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        start(async () => {
          const result = await startPowerLogin({ clientId, clientSecret, code, anthropicKey }).catch((err: unknown) => ({
            ok: false as const,
            message: err instanceof Error ? err.message : "Erreur",
          }));
          if (result.ok) window.location.assign(result.url);
          else setError(result.message);
        });
      }}
    >
      <label className="label" htmlFor="client-id">
        Client ID
      </label>
      <input id="client-id" className="field" autoComplete="off" spellCheck={false} value={clientId} onChange={(e) => setClientId(e.target.value)} />
      <label className="label" htmlFor="client-secret">
        Client Secret
      </label>
      <input id="client-secret" className="field" type="password" autoComplete="off" spellCheck={false} value={clientSecret} onChange={(e) => setClientSecret(e.target.value)} />
      <label className="label" htmlFor="invite">
        Code d&apos;invitation (si tu n&apos;es pas encore membre)
      </label>
      <input id="invite" className="field" autoComplete="off" value={code} onChange={(e) => setCode(e.target.value)} />
      <label className="label" htmlFor="anthropic-key">
        Ta clé Anthropic (facultatif)
      </label>
      <input
        id="anthropic-key"
        className="field"
        type="password"
        autoComplete="off"
        spellCheck={false}
        placeholder="sk-ant-…"
        value={anthropicKey}
        onChange={(e) => setAnthropicKey(e.target.value)}
      />
      <span className="small muted">
        Avec ta clé, l&apos;IA de Sortify est facturée sur ton compte Anthropic dès la première analyse (quelques dollars, puis environ 0,2 centime par
        titre rangé). Vérifiée, puis gardée chiffrée ; tu pourras la retirer dans les Réglages.
      </span>
      {error ? (
        <p className="notice notice--error" role="alert">
          {error}
        </p>
      ) : null}
      <button type="submit" className="btn" disabled={pending || !clientId || !clientSecret}>
        {pending ? "Vérification…" : "Se connecter avec mon app Spotify"}
      </button>
    </form>
  );
}
