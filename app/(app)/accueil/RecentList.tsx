"use client";

import { useState, useTransition } from "react";
import type { BacChip, RecentItem } from "@/lib/daily";
import { BacPicker, MAX_PICK } from "../../ui/BacPicker";
import { BottomSheet } from "../../ui/BottomSheet";
import { PreviewCover } from "../../ui/PreviewCover";
import { correct } from "../actions";

export function RecentList({ items, bacs }: { items: RecentItem[]; bacs: BacChip[] }) {
  const [editing, setEditing] = useState<RecentItem | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();

  function open(item: RecentItem) {
    setEditing(item);
    setSelected(item.bacs.filter((b) => !b.is_divers).map((b) => b.id));
    setError(null);
  }

  return (
    <>
      <ul className="recent">
        {items.map((item) => (
          <li key={item.track_id} className="recent__item">
            <PreviewCover isrc={item.isrc} cover={item.cover_url} title={item.title} />
            <span className="grow stack" style={{ gap: 4 }}>
              <span className="recent__title">
                {item.title} <span className="muted">{item.artist}</span>
              </span>
              <span className="chips">
                {item.corrected ? <span className="chip chip--note">corrigé</span> : null}
                {item.bacs.map((b) => (
                  <span key={b.id} className={`chip ${b.is_divers ? "chip--divers" : ""}`} style={{ "--chip": b.color } as React.CSSProperties}>
                    {b.name}
                  </span>
                ))}
              </span>
            </span>
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => open(item)}>
              Corriger
            </button>
          </li>
        ))}
      </ul>

      <BottomSheet open={editing !== null} onClose={() => setEditing(null)} title="Ranger dans…">
        {editing ? (
          <>
            <p className="small muted" style={{ margin: 0 }}>
              <b>{editing.title}</b>
              {` · ${editing.artist}. Choisis jusqu'à ${MAX_PICK} bacs ; aucun = Divers. Ta correction sert d'exemple à l'IA.`}
            </p>
            <BacPicker
              bacs={bacs}
              selected={selected}
              onToggle={(id) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))}
            />
            {error ? (
              <p className="notice notice--error" role="alert">
                {error}
              </p>
            ) : null}
            <button
              type="button"
              className="btn"
              disabled={saving}
              onClick={() =>
                startSaving(async () => {
                  const result = await correct(editing.track_id, selected).catch((e: unknown) => ({
                    ok: false as const,
                    message: e instanceof Error ? e.message : "Erreur inconnue.",
                  }));
                  if (result.ok) setEditing(null);
                  else setError(result.message);
                })
              }
            >
              {saving ? "On range…" : selected.length === 0 ? "Mettre dans Divers" : `Ranger dans ${selected.length} bac${selected.length > 1 ? "s" : ""}`}
            </button>
          </>
        ) : null}
      </BottomSheet>
    </>
  );
}
