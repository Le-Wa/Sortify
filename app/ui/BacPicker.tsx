"use client";

import type { BacChip } from "@/lib/daily";
import { MAX_BACS_PER_TRACK } from "@/lib/limits";
import { Sleeve } from "./Sleeve";

export const MAX_PICK = MAX_BACS_PER_TRACK;

/** Choix de 0 à 5 bacs (aucun = Divers). */
export function BacPicker({
  bacs,
  selected,
  onToggle,
  hint,
}: {
  bacs: BacChip[];
  selected: string[];
  onToggle: (id: string) => void;
  hint?: (id: string) => string | undefined;
}) {
  const full = selected.length >= MAX_PICK;
  return (
    <div className="stack" style={{ gap: 6 }}>
      {bacs.map((b) => {
        const on = selected.includes(b.id);
        return (
          <button
            key={b.id}
            type="button"
            className={`pick ${on ? "is-on" : ""}`}
            aria-pressed={on}
            disabled={!on && full}
            onClick={() => onToggle(b.id)}
          >
            <span className="pick__check" aria-hidden="true">
              {on ? "✓" : ""}
            </span>
            <Sleeve name={b.sleeve} color={b.color} size={32} mark={b.mark} />
            <span className="pick__name">{b.name}</span>
            {hint?.(b.id) ? <span className="mono small">{hint(b.id)}</span> : null}
          </button>
        );
      })}
    </div>
  );
}
