"use client";

import { useState, useTransition } from "react";
import { PreviewCover } from "../../ui/PreviewCover";
import { toReco } from "./actions";

export interface RecoTrack {
  track_id: string;
  title: string;
  artist: string;
  cover_url: string | null;
  isrc: string | null;
  /** Déjà dans ma bibliothèque. */
  mine?: boolean;
}

/** Titres d'un pote, extrait au toucher de la pochette ; ceux que je n'ai pas peuvent partir dans « Reco des potes ». */
export function RecoList({ tracks, limit }: { tracks: RecoTrack[]; limit?: number }) {
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  // Les 20 plus récents au plus : une reco se digère, une avalanche non.
  const all = tracks.filter((t) => !t.mine);
  const fresh = all.slice(0, 20);
  const shown = limit ? tracks.slice(0, limit) : tracks;
  const button =
    fresh.length > 0 ? (
      <button
        type="button"
        className="btn btn--sm"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await toReco(fresh.map((t) => t.track_id)).catch((e: unknown) => ({ ok: false as const, message: e instanceof Error ? e.message : "Erreur" }));
            setMessage({ ok: r.ok, text: r.message ?? "" });
          })
        }
      >
        {pending
          ? "On les ajoute…"
          : all.length > fresh.length
            ? `Mettre les ${fresh.length} plus récents que tu n'as pas dans « Reco des potes »`
            : `Mettre ${fresh.length > 1 ? `les ${fresh.length} titres` : "le titre"} que tu n'as pas dans « Reco des potes »`}
      </button>
    ) : null;
  return (
    <>
      {button}
      {message?.text ? (
        <p className={message.ok ? "small" : "notice notice--error"} role={message.ok ? "status" : "alert"} style={{ margin: 0 }}>
          {message.text}
        </p>
      ) : null}
      <ul className="recent">
        {shown.map((t) => (
          <li key={t.track_id} className="recent__item">
            <PreviewCover isrc={t.isrc} cover={t.cover_url} title={t.title} />
            <span className="grow" style={{ minWidth: 0 }}>
              <span className="recent__title" style={{ display: "block" }}>
                {t.title}
              </span>
              <span className="small muted">
                {t.artist}
                {t.mine ? " · déjà chez toi" : ""}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </>
  );
}
