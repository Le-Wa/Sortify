"use client";

import Image from "next/image";
import { useState, useTransition } from "react";
import type { BacChip, TrackInfo } from "@/lib/daily";
import { BacPicker, MAX_PICK } from "../../../ui/BacPicker";
import { BottomSheet } from "../../../ui/BottomSheet";
import { usePreview } from "../../../ui/usePreview";
import { placeFromDivers } from "../actions";
import { putAside } from "../../actions";

export function DiversList({ tracks, bacs }: { tracks: TrackInfo[]; bacs: BacChip[] }) {
  const [placing, setPlacing] = useState<TrackInfo | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [done, setDone] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();
  const preview = usePreview();

  return (
    <>
      <ul className="recent">
        {tracks
          .filter((t) => !done.has(t.track_id))
          .map((t) => (
            <li key={t.track_id} className="recent__item">
              <button
                type="button"
                className={`recent__cover covers__item ${preview.playing === t.isrc ? "is-playing" : ""}`}
                aria-label={`Écouter un extrait : ${t.artist} — ${t.title}`}
                disabled={!t.isrc}
                onClick={() => void preview.toggle(t.isrc)}
              >
                {t.cover_url ? <Image src={t.cover_url} alt="" fill sizes="44px" /> : null}
              </button>
              <span className="grow" style={{ minWidth: 0 }}>
                <span className="recent__title" style={{ display: "block" }}>
                  {t.title}
                </span>
                <span className="small muted">{t.artist}</span>
              </span>
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                onClick={() => {
                  setPlacing(t);
                  setSelected([]);
                  setError(null);
                }}
              >
                Ranger…
              </button>
            </li>
          ))}
      </ul>

      <BottomSheet open={placing !== null} onClose={() => setPlacing(null)} title="Ranger dans…">
        {placing ? (
          <>
            <p className="small muted" style={{ margin: 0 }}>
              <b>{placing.title}</b>
              {` · ${placing.artist}. Jusqu'à ${MAX_PICK} bacs ; ton choix sert d'exemple à l'IA.`}
            </p>
            <BacPicker bacs={bacs} selected={selected} onToggle={(id) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))} />
            {error ? (
              <p className="notice notice--error" role="alert">
                {error}
              </p>
            ) : null}
            <button
              type="button"
              className="btn"
              disabled={saving || selected.length === 0}
              onClick={() =>
                startSaving(async () => {
                  const result = await placeFromDivers(placing.track_id, selected).catch((e: unknown) => ({
                    ok: false as const,
                    message: e instanceof Error ? e.message : "Erreur",
                  }));
                  if (!result.ok) return setError(result.message);
                  setDone((d) => new Set(d).add(placing.track_id));
                  setPlacing(null);
                })
              }
            >
              {saving ? "On range…" : `Ranger dans ${selected.length} bac${selected.length > 1 ? "s" : ""}`}
            </button>
            <button
              type="button"
              className="btn btn--quiet"
              disabled={saving}
              onClick={() =>
                startSaving(async () => {
                  const result = await putAside(placing.track_id).catch((e: unknown) => ({ ok: false as const, message: e instanceof Error ? e.message : "Erreur" }));
                  if (!result.ok) return setError(result.message);
                  setDone((d) => new Set(d).add(placing.track_id));
                  setPlacing(null);
                })
              }
            >
              Ne jamais ranger ce titre
            </button>
          </>
        ) : null}
      </BottomSheet>
    </>
  );
}
