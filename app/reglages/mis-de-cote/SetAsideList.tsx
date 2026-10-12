"use client";

import { useState, useTransition } from "react";
import type { TrackInfo } from "@/lib/daily";
import { putBack } from "../../(app)/actions";
import { PreviewCover } from "../../ui/PreviewCover";

export function SetAsideList({ tracks }: { tracks: TrackInfo[] }) {
  const [back, setBack] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <>
      {error ? (
        <p className="notice notice--error" role="alert">
          {error}
        </p>
      ) : null}
      <ul className="recent">
        {tracks
          .filter((t) => !back.has(t.track_id))
          .map((t) => (
            <li key={t.track_id} className="recent__item">
              <PreviewCover isrc={t.isrc} cover={t.cover_url} title={t.title} />
              <span className="grow recent__title">
                {t.title} <span className="muted">{t.artist}</span>
              </span>
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    setError(null);
                    const result = await putBack(t.track_id).catch((e: unknown) => ({ ok: false as const, message: e instanceof Error ? e.message : "Erreur" }));
                    if (result.ok) setBack((b) => new Set(b).add(t.track_id));
                    else setError(result.message);
                  })
                }
              >
                Remettre
              </button>
            </li>
          ))}
      </ul>
    </>
  );
}
