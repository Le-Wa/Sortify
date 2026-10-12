"use client";

import { useState, useTransition } from "react";
import { startPowerLogin } from "./actions";

export function PowerForm() {
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <form
      className="stack"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        start(async () => {
          const result = await startPowerLogin({ clientId, clientSecret, code }).catch((err: unknown) => ({
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
