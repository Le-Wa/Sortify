"use client";

import { useState, useTransition } from "react";
import type { DjPreview } from "@/lib/dj";
import { BottomSheet } from "../../../ui/BottomSheet";
import { previewDj, setPlayOrder } from "../actions";

/** Ordre de la playlist : récents en haut, ou ordre DJ. Toujours un aperçu chiffré avant de réécrire Spotify. */
export function PlayOrder({ bacId, order }: { bacId: string; order: "recents" | "dj" }) {
  const [current, setCurrent] = useState(order);
  const [asking, setAsking] = useState<"recents" | "dj" | null>(null);
  const [preview, setPreview] = useState<DjPreview | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  function ask(next: "recents" | "dj") {
    if (next === current) return;
    setMessage(null);
    setPreview(null);
    setAsking(next);
    if (next === "dj") {
      start(async () => {
        const result = await previewDj(bacId).catch((e: unknown) => ({ ok: false as const, message: e instanceof Error ? e.message : "Erreur" }));
        if (result.ok) setPreview(result.preview);
        else {
          setAsking(null);
          setMessage({ ok: false, text: result.message });
        }
      });
    }
  }

  function confirm() {
    const next = asking;
    if (!next) return;
    start(async () => {
      const result = await setPlayOrder(bacId, next).catch((e: unknown) => ({ ok: false as const, message: e instanceof Error ? e.message : "Erreur" }));
      setAsking(null);
      if (result.ok) {
        setCurrent(next);
        setMessage({ ok: true, text: result.message ?? "C'est fait." });
      } else setMessage({ ok: false, text: result.message });
    });
  }

  return (
    <div className="panel">
      <span className="label">Ordre de la playlist</span>
      <div className="segmented" role="radiogroup" aria-label="Ordre de la playlist">
        {(["recents", "dj"] as const).map((o) => (
          <button key={o} type="button" role="radio" aria-checked={current === o} className={`segmented__item ${current === o ? "is-on" : ""}`} onClick={() => ask(o)} disabled={pending}>
            {o === "recents" ? "Récents en haut" : "Ordre DJ"}
          </button>
        ))}
      </div>
      <span className="small muted">
        {current === "dj"
          ? "Les titres s'enchaînent par tempo, tonalité et énergie, en montée. Les nouveaux trouvent leur place à chaque tri."
          : "Les nouveaux titres arrivent en haut de la playlist."}
      </span>
      {message ? (
        <p className={message.ok ? "small" : "notice notice--error"} role={message.ok ? "status" : "alert"} style={{ margin: 0 }}>
          {message.text}
        </p>
      ) : null}

      <BottomSheet open={asking !== null} onClose={() => setAsking(null)} title={asking === "dj" ? "Ordre DJ" : "Récents en haut"}>
        {asking === "dj" && !preview ? (
          <p className="small muted" role="status" style={{ margin: 0 }}>
            On prépare l&apos;enchaînement…
          </p>
        ) : null}
        {asking === "dj" && preview ? (
          <>
            <p className="small" style={{ margin: 0 }}>
              Enchaînements au bon tempo : <b>{preview.before.tempo} %</b> → <b>{preview.after.tempo} %</b>
              <br />
              Tonalités qui s&apos;accordent : <b>{preview.before.key} %</b> → <b>{preview.after.key} %</b>
            </p>
            <p className="small muted" style={{ margin: 0 }}>
              Tempo connu pour {preview.withTempo} titres sur {preview.total} ; les autres sont placés d&apos;après leur énergie, ou à la fin.
            </p>
            <ol className="dj-list">
              {preview.first.map((t, i) => (
                <li key={i}>
                  <span className="grow" style={{ minWidth: 0 }}>
                    <span className="dj-list__title">{t.title}</span>
                    <span className="small muted">{t.artist}</span>
                  </span>
                  <span className="mono small">{t.bpm ?? "—"}</span>
                  <span className="mono small dj-list__key">{t.key ?? "—"}</span>
                </li>
              ))}
            </ol>
          </>
        ) : null}
        {asking === "recents" ? (
          <p className="small" style={{ margin: 0 }}>
            Les titres reprennent l&apos;ordre de tes likes, du plus récent au plus ancien.
          </p>
        ) : null}
        <button type="button" className="btn" disabled={pending || (asking === "dj" && !preview)} onClick={confirm}>
          {pending && (asking !== "dj" || preview) ? "On réécrit la playlist…" : "Réécrire la playlist dans Spotify"}
        </button>
        <button type="button" className="btn btn--quiet" disabled={pending} onClick={() => setAsking(null)}>
          Annuler
        </button>
      </BottomSheet>
    </div>
  );
}
