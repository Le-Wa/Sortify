"use client";

import { useState, useTransition } from "react";
import { askOldLikes } from "./actions";

export interface OldLikesView {
  older: number;
  /** « mai 2025 » : date du plus ancien like déjà dans Sortify. */
  since: string;
  cost: string;
  minutes: number;
  direct: boolean;
  owner: string;
  request: "pending" | "refused" | null;
  job: { running: boolean; phase: string; fetched: number; placed: number; divers: number; failed: string | null } | null;
}

const PHASE: Record<string, string> = {
  likes: "On lit tes anciens likes…",
  enrich: "On écoute chaque titre…",
  rangement: "On les range dans tes bacs…",
  sync: "On les ajoute en bas de tes playlists…",
};

/** « Ranger mes anciens likes » : ceux d'avant la fenêtre d'import, à la demande. */
export function OldLikesCard({ view }: { view: OldLikesView }) {
  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function ask() {
    setMessage(null);
    start(async () => {
      const result = await askOldLikes().catch((e: unknown) => ({ ok: false as const, message: e instanceof Error ? e.message : "Erreur" }));
      if (!result.ok) setMessage(result.message);
    });
  }

  const job = view.job;
  return (
    <div className="panel">
      <span className="row between">
        <b style={{ fontSize: 15 }}>Tes anciens likes</b>
        <span className="mono small muted">avant {view.since}</span>
      </span>
      {job?.running ? (
        <span className="small" role="status">
          {PHASE[job.phase] ?? "En cours…"} {job.fetched > 0 ? `(${job.fetched.toLocaleString("fr-FR")} likes)` : ""} Tu peux fermer l&apos;app.
        </span>
      ) : view.request === "pending" ? (
        <span className="small">Demande envoyée à {view.owner} : tes anciens likes seront rangés dès que {view.owner} accepte.</span>
      ) : (
        <>
          <span className="small">
            Environ <b>{view.older.toLocaleString("fr-FR")} likes</b> plus anciens ne sont pas dans Sortify. On peut les ranger dans tes bacs (en bas des
            playlists) ; ceux qui ne vont nulle part iront dans Divers. Compte ~{view.minutes} min et {view.cost} d&apos;IA
            {view.direct ? "." : `, payés par ${view.owner}, qui valide d'abord.`}
          </span>
          {view.request === "refused" ? <span className="small muted">{view.owner} a refusé ta dernière demande.</span> : null}
          {job?.failed ? <span className="small muted">La dernière tentative s&apos;est arrêtée : {job.failed}</span> : null}
          {!job?.failed && job && !job.running && job.placed + job.divers > 0 ? (
            <span className="small muted">
              Déjà fait : {job.placed.toLocaleString("fr-FR")} dans tes bacs, {job.divers.toLocaleString("fr-FR")} dans Divers.
            </span>
          ) : null}
          <button type="button" className="btn btn--sm" disabled={pending} onClick={ask}>
            {pending ? "…" : view.direct ? "Ranger mes anciens likes" : `Demander à ${view.owner}`}
          </button>
        </>
      )}
      {message ? (
        <p className="notice notice--error" role="alert">
          {message}
        </p>
      ) : null}
    </div>
  );
}
