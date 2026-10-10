"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ImportStatus } from "../api/import/route";

const POLL_MS = 1500;
const SEGMENTS = 30;
const MONTHS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];

function likedOn(iso: string): string {
  const d = new Date(iso);
  return `liké en ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export function ImportScreen() {
  const [state, setState] = useState<ImportStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Pochette précédente gardée dessous : pas de flash pendant le chargement de la suivante.
  const [covers, setCovers] = useState<{ under: string | null; top: string | null }>({ under: null, top: null });
  const retryNext = useRef(false);

  const [round, setRound] = useState(0);

  /** Renvoie true tant que l'import tourne (il faut continuer à suivre). */
  const poll = useCallback(async (): Promise<boolean> => {
    const retry = retryNext.current;
    retryNext.current = false;
    try {
      const res = await fetch(`/api/import${retry ? "?retry=1" : ""}`, { method: "POST" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const next = (await res.json()) as ImportStatus;
      const cover = next.progress.current?.cover ?? null;
      setCovers((c) => (cover && cover !== c.top ? { under: c.top, top: cover } : c));
      setState(next);
      setError(null);
      return next.status === "running";
    } catch (e) {
      setError(`Connexion au serveur perdue (${e instanceof Error ? e.message : "erreur inconnue"}). On réessaie…`);
      return true;
    }
  }, []);

  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    const loop = async () => {
      const running = await poll();
      if (alive && running) timer = setTimeout(loop, POLL_MS);
    };
    void loop();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [poll, round]);

  const p = state?.progress;
  const done = state?.status === "done";
  const reading = !p || p.phase === "likes";
  const count = reading ? (p?.imported ?? 0) : p.enriched;
  const total = p?.imported ?? 0;
  const ratio = reading ? 0 : total ? count / total : 0;
  const filled = Math.round(ratio * SEGMENTS);
  const step = done
    ? "Tes likes sont prêts."
    : reading
      ? p?.mode === "tout"
        ? "Petite bibliothèque : on remonte plus loin…"
        : "On lit tes likes des 2 dernières années…"
      : "Genres, énergie et ambiances…";

  return (
    <>
      <div className="label muted">Première analyse · ~3 min</div>
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

      <div className="stack" style={{ gap: 4, alignItems: "center", textAlign: "center", minHeight: 48 }} aria-live="off">
        {p?.current ? (
          <>
            <div className="title" style={{ fontSize: 20 }}>
              {p.current.title}
            </div>
            <div className="muted" style={{ fontSize: 14 }}>
              {p.current.artist} · {likedOn(p.current.liked_at)}
            </div>
          </>
        ) : null}
      </div>

      <div>
        <div className="row between" style={{ alignItems: "baseline" }}>
          <span className="mono" style={{ fontSize: 34 }}>
            {String(count).padStart(4, "0")}
          </span>
          <span className="mono muted" style={{ fontSize: 13 }}>
            {reading ? "likes lus" : `/ ${total.toLocaleString("fr-FR")} likes`}
          </span>
        </div>
        <div className="segments" aria-hidden="true">
          {Array.from({ length: SEGMENTS }, (_, i) => (
            <span key={i} className={i < filled ? "on" : i === filled && !done && !reading ? "now" : undefined} />
          ))}
        </div>
        <div style={{ marginTop: 10, fontSize: 14 }} role="status">
          {step}
        </div>
      </div>

      {state?.status === "failed" ? (
        <div className="notice notice--error stack" role="alert">
          <span>L&apos;import s&apos;est arrêté : {state.error ?? "erreur inconnue"}</span>
          <button
            type="button"
            className="btn btn--sm"
            onClick={() => {
              retryNext.current = true;
              setRound((r) => r + 1);
            }}
          >
            Réessayer
          </button>
        </div>
      ) : null}
      {error ? <p className="small muted">{error}</p> : null}

      <div className="grow" />
      <p className="small muted" style={{ margin: 0 }}>
        {done
          ? "Prochaine étape : l'IA imagine tes bacs à partir de ces likes."
          : "Tu peux fermer l'app : on continue sans toi, et tes bacs t'attendront en revenant."}
      </p>
    </>
  );
}
