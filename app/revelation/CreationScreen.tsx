"use client";

import Link from "next/link";
import { inkFor } from "@/lib/bac-colors";
import { SleeveMarkSvg } from "@/lib/sleeve-mark";
import { shapeBox, sleeveLayout } from "@/lib/sleeve-layout";
import type { CreationBac } from "@/lib/creation";
import { useRevelation } from "./useRevelation";

/** « On presse tes bacs » : chaque bac devient une playlist et se remplit sous tes yeux. */
export function CreationScreen() {
  const { state, error, retry } = useRevelation(["creation", "done"], (s) => s.stage === "creation" && s.status === "running");
  const creation = state?.stage === "creation" ? state : null;
  const done = state?.stage === "done";
  const bacs = (state?.stage === "done" ? state.creation?.bacs : creation?.progress.bacs) ?? [];
  const regular = bacs.filter((b) => !b.is_divers);
  const current = bacs.find((b) => !b.done);
  const pressed = regular.filter((b) => b.done).length;

  return (
    <>
      <div className="label muted">Création dans Spotify</div>
      <h1 className="display" style={{ fontSize: 58 }}>
        On presse
        <br />
        {regular.length ? `tes ${regular.length} bacs.` : "tes bacs."}
      </h1>
      <p className="muted" style={{ margin: 0, maxWidth: "32ch" }}>
        Chaque bac devient une playlist, avec sa pochette Sortify.
      </p>

      <div className="press">
        {bacs.map((b) => (
          <PressTile key={b.id} bac={b} active={current?.id === b.id} />
        ))}
      </div>

      <div className="row between" style={{ alignItems: "baseline" }} role="status">
        <span style={{ fontWeight: 700 }}>
          {done ? "Tout est dans Spotify." : current ? `${current.name} se remplit…` : "On prépare la presse…"}
        </span>
        <span className="mono muted small">
          {done ? regular.length : pressed} / {regular.length}
        </span>
      </div>

      {creation?.status === "failed" ? (
        <div className="notice notice--error stack" role="alert">
          <span>La création s&apos;est arrêtée : {creation.error ?? "erreur inconnue"}</span>
          <button type="button" className="btn btn--sm" onClick={retry}>
            Reprendre
          </button>
        </div>
      ) : null}
      {error ? <p className="small muted">{error}</p> : null}

      <div className="grow" />
      {done ? (
        <Link href="/accueil" className="btn">
          Voir mes bacs
        </Link>
      ) : (
        <button type="button" className="btn" disabled>
          Voir mes bacs
        </button>
      )}
    </>
  );
}

function PressTile({ bac, active }: { bac: CreationBac; active: boolean }) {
  const ratio = bac.done ? 1 : bac.total ? bac.added / bac.total : 0;
  const { lines, fontSize, padding, small } = sleeveLayout(bac.sleeve, 104);
  const lit = bac.done || ratio >= 0.5;
  return (
    <div className={`press__tile ${active ? "is-active" : ""} ${bac.done ? "is-done" : ""}`} style={{ padding }}>
      <span className="press__fill" style={{ height: `${ratio * 100}%`, background: bac.color }} />
      {/* Anciennes progressions enregistrées sans forme : pochette nue. */}
      {bac.mark ? (
        <span style={{ color: lit ? inkFor(bac.color) : "var(--mid)", transition: "color 0.3s" }}>
          <SleeveMarkSvg mark={bac.mark} ink="currentColor" {...shapeBox(bac.sleeve, 104)} />
        </span>
      ) : null}
      <span className="press__text" style={{ color: lit ? inkFor(bac.color) : undefined }}>
        <span className="row between mono" style={{ fontSize: small + 2 }}>
          {/* Compteur à gauche : le coin droit est pour la forme. */}
          <span>
            {bac.is_divers ? "caisse " : ""}
            {bac.done ? `✓ ${bac.total}` : active ? `${bac.added} / ${bac.total}` : ""}
          </span>
        </span>
        <span className="sleeve__name" style={{ fontSize }}>
          {lines.map((l, i) => (
            <span key={i} style={{ display: "block" }}>
              {l}
            </span>
          ))}
        </span>
      </span>
    </div>
  );
}
