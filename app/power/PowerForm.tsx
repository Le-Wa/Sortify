"use client";

import { useState, useTransition } from "react";
import { startPowerLogin } from "./actions";

type PowerInput = { clientId: string; clientSecret: string; code: string; anthropicKey: string };

/** La démo (`/lab/onboarding`) passe sa propre vérification (`submit`) et sa suite (`onSuccess`) à la place de Spotify. */
export function PowerForm({
  submit = startPowerLogin,
  onSuccess = (url) => window.location.assign(url),
}: {
  submit?: (input: PowerInput) => Promise<{ ok: true; url: string } | { ok: false; message: string }>;
  onSuccess?: (url: string) => void;
}) {
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
          const result = await submit({ clientId, clientSecret, code, anthropicKey }).catch((err: unknown) => ({
            ok: false as const,
            message: err instanceof Error ? err.message : "Erreur",
          }));
          if (result.ok) onSuccess(result.url);
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

/** Titre et consignes de la page power user (aussi dans la démo de l'onboarding). */
export function PowerIntro({ redirectUri }: { redirectUri: string }) {
  return (
    <>
      <h1 className="display">Ta propre app Spotify</h1>
      <p className="muted" style={{ margin: 0 }}>
        Pour les power users : Sortify passe par ton app Spotify plutôt que par la sienne. Compte 5 minutes.
      </p>
      <ol className="small stack" style={{ gap: 6, paddingLeft: 18, margin: 0 }}>
        <li>
          Sur{" "}
          <a href="https://developer.spotify.com/dashboard" target="_blank" rel="noreferrer">
            developer.spotify.com/dashboard
          </a>
          , crée une app (API : « Web API »).
        </li>
        <li>
          Dans ses réglages, ajoute cette adresse de redirection (Redirect URI) :
          <br />
          <code className="mono" style={{ wordBreak: "break-all" }}>
            {redirectUri}
          </code>
        </li>
        <li>Dans « User Management », ajoute l&apos;e-mail de ton compte Spotify.</li>
        <li>Copie le Client ID et le Client Secret ci-dessous. Le secret est vérifié, puis gardé chiffré.</li>
      </ol>
    </>
  );
}
