"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Sleeve } from "../../ui/Sleeve";
import { move } from "./actions";

interface Item {
  id: string;
  name: string;
  sleeve: string;
  color: string;
  autoFill: boolean;
  total: number;
  week: number;
}

export function BacList({ bacs }: { bacs: Item[] }) {
  const [reordering, setReordering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function shift(id: string, direction: -1 | 1) {
    setError(null);
    startTransition(async () => {
      const result = await move(id, direction).catch((e: unknown) => ({ ok: false as const, message: e instanceof Error ? e.message : "Erreur" }));
      if (!result.ok) setError(result.message);
    });
  }

  return (
    <>
      <div className="row between" style={{ margin: "-6px 4px 0" }}>
        <span className="small muted">Dans l&apos;ordre de ta rangée d&apos;accueil.</span>
        <button type="button" className="btn btn--ghost btn--sm" onClick={() => setReordering((r) => !r)}>
          {reordering ? "Terminé" : "Réordonner"}
        </button>
      </div>
      {error ? (
        <p className="notice notice--error" role="alert">
          {error}
        </p>
      ) : null}

      <div className="bins">
        {bacs.map((b, i) => {
          const body = (
            <span className="card bin__card">
              <span className="grow stack" style={{ gap: 2, minWidth: 0 }}>
                <span className={`bins__name ${reordering ? "bins__name--one-line" : ""}`}>{b.name}</span>
                {/* En mode Réordonner, place aux flèches : le nom seul suffit. */}
                {reordering ? null : (
                  <span className="mono small muted">
                    {b.total} titres · {b.week > 0 ? `+${b.week}` : "0"} cette semaine{b.autoFill ? "" : " · en pause"}
                  </span>
                )}
              </span>
              {reordering ? (
                <span className="row" style={{ gap: 4 }}>
                  <button type="button" className="icon-btn" aria-label={`Monter ${b.name}`} disabled={i === 0 || pending} onClick={() => shift(b.id, -1)}>
                    ↑
                  </button>
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label={`Descendre ${b.name}`}
                    disabled={i === bacs.length - 1 || pending}
                    onClick={() => shift(b.id, 1)}
                  >
                    ↓
                  </button>
                </span>
              ) : (
                <span aria-hidden="true" className="muted" style={{ fontSize: 18 }}>
                  ›
                </span>
              )}
            </span>
          );
          return reordering ? (
            <div key={b.id} className="bin" style={{ zIndex: i + 1 }}>
              {body}
              <Sleeve name={b.sleeve} color={b.color} size={60} className="bin__sleeve" />
            </div>
          ) : (
            <Link key={b.id} href={`/bacs/${b.id}`} className="bin" style={{ zIndex: i + 1 }}>
              {body}
              <Sleeve name={b.sleeve} color={b.color} size={60} className="bin__sleeve" />
            </Link>
          );
        })}
      </div>
    </>
  );
}
