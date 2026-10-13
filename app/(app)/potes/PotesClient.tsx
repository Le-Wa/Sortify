"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import type { PoteView } from "@/lib/potes";
import { Sleeve } from "../../ui/Sleeve";
import { offerCommon, replyCommon, setShareBacs, type ActionResult } from "./actions";

function useAct() {
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [, start] = useTransition();
  const act = (key: string, action: () => Promise<ActionResult>) => {
    setBusy(key);
    setMessage(null);
    start(async () => {
      const r = await action().catch((e: unknown) => ({ ok: false as const, message: e instanceof Error ? e.message : "Erreur" }));
      setBusy(null);
      if (r.message) setMessage({ ok: r.ok, text: r.message });
    });
  };
  return { busy, message, act };
}

/** Accord, directement sur la page Potes. */
export function ShareSwitch({ on }: { on: boolean }) {
  const { busy, message, act } = useAct();
  return (
    <div className="list">
      <div className="list__row">
        <span className="grow">Montrer mes bacs à mes potes</span>
        <button
          type="button"
          role="switch"
          className="switch"
          aria-label="Montrer mes bacs à mes potes"
          aria-checked={on}
          disabled={busy !== null}
          onClick={() => act("share", () => setShareBacs(!on))}
        />
      </div>
      {message && !message.ok ? (
        <p className="notice notice--error" role="alert">
          {message.text}
        </p>
      ) : null}
    </div>
  );
}

/** A. Vitrine d'un pote, et C. notre bac commun. */
export function PoteCard({ pote }: { pote: PoteView }) {
  const { busy, message, act } = useAct();
  const c = pote.common;
  return (
    <section className="card stack" style={{ gap: 12, padding: 14 }}>
      <span className="row between">
        <b style={{ fontSize: 18 }}>{pote.name}</b>
        <span className="display" style={{ fontSize: 34 }} aria-label={`${pote.score} % d'affinité`}>
          {pote.score} %
        </span>
      </span>
      <span className="small">
        {pote.meeting ? (
          <>
            Vous vous retrouvez surtout sur <b>{pote.meeting.toLowerCase()}</b>
          </>
        ) : (
          "Vous ne vous croisez pas encore beaucoup"
        )}
        {pote.sharedTracks > 0 ? ` : ${pote.sharedTracks} titre${pote.sharedTracks > 1 ? "s" : ""} en commun` : ""}
        {pote.sharedArtistCount > 0 ? `, ${pote.sharedArtistCount} artiste${pote.sharedArtistCount > 1 ? "s" : ""} (${pote.sharedArtists.join(", ")}…)` : ""}.
      </span>
      {pote.bacs.length > 0 ? (
        <div className="pote-bacs">
          {pote.bacs.map((b) => (
            <Link key={b.id} href={`/potes/bac/${b.id}`} className="pote-bacs__item" aria-label={`${b.name}, ${b.count} titres`}>
              <Sleeve name={b.sleeve} color={b.color} size={84} mark={b.mark} />
              <span className="small muted nowrap">{b.count} titres</span>
            </Link>
          ))}
        </div>
      ) : (
        <span className="small muted">Aucun bac partagé pour l&apos;instant.</span>
      )}

      <div className="panel" style={{ gap: 8 }}>
        <span className="label">Bac commun</span>
        {!c ? (
          <>
            <span className="small">Une playlist à deux : vos titres et vos artistes en commun, mise à jour chaque lundi.</span>
            <button type="button" className="btn btn--sm" disabled={busy !== null} onClick={() => act("offer", () => offerCommon(pote.id))}>
              {busy === "offer" ? "…" : `Proposer à ${pote.name}`}
            </button>
          </>
        ) : c.status === "pending" && c.mine ? (
          <span className="small">Proposition envoyée : le bac sera créé dès que {pote.name} dit oui.</span>
        ) : c.status === "pending" ? (
          <>
            <span className="small">{pote.name} te propose un bac commun.</span>
            <span className="row" style={{ gap: 6 }}>
              <button type="button" className="btn btn--sm" disabled={busy !== null} onClick={() => act("yes", () => replyCommon(c.id, true))}>
                {busy === "yes" ? "On le crée…" : "Créer notre bac commun"}
              </button>
              <button type="button" className="btn btn--ghost btn--sm" disabled={busy !== null} onClick={() => act("no", () => replyCommon(c.id, false))}>
                Non merci
              </button>
            </span>
          </>
        ) : (
          <span className="row between">
            <span className="small">{c.tracks} titres · mis à jour chaque lundi</span>
            {c.playlistId ? (
              <a href={`https://open.spotify.com/playlist/${c.playlistId}`} target="_blank" rel="noreferrer" className="small" style={{ fontWeight: 700 }}>
                Ouvrir dans Spotify ↗
              </a>
            ) : null}
          </span>
        )}
      </div>
      {message ? (
        <p className={message.ok ? "small" : "notice notice--error"} role={message.ok ? "status" : "alert"} style={{ margin: 0 }}>
          {message.text}
        </p>
      ) : null}
    </section>
  );
}
