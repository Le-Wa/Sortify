"use client";

import Image from "next/image";
import { useState, useTransition } from "react";
import type { PlaylistCandidate, PlaylistChoice, PlaylistMode } from "@/lib/playlists-import";
import { useRevelationSource } from "./source";

const MAX = 8;
// Couleurs des morceaux d'une playlist découpée (mêmes tons que les pochettes).
const PART_COLORS = ["#e85d3a", "#f2c94c", "#3a5be8", "#2bb673", "#c25bd6", "#8fb3a8"];

/**
 * Révélation, étape « Tes playlists » (planche `docs/design/idees-2.jpg`) : la personne coche ses playlists qui sont
 * de vrais bacs ; une playlist trop large est découpée par genre (ou gardée comme indice, ou laissée de côté).
 * Ses playlists ne bougent pas : Sortify en fait des bacs à lui.
 */
export function PlaylistsScreen({ candidates }: { candidates: PlaylistCandidate[] }) {
  const source = useRevelationSource();
  const [selected, setSelected] = useState<string[]>([]);
  const [step, setStep] = useState<number | null>(null); // index dans `broad` pendant le découpage
  const [modes, setModes] = useState<Map<string, PlaylistMode | "drop">>(new Map());
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const chosen = candidates.filter((c) => selected.includes(c.id));
  const broad = chosen.filter((c) => c.broad);

  function finish(final: Map<string, PlaylistMode | "drop">) {
    const choices: PlaylistChoice[] = chosen
      .map((c) => ({ id: c.id, name: c.name, mode: final.get(c.id) ?? (c.broad ? "split" : "bac") }))
      .filter((c): c is PlaylistChoice => c.mode !== "drop");
    setError(null);
    start(async () => {
      const r = await source.actions.savePlaylists(choices).catch((e: unknown) => ({ ok: false as const, message: e instanceof Error ? e.message : "Erreur" }));
      if (r.ok) source.advance();
      else setError(r.message);
    });
  }

  function decide(id: string, mode: PlaylistMode | "drop") {
    const next = new Map(modes).set(id, mode);
    setModes(next);
    if (step !== null && step + 1 < broad.length) setStep(step + 1);
    else finish(next);
  }

  if (step !== null && broad[step]) {
    const p = broad[step];
    const rest = p.liked - p.parts.reduce((n, x) => n + x.count, 0);
    return (
      <>
        <span className="label">
          « {p.name} » · {p.liked} titres likés
        </span>
        <h1 className="display" style={{ fontSize: 36 }}>
          {p.parts.length === 2 ? "Deux" : p.parts.length === 3 ? "Trois" : p.parts.length} directions
          <br />
          dans une playlist.
        </h1>
        <span className="small">Aucun genre n&apos;y fait la moitié des titres : un seul bac la rangerait mal. On te propose de la découper.</span>
        <div className="stack" style={{ gap: 10 }}>
          {p.parts.map((part, i) => (
            <span key={part.family} className="row" style={{ gap: 12 }}>
              <span className="part-swatch" style={{ background: PART_COLORS[i % PART_COLORS.length] }} aria-hidden="true" />
              <span className="grow">
                <b>{part.label}</b>
                <br />
                <span className="small muted">{part.count} titres</span>
              </span>
            </span>
          ))}
          {rest > 0 ? <span className="small muted">{rest} titres restants : l&apos;analyse leur cherchera une place.</span> : null}
        </div>
        <div className="grow" />
        {error ? (
          <p className="notice notice--error" role="alert">
            {error}
          </p>
        ) : null}
        <button type="button" className="btn" disabled={pending} onClick={() => decide(p.id, "split")}>
          En faire {p.parts.length} bacs
        </button>
        <button type="button" className="btn btn--ghost" disabled={pending} onClick={() => decide(p.id, "indice")}>
          La garder comme indice
        </button>
        <button type="button" className="btn btn--quiet" disabled={pending} onClick={() => decide(p.id, "drop")}>
          La laisser de côté
        </button>
      </>
    );
  }

  return (
    <>
      <span className="label">Avant l&apos;analyse · facultatif</span>
      <h1 className="display" style={{ fontSize: 40 }}>
        Tu ranges
        <br />
        déjà un peu ?
      </h1>
      <span className="small">Coche les playlists qui sont de vrais bacs pour toi. On en fait des bacs Sortify ; les tiennes ne bougent pas.</span>
      {candidates.length === 0 ? (
        <p className="muted" style={{ margin: 0 }}>
          Aucune de tes playlists ne contient assez de titres likés pour en faire un bac.
        </p>
      ) : (
        <ul className="recent">
          {candidates.map((c) => {
            const on = selected.includes(c.id);
            return (
              <li key={c.id} className="recent__item">
                <label className="row grow" style={{ gap: 10, minHeight: 44, cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    className="check"
                    checked={on}
                    disabled={!on && selected.length >= MAX}
                    onChange={() => setSelected((s) => (on ? s.filter((x) => x !== c.id) : [...s, c.id]))}
                  />
                  <span className="recent__cover">{c.image ? <Image src={c.image} alt="" fill sizes="44px" /> : null}</span>
                  <span className="grow" style={{ minWidth: 0 }}>
                    <span className="recent__title" style={{ display: "block" }}>
                      {c.name}
                    </span>
                    <span className="small muted">
                      {c.total} titres · {c.liked} likés{c.broad ? " · très large" : ""}
                    </span>
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      )}
      {selected.length >= MAX ? <span className="small muted">{MAX} playlists au plus.</span> : null}
      {error ? (
        <p className="notice notice--error" role="alert">
          {error}
        </p>
      ) : null}
      <div className="grow" />
      <div className="row" style={{ gap: 8 }}>
        <button type="button" className="btn btn--quiet" disabled={pending} onClick={() => finish(new Map())}>
          {selected.length === 0 ? "Passer" : "Annuler"}
        </button>
        <button
          type="button"
          className="btn grow"
          disabled={pending || selected.length === 0}
          onClick={() => (broad.length > 0 ? setStep(0) : finish(modes))}
        >
          {pending ? "C'est parti…" : selected.length === 0 ? "Reprendre" : `Reprendre ${selected.length} playlist${selected.length > 1 ? "s" : ""}`}
        </button>
      </div>
    </>
  );
}
