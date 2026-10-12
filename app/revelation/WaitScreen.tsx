"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useRevelation } from "./useRevelation";

const SEGMENTS = 30;

/**
 * Part de la jauge de chaque étape de l'analyse, et durée typique des étapes faites d'un seul appel à l'IA :
 * elles avancent au temps écoulé (en ralentissant, sans jamais finir avant l'étape suivante).
 */
const ANALYSE_STEPS = {
  fiches: { from: 0, to: 0.4, seconds: 150, text: "L'IA écoute l'ensemble et imagine tes bacs…" },
  rangement: { from: 0.4, to: 0.85, seconds: 0, text: "On essaie les bacs sur tes titres…" },
  complement: { from: 0.85, to: 0.92, seconds: 60, text: "On cherche une maison aux titres restants…" },
  remplissage: { from: 0.92, to: 1, seconds: 60, text: "On remplit les derniers bacs…" },
} as const;

function timeShare(startedAt: string | undefined, seconds: number): number {
  if (!startedAt) return 0;
  const elapsed = Math.max(0, (Date.now() - Date.parse(startedAt)) / 1000);
  return 1 - Math.exp(-elapsed / seconds);
}
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
    if (p.phase === "done") {
      ratio = 1;
    } else {
      const s = ANALYSE_STEPS[p.phase];
      step = s.text;
      let share = timeShare(p.phaseStartedAt, s.seconds || 1);
      if (p.phase === "rangement") {
        count = p.sorted;
        suffix = `/ ${p.total.toLocaleString("fr-FR")} rangés`;
        share = p.total ? p.sorted / p.total : 0;
      }
      ratio = s.from + (s.to - s.from) * share;
    }
  }
  const filled = Math.round(ratio * SEGMENTS);
  // Durées mesurées : ~4 titres enrichis par seconde (Last.fm, Deezer, ReccoBeats), puis 4 à 8 min d'analyse.
  const estimate = imp
    ? `Première analyse · ~${Math.max(8, Math.round(6 + imp.progress.imported / 240))} min en tout`
    : "L'IA travaille · 4 à 8 min";
  const failed = state && "status" in state && state.status === "failed" ? state : null;

  return (
    <>
      <div className="label muted">{estimate}</div>
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
