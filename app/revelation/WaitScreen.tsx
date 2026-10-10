"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useRevelation } from "./useRevelation";

const SEGMENTS = 30;
const MONTHS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];

function likedOn(iso: string): string {
  const d = new Date(iso);
  return `liké en ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** Import puis analyse : « On fouille tes bacs », avec tes vraies pochettes. */
export function WaitScreen({ stage }: { stage: "import" | "analyse" }) {
  const { state, error, retry } = useRevelation(stage, (s) => "status" in s && s.status === "running");
  // Pochette précédente gardée dessous : pas de flash pendant le chargement de la suivante.
  const [covers, setCovers] = useState<{ under: string | null; top: string | null }>({ under: null, top: null });
  const [tick, setTick] = useState(0);

  const imp = state?.stage === "import" ? state : null;
  const ana = state?.stage === "analyse" ? state : null;

  // Pendant l'analyse, on feuillette des pochettes de la bibliothèque.
  useEffect(() => {
    if (stage !== "analyse") return;
    const timer = setInterval(() => setTick((t) => t + 1), 1600);
    return () => clearInterval(timer);
  }, [stage]);

  const cover = imp?.progress.current?.cover ?? (ana && ana.covers.length ? ana.covers[tick % ana.covers.length] : null);
  // Nouvelle pochette : l'ancienne passe dessous (mise à jour pendant le rendu, sans effet).
  if (cover && cover !== covers.top) setCovers({ under: covers.top, top: cover });

  let count = 0;
  let suffix = "";
  let ratio = 0;
  let step = "On lit tes likes des 2 dernières années…";
  if (imp) {
    const p = imp.progress;
    if (p.phase === "likes") {
      count = p.imported;
      suffix = "likes lus";
      if (p.mode === "tout") step = "Petite bibliothèque : on remonte plus loin…";
    } else {
      count = p.enriched;
      suffix = `/ ${p.imported.toLocaleString("fr-FR")} likes`;
      ratio = p.imported ? p.enriched / p.imported : 0;
      step = "Genres, énergie et ambiances…";
    }
  } else if (ana) {
    const p = ana.progress;
    if (p.phase === "fiches" || p.phase === "complement" || p.phase === "remplissage") {
      step = "L'IA écoute l'ensemble et imagine tes bacs…";
      ratio = 0.5;
    } else {
      count = p.sorted;
      suffix = `/ ${p.total.toLocaleString("fr-FR")} rangés`;
      ratio = p.total ? 0.5 + (0.5 * p.sorted) / p.total : 0.5;
      step = "On essaie les bacs sur tes titres…";
    }
  }
  const filled = Math.round(ratio * SEGMENTS);
  const failed = state && "status" in state && state.status === "failed" ? state : null;

  return (
    <>
      <div className="label muted">Première analyse · ~5 min</div>
      <h1 className="display" style={{ fontSize: 58 }}>
        On fouille
        <br />
        tes bacs.
      </h1>

      <div className="crate" aria-hidden="true">
        <span className="crate__back crate__back--3" />
        <span className="crate__back crate__back--2" />
        <span className="crate__back crate__back--1" />
        <span className="crate__front">
          {covers.under ? <Image key={covers.under} src={covers.under} alt="" fill sizes="220px" className="under" /> : null}
          {covers.top ? <Image key={covers.top} src={covers.top} alt="" fill sizes="220px" /> : null}
        </span>
        <span className="crate__label">Bac en cours d&apos;écoute</span>
      </div>

      <div className="stack" style={{ gap: 4, alignItems: "center", textAlign: "center", minHeight: 48 }}>
        {imp?.progress.current ? (
          <>
            <div className="title" style={{ fontSize: 20 }}>
              {imp.progress.current.title}
            </div>
            <div className="muted" style={{ fontSize: 14 }}>
              {imp.progress.current.artist} · {likedOn(imp.progress.current.liked_at)}
            </div>
          </>
        ) : null}
      </div>

      <div>
        <div className="row between" style={{ alignItems: "baseline" }}>
          <span className="mono" style={{ fontSize: 34 }}>
            {suffix ? String(count).padStart(4, "0") : "····"}
          </span>
          <span className="mono muted" style={{ fontSize: 13 }}>
            {suffix}
          </span>
        </div>
        <div className="segments" aria-hidden="true">
          {Array.from({ length: SEGMENTS }, (_, i) => (
            <span key={i} className={i < filled ? "on" : i === filled ? "now" : undefined} />
          ))}
        </div>
        <div style={{ marginTop: 10, fontSize: 14 }} role="status">
          {step}
        </div>
      </div>

      {failed ? (
        <div className="notice notice--error stack" role="alert">
          <span>
            {stage === "import" ? "L'import" : "L'analyse"} s&apos;est arrêté{stage === "analyse" ? "e" : ""} :{" "}
            {failed.error ?? "erreur inconnue"}
          </span>
          <button type="button" className="btn btn--sm" onClick={retry}>
            Réessayer
          </button>
        </div>
      ) : null}
      {error ? <p className="small muted">{error}</p> : null}

      <div className="grow" />
      <p className="small muted" style={{ margin: 0 }}>
        Tu peux fermer l&apos;app : on continue sans toi, et tes bacs t&apos;attendront en revenant.
      </p>
    </>
  );
}
