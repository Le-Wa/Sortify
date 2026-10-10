"use client";

import { signOut } from "next-auth/react";
import { useState, useTransition } from "react";
import { deleteMyData, relaunchAnalysis } from "./actions";

export function ReanalyseCard({ running }: { running: boolean }) {
  const [state, setState] = useState<{ ok: boolean; text: string } | null>(
    running ? { ok: true, text: "L'analyse tourne : ses propositions arriveront sur l'accueil." } : null,
  );
  const [pending, start] = useTransition();
  return (
    <div className="panel">
      <div className="row" style={{ gap: 12, alignItems: "center" }}>
        <div className="grow">
          <div style={{ fontWeight: 600 }}>Relancer l&apos;analyse</div>
          <div className="small muted" style={{ marginTop: 2 }}>
            L&apos;IA peut proposer d&apos;ajouter, supprimer ou fusionner des bacs. Tu valides chaque changement sur l&apos;accueil.
          </div>
        </div>
        <button
          type="button"
          className="btn btn--ghost btn--sm"
          disabled={pending || running || state?.ok === true}
          onClick={() =>
            start(async () => {
              const r = await relaunchAnalysis().catch((e: unknown) => ({ ok: false as const, message: e instanceof Error ? e.message : "Erreur" }));
              setState(r.ok ? { ok: true, text: "C'est parti : l'IA réécoute ta bibliothèque (2 à 3 min). Ses propositions arriveront sur l'accueil." } : { ok: false, text: r.message });
            })
          }
        >
          Relancer
        </button>
      </div>
      {state ? (
        <p className={state.ok ? "small" : "small danger-btn"} role="status" style={{ margin: 0 }}>
          {state.text}
        </p>
      ) : null}
    </div>
  );
}

export function DeleteData({ isOwner }: { isOwner: boolean }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (!open) {
    return (
      <button type="button" className="btn btn--quiet danger-btn" onClick={() => setOpen(true)}>
        Supprimer mes données Sortify
      </button>
    );
  }
  return (
    <div className="panel" style={{ border: "1.5px solid var(--danger)" }}>
      <p style={{ margin: 0, fontWeight: 700 }}>Supprimer tes données Sortify ?</p>
      <p className="small muted" style={{ margin: 0 }}>
        Tes bacs, corrections et historique sont effacés. Tes playlists restent dans Spotify.
        {isOwner ? " Tu perdras aussi ton rôle de propriétaire : pour revenir, il te faudra un code d'invitation d'un autre membre." : ""}
      </p>
      <label className="small" htmlFor="confirm-delete">
        Tape SUPPRIMER pour confirmer
      </label>
      <input id="confirm-delete" className="field" value={text} autoComplete="off" onChange={(e) => setText(e.target.value)} />
      {error ? (
        <p className="small danger-btn" role="alert" style={{ margin: 0 }}>
          {error}
        </p>
      ) : null}
      <div className="row" style={{ gap: 6 }}>
        <button type="button" className="btn btn--ghost btn--sm grow" onClick={() => setOpen(false)}>
          Annuler
        </button>
        <button
          type="button"
          className="btn btn--sm grow"
          style={{ background: "var(--danger)", color: "#ffffff" }}
          disabled={pending || text !== "SUPPRIMER"}
          onClick={() =>
            start(async () => {
              const r = await deleteMyData(text).catch((e: unknown) => ({ ok: false as const, message: e instanceof Error ? e.message : "Erreur" }));
              if (!r.ok) return setError(r.message);
              await signOut({ callbackUrl: "/" }).catch((e: unknown) => setError(`Données supprimées, mais déconnexion impossible : ${e instanceof Error ? e.message : "erreur"}`));
            })
          }
        >
          {pending ? "Suppression…" : "Supprimer"}
        </button>
      </div>
    </div>
  );
}
