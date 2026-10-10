"use client";

import Image from "next/image";
import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import type { BacChip, PendingItem } from "@/lib/daily";
import { BacPicker, MAX_PICK } from "../../ui/BacPicker";
import { BottomSheet } from "../../ui/BottomSheet";
import { usePreview } from "../../ui/usePreview";
import { acceptAll, decide } from "../actions";

const SWIPE = 90; // px

export function TriageScreen({ queue, bacs }: { queue: PendingItem[]; bacs: BacChip[] }) {
  // Décisions optimistes : un titre décidé disparaît tout de suite, le serveur suit.
  const [decided, setDecided] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const remaining = queue.filter((q) => !decided.has(q.track_id));
  const item = remaining[0];
  const position = queue.length - remaining.length + 1;

  function settle(trackId: string, bacIds: string[], label: string) {
    setDecided((d) => new Set(d).add(trackId));
    setError(null);
    setToast(label);
    startTransition(async () => {
      const result = await decide(trackId, bacIds).catch((e: unknown) => ({ ok: false as const, message: e instanceof Error ? e.message : "Erreur" }));
      if (!result.ok) {
        setError(result.message);
        setDecided((d) => {
          const next = new Set(d);
          next.delete(trackId);
          return next;
        });
      }
    });
  }

  if (!item) {
    return (
      <>
        <h1 className="display">Tout est rangé.</h1>
        <p className="muted" style={{ margin: 0 }}>
          Plus rien sur le comptoir. Sortify range tes prochains likes chaque matin.
        </p>
        {toast ? <p className="small muted">{toast}</p> : null}
        <Link href="/accueil" className="btn btn--ghost">
          Retour à l&apos;accueil
        </Link>
      </>
    );
  }

  return (
    <>
      <header className="row between">
        <span className="row" style={{ alignItems: "baseline", gap: 10 }}>
          <h1 className="display display--s" style={{ fontSize: 24 }}>
            À trier
          </h1>
          <span className="mono small">
            {position} / {queue.length}
          </span>
        </span>
        {remaining.length > 1 ? (
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={() => {
              setDecided(new Set(queue.map((q) => q.track_id)));
              startTransition(async () => {
                const result = await acceptAll().catch((e: unknown) => ({ ok: false as const, message: e instanceof Error ? e.message : "Erreur" }));
                if (!result.ok) {
                  setDecided(new Set());
                  setError(result.message);
                } else setToast(result.message ?? null);
              });
            }}
          >
            Tout accepter ({remaining.length})
          </button>
        ) : null}
      </header>

      <Card key={item.track_id} item={item} bacs={bacs} onDecide={settle} />

      {error ? (
        <p className="notice notice--error" role="alert">
          {error}
        </p>
      ) : null}
      {toast ? (
        <p className="small muted" role="status" style={{ margin: 0, textAlign: "center" }}>
          {toast}
        </p>
      ) : null}
    </>
  );
}

function Card({
  item,
  bacs,
  onDecide,
}: {
  item: PendingItem;
  bacs: BacChip[];
  onDecide: (trackId: string, bacIds: string[], label: string) => void;
}) {
  const [selected, setSelected] = useState<string[]>(item.suggestions.slice(0, 1).map((s) => s.bac.id));
  const [why, setWhy] = useState(false);
  const [picking, setPicking] = useState(false);
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const start = useRef<number | null>(null);
  const preview = usePreview();

  const shown: BacChip[] = [
    ...item.suggestions.map((s) => s.bac),
    ...bacs.filter((b) => selected.includes(b.id) && !item.suggestions.some((s) => s.bac.id === b.id)),
  ];
  const confidence = new Map(item.suggestions.map((s) => [s.bac.id, s.confidence]));
  const names = (ids: string[]) => ids.map((id) => bacs.find((b) => b.id === id)?.name ?? "").join(", ");

  const toggle = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : s.length < MAX_PICK ? [...s, id] : s));
  const store = () => selected.length > 0 && onDecide(item.track_id, selected, `Rangé dans ${names(selected)}.`);
  const toDivers = () => onDecide(item.track_id, [], "Rangé dans Divers.");

  return (
    <>
      <div className="deck">
        <span className="deck__hint deck__hint--left" style={{ opacity: dx < -20 ? 1 : 0.35 }}>
          ← Divers
        </span>
        <span className="deck__hint deck__hint--right" style={{ opacity: dx > 20 ? 1 : 0.35 }}>
          Ranger →
        </span>
        <div
          className="deck__card"
          style={{ transform: `translateX(${dx}px) rotate(${dx / 18}deg)`, transition: dragging ? "none" : "transform 0.2s" }}
          onPointerDown={(e) => {
            start.current = e.clientX;
            setDragging(true);
            e.currentTarget.setPointerCapture(e.pointerId);
          }}
          onPointerMove={(e) => {
            if (start.current !== null) setDx(e.clientX - start.current);
          }}
          onPointerUp={() => {
            const moved = dx;
            start.current = null;
            setDragging(false);
            setDx(0);
            if (moved > SWIPE) store();
            else if (moved < -SWIPE) toDivers();
          }}
          onPointerCancel={() => {
            start.current = null;
            setDragging(false);
            setDx(0);
          }}
        >
          {item.cover_url ? <Image src={item.cover_url} alt="" fill sizes="260px" draggable={false} priority /> : null}
        </div>
      </div>

      <div className="row between" style={{ gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <div className="triage__title">{item.title}</div>
          <div className="muted" style={{ fontSize: 14 }}>
            {item.artist}
          </div>
        </div>
        <button
          type="button"
          className="play-btn"
          aria-label={preview.playing === item.isrc ? "Arrêter l'extrait" : "Écouter un extrait"}
          disabled={!item.isrc}
          onClick={() => void preview.toggle(item.isrc)}
        >
          {preview.playing === item.isrc ? "■" : "▶"}
        </button>
      </div>
      {preview.unavailable === item.isrc ? (
        <p className="small muted" style={{ margin: 0 }}>
          Pas d&apos;extrait pour ce titre.
        </p>
      ) : null}

      <div className="stack" style={{ gap: 6 }}>
        <div className="row between" style={{ padding: "0 4px" }}>
          <span className="label">Sortify hésite entre</span>
          {item.reason ? (
            <button type="button" className="link-btn" aria-expanded={why} onClick={() => setWhy((w) => !w)}>
              {why ? "Masquer" : "Pourquoi ?"}
            </button>
          ) : null}
        </div>
        {why && item.reason ? (
          <p className="small" style={{ margin: "0 4px" }}>
            {item.reason}
          </p>
        ) : null}
        <div className="stack" style={{ gap: 6 }}>
          {shown.map((b) => {
            const on = selected.includes(b.id);
            const c = confidence.get(b.id);
            return (
              <button key={b.id} type="button" className={`pick ${on ? "is-on" : ""}`} aria-pressed={on} onClick={() => toggle(b.id)} disabled={!on && selected.length >= MAX_PICK}>
                <span className="pick__check" aria-hidden="true">
                  {on ? "✓" : ""}
                </span>
                <span className="pick__name">{b.name}</span>
                {c !== undefined ? <span className="mono small">{Math.round(c * 100)} %</span> : null}
              </button>
            );
          })}
          <button type="button" className="link-btn" style={{ alignSelf: "flex-start", marginLeft: 4 }} onClick={() => setPicking(true)}>
            + Autre bac…
          </button>
        </div>
      </div>

      <div className="stack" style={{ gap: 2 }}>
        <button type="button" className="btn" disabled={selected.length === 0} onClick={store}>
          Ranger dans {selected.length} bac{selected.length > 1 ? "s" : ""}
        </button>
        <button type="button" className="btn btn--quiet" onClick={toDivers}>
          Je ne sais pas → Divers
        </button>
      </div>

      <BottomSheet open={picking} onClose={() => setPicking(false)} title="Choisir les bacs">
        <p className="small muted" style={{ margin: 0 }}>
          {`Jusqu'à ${MAX_PICK} bacs. Ton choix sert d'exemple à l'IA.`}
        </p>
        <BacPicker bacs={bacs} selected={selected} onToggle={toggle} />
        <button type="button" className="btn" onClick={() => setPicking(false)}>
          OK
        </button>
      </BottomSheet>
    </>
  );
}
