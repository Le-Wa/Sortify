"use client";

import { useState, useTransition } from "react";
import { saveSettings } from "./actions";

interface Props {
  sortPaused: boolean;
  suggestBacs: boolean;
  unlikeAction: "retirer" | "garder";
}

/** `cronHour` : heure de Paris du tri quotidien (fixe pour tout le monde sur le plan Vercel Hobby). */
export function SortSettings({ cronHour, ...initial }: Props & { cronHour: string }) {
  const [values, setValues] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();

  function change(patch: Partial<Props>) {
    const previous = values;
    setValues({ ...values, ...patch });
    setError(null);
    startSaving(async () => {
      const result = await saveSettings({
        sort_paused: patch.sortPaused,
        suggest_bacs: patch.suggestBacs,
        unlike_action: patch.unlikeAction,
      }).catch((e: unknown) => ({ ok: false as const, message: e instanceof Error ? e.message : "Erreur inconnue." }));
      if (!result.ok) {
        setValues(previous);
        setError(result.message);
      }
    });
  }

  return (
    <>
      <div className="list">
        <div className="list__row">
          <span>Tri chaque matin</span>
          <span className="mono muted">vers {cronHour}</span>
        </div>
        <Toggle label="Mettre en pause" checked={values.sortPaused} disabled={saving} onChange={(v) => change({ sortPaused: v })} />
        <Toggle
          label="Suggérer de nouveaux bacs"
          checked={values.suggestBacs}
          disabled={saving}
          onChange={(v) => change({ suggestBacs: v })}
        />
        <div className="list__row">
          <label htmlFor="unlike">Like retiré sur Spotify</label>
          <select
            id="unlike"
            className="select"
            style={{ fontFamily: "var(--font-display)" }}
            value={values.unlikeAction}
            disabled={saving}
            onChange={(e) => change({ unlikeAction: e.target.value as Props["unlikeAction"] })}
          >
            <option value="retirer">Retirer des playlists</option>
            <option value="garder">Garder</option>
          </select>
        </div>
      </div>
      {error ? (
        <p className="notice notice--error" role="alert">
          {error}
        </p>
      ) : null}
    </>
  );
}

function Toggle({ label, checked, disabled, onChange }: { label: string; checked: boolean; disabled: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="list__row">
      <span>{label}</span>
      <button
        type="button"
        role="switch"
        className="switch"
        aria-label={label}
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
      />
    </div>
  );
}
