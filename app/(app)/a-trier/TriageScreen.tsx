"use client";

import Image from "next/image";
import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { Sleeve } from "../../ui/Sleeve";
import type { BacChip, PendingItem } from "@/lib/daily";
import { BacPicker, MAX_PICK } from "../../ui/BacPicker";
import { BottomSheet } from "../../ui/BottomSheet";
import { usePreview } from "../../ui/usePreview";
import { acceptAll, decide, putAside } from "../actions";

const SWIPE = 90; // px
/** Coup sec : au-delà de cette vitesse (px/ms), le geste décide même sous le seuil (principes : docs/analyses/2026-10-13-animations.md). */
const FLICK = 0.5;
const EXIT_MS = 240;

const reducedMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** L'IA hésite vraiment : aucun bac à 50 %, ou deux bacs à moins de 10 points. */
export function isUncertain(item: PendingItem): boolean {
  const [a, b] = item.suggestions;
  return (a?.confidence ?? 0) < 0.5 || (b !== undefined && a.confidence - b.confidence < 0.1);
}

type Filter = "tous" | "incertains" | `bac:${string}`;

/** Ce qui a été rangé pendant la séance : nourrit la célébration du comptoir vide. */
interface Session {
  placed: number;
  divers: number;
  bacs: BacChip[];
}

export function TriageScreen({
  queue,
  bacs,
  nextTri,
  demo = false,
}: {
  queue: PendingItem[];
  bacs: BacChip[];
  nextTri: string;
  /** Planche vivante (/lab/a-trier) : rien n'est envoyé au serveur. */
  demo?: boolean;
}) {
  // Décisions optimistes : un titre décidé disparaît tout de suite, le serveur suit.
  const [decided, setDecided] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const [filter, setFilter] = useState<Filter>("tous");
  const [session, setSession] = useState<Session>({ placed: 0, divers: 0, bacs: [] });
  const remaining = queue.filter((q) => !decided.has(q.track_id));
  const matches = (q: PendingItem, f: Filter) =>
    f === "tous" ? true : f === "incertains" ? isUncertain(q) : q.suggestions[0]?.bac.id === f.slice(4);
  // Filtre épuisé : on revient à tous les titres plutôt que d'afficher un comptoir faussement vide.
  const active: Filter = remaining.some((q) => matches(q, filter)) ? filter : "tous";
  const shownQueue = remaining.filter((q) => matches(q, active));
  const item = shownQueue[0];
  const position = queue.length - remaining.length + 1;

  // Puces : « Incertains » et les bacs les plus proposés (2 titres au moins), seulement s'il y a de quoi filtrer.
  const uncertain = remaining.filter(isUncertain).length;
  const byBac = new Map<string, { bac: BacChip; n: number }>();
  for (const q of remaining) {
    const b = q.suggestions[0]?.bac;
    if (b) byBac.set(b.id, { bac: b, n: (byBac.get(b.id)?.n ?? 0) + 1 });
  }
  const bacChips = [...byBac.values()].filter((x) => x.n >= 2).sort((a, b) => b.n - a.n).slice(0, 4);
  const chips: { key: Filter; label: string }[] =
    remaining.length >= 4
      ? [
          { key: "tous", label: `Tous ${remaining.length}` },
          ...(uncertain > 0 && uncertain < remaining.length ? [{ key: "incertains" as Filter, label: `Incertains ${uncertain}` }] : []),
          ...bacChips.map((x) => ({ key: `bac:${x.bac.id}` as Filter, label: `${x.bac.name} ${x.n}` })),
        ]
      : [];

  function settle(trackId: string, bacIds: string[] | "aside", label: string) {
    setDecided((d) => new Set(d).add(trackId));
    if (bacIds !== "aside") {
      setSession((s) => ({
        placed: s.placed + (bacIds.length > 0 ? 1 : 0),
        divers: s.divers + (bacIds.length === 0 ? 1 : 0),
        bacs: [...s.bacs, ...bacs.filter((b) => bacIds.includes(b.id) && !s.bacs.some((x) => x.id === b.id))],
      }));
    }
    setError(null);
    setToast(label);
    if (demo) return;
    startTransition(async () => {
      const result = await (bacIds === "aside" ? putAside(trackId) : decide(trackId, bacIds)).catch((e: unknown) => ({ ok: false as const, message: e instanceof Error ? e.message : "Erreur" }));
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
    // Récompenser l'action, pas la visite : la célébration ne se joue que si on vient de vider le comptoir.
    if (decided.size > 0) return <CounterCleared session={session} total={decided.size} nextTri={nextTri} />;
    return (
      <>
        <h1 className="display">Tout est rangé.</h1>
        <p className="muted" style={{ margin: 0 }}>
          Plus rien sur le comptoir. Prochain arrivage : {nextTri}.
        </p>
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
        {shownQueue.length > 1 ? (
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={() => {
              // Seulement les titres du filtre affiché.
              const ids = shownQueue.map((q) => q.track_id);
              const before = decided;
              setDecided((d) => new Set([...d, ...ids]));
              setSession((s) => ({
                placed: s.placed + shownQueue.filter((q) => q.suggestions[0]).length,
                divers: s.divers + shownQueue.filter((q) => !q.suggestions[0]).length,
                bacs: [...s.bacs, ...shownQueue.map((q) => q.suggestions[0]?.bac).filter((b): b is BacChip => Boolean(b) && !s.bacs.some((x) => x.id === b!.id))].filter(
                  (b, i, all) => all.findIndex((x) => x.id === b.id) === i,
                ),
              }));
              if (demo) return;
              startTransition(async () => {
                const result = await acceptAll(active === "tous" ? undefined : ids).catch((e: unknown) => ({ ok: false as const, message: e instanceof Error ? e.message : "Erreur" }));
                if (!result.ok) {
                  setDecided(before);
                  setError(result.message);
                } else setToast(result.message ?? null);
              });
            }}
          >
            Tout accepter ({shownQueue.length})
          </button>
        ) : null}
      </header>

      {chips.length > 1 ? (
        <div className="filter-chips" role="tablist" aria-label="Filtrer les titres à trier">
          {chips.map((c) => (
            <button key={c.key} type="button" role="tab" aria-selected={active === c.key} className="filter-chip" onClick={() => setFilter(c.key)}>
              {c.label}
            </button>
          ))}
        </div>
      ) : null}

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
  onDecide: (trackId: string, bacIds: string[] | "aside", label: string) => void;
}) {
  const [selected, setSelected] = useState<string[]>(item.suggestions.slice(0, 1).map((s) => s.bac.id));
  const [why, setWhy] = useState(false);
  const [picking, setPicking] = useState(false);
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [exit, setExit] = useState<-1 | 1 | null>(null);
  const start = useRef<number | null>(null);
  // Derniers points du geste, pour sa vitesse au lâcher.
  const samples = useRef<{ x: number; t: number }[]>([]);
  const crossed = useRef(false);
  const preview = usePreview();

  const shown: BacChip[] = [
    ...item.suggestions.map((s) => s.bac),
    ...bacs.filter((b) => selected.includes(b.id) && !item.suggestions.some((s) => s.bac.id === b.id)),
  ];
  const confidence = new Map(item.suggestions.map((s) => [s.bac.id, s.confidence]));
  const names = (ids: string[]) => ids.map((id) => bacs.find((b) => b.id === id)?.name ?? "").join(", ");

  const toggle = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : s.length < MAX_PICK ? [...s, id] : s));
  // La carte part du côté choisi, puis la décision est prise (tout de suite si « animations réduites »).
  const leave = (dir: -1 | 1, decideNow: () => void) => {
    if (reducedMotion()) return decideNow();
    setExit(dir);
    window.setTimeout(decideNow, EXIT_MS - 40);
  };
  const store = () => selected.length > 0 && leave(1, () => onDecide(item.track_id, selected, `Rangé dans ${names(selected)}.`));
  const toDivers = () => leave(-1, () => onDecide(item.track_id, [], "Rangé dans Divers."));

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
          style={
            exit
              ? { transform: `translateX(${exit * 140}%) rotate(${exit * 16}deg)`, opacity: 0, transition: `transform ${EXIT_MS}ms cubic-bezier(0.2, 0.8, 0.2, 1), opacity ${EXIT_MS}ms ease-in` }
              : { transform: `translateX(${dx}px) rotate(${dx / 18}deg)`, transition: dragging ? "none" : "transform 0.32s cubic-bezier(0.2, 1.4, 0.4, 1)" }
          }
          onPointerDown={(e) => {
            if (exit) return;
            start.current = e.clientX;
            samples.current = [{ x: e.clientX, t: e.timeStamp }];
            crossed.current = false;
            setDragging(true);
            e.currentTarget.setPointerCapture(e.pointerId);
          }}
          onPointerMove={(e) => {
            if (start.current === null) return;
            const next = e.clientX - start.current;
            samples.current = [...samples.current.slice(-4), { x: e.clientX, t: e.timeStamp }];
            // Seuil franchi : petite vibration (Android ; l'iPhone ne la permet pas aux sites).
            const over = Math.abs(next) > SWIPE;
            if (over !== crossed.current) {
              crossed.current = over;
              if (over) navigator.vibrate?.(10);
            }
            setDx(next);
          }}
          onPointerUp={() => {
            const moved = dx;
            const first = samples.current[0];
            const last = samples.current.at(-1);
            const speed = first && last && last.t > first.t ? (last.x - first.x) / (last.t - first.t) : 0;
            start.current = null;
            setDragging(false);
            const right = moved > SWIPE || (speed > FLICK && moved > 30);
            const left = moved < -SWIPE || (speed < -FLICK && moved < -30);
            if (right && selected.length > 0) return store();
            if (left) return toDivers();
            setDx(0);
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
        <button type="button" className="link-btn small" style={{ alignSelf: "center", minHeight: 44 }} onClick={() => onDecide(item.track_id, "aside", "Mis de côté : il ne sera jamais rangé.")}>
          Ne jamais ranger ce titre
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

/**
 * Comptoir vidé pendant la séance : les pochettes des bacs servis tombent dans la caisse, l'une après l'autre,
 * puis le titre se pose. Moins d'une seconde, rien ne bloque ; « animations réduites » : simple apparition.
 */
function CounterCleared({ session, total, nextTri }: { session: Session; total: number; nextTri: string }) {
  const sleeves = session.bacs.slice(0, 5);
  return (
    <div className="cleared" role="status" aria-live="polite">
      <div className="grow" />
      {sleeves.length > 0 ? (
        <div className="cleared__crate" aria-hidden="true">
          {sleeves.map((b, i) => (
            <span
              key={b.id}
              className="cleared__sleeve"
              style={{ animationDelay: `${i * 70}ms`, ["--tilt" as string]: `${(i - (sleeves.length - 1) / 2) * 5}deg`, zIndex: i }}
            >
              <Sleeve name={b.sleeve} color={b.color} size={84} mark={b.mark} />
            </span>
          ))}
        </div>
      ) : null}
      <h1 className="display cleared__title" style={{ animationDelay: `${sleeves.length * 70 + 120}ms` }}>
        Comptoir
        <br />
        vide.
      </h1>
      <p className="cleared__text" style={{ animationDelay: `${sleeves.length * 70 + 220}ms` }}>
        {total} titre{total > 1 ? "s" : ""} traité{total > 1 ? "s" : ""}
        {session.placed > 0 ? ` · ${session.placed} rangé${session.placed > 1 ? "s" : ""}` : ""}
        {session.divers > 0 ? ` · ${session.divers} dans Divers` : ""}.
        <br />
        Prochain arrivage : {nextTri}.
      </p>
      <div className="grow" />
      <Link href="/accueil" className="btn btn--ghost">
        Retour à l&apos;accueil
      </Link>
    </div>
  );
}
