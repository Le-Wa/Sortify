"use client";

import { useState, useTransition } from "react";
import { decideOldLikesRequest } from "../../reglages/actions";

export interface OldLikesRequestView {
  id: string;
  name: string;
  estimate: number;
  cost: string;
}

/** Accueil du propriétaire : demandes « Ranger mes anciens likes » des membres sur la clé de Sortify. */
export function OldLikesRequests({ requests }: { requests: OldLikesRequestView[] }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, start] = useTransition();

  function decide(id: string, accept: boolean) {
    setBusy(id);
    setError(null);
    start(async () => {
      const result = await decideOldLikesRequest(id, accept).catch((e: unknown) => ({ ok: false as const, message: e instanceof Error ? e.message : "Erreur" }));
      setBusy(null);
      if (!result.ok) setError(result.message);
    });
  }

  return (
    <>
      {requests.map((r) => (
        <section key={r.id} className="suggestion card" aria-busy={busy === r.id}>
          <div className="grow stack" style={{ gap: 6 }}>
            <b style={{ fontSize: 15, lineHeight: 1.25 }}>
              {r.name} demande à ranger ~{r.estimate.toLocaleString("fr-FR")} anciens likes
            </b>
            <span style={{ fontSize: 13, lineHeight: 1.35 }}>Coût estimé de l&apos;IA : {r.cost}, sur ton compte.</span>
            <span className="row" style={{ gap: 6 }}>
              <button type="button" className="btn btn--sm" disabled={busy !== null} onClick={() => decide(r.id, true)}>
                {busy === r.id ? "…" : "Accepter"}
              </button>
              <button type="button" className="btn btn--ghost btn--sm" disabled={busy !== null} onClick={() => decide(r.id, false)}>
                Refuser
              </button>
            </span>
          </div>
        </section>
      ))}
      {error ? (
        <p className="notice notice--error" role="alert">
          {error}
        </p>
      ) : null}
    </>
  );
}
