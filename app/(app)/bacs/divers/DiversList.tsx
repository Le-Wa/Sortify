"use client";

import Image from "next/image";
import { useMemo, useRef, useState, useTransition } from "react";
import type { BacChip } from "@/lib/daily";
import type { DiversItem } from "@/lib/divers";
import { BacPicker, MAX_PICK } from "../../../ui/BacPicker";
import { BottomSheet } from "../../../ui/BottomSheet";
import { usePreview } from "../../../ui/usePreview";
import { placeManyFromDivers } from "../actions";
import { putAside } from "../../actions";

type Mode = "titres" | "artistes" | "un";
const PAGE = 60;
const SWIPE = 90;
const FLICK = 0.5;
const EXIT_MS = 240;
const reducedMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Caisse Divers (planche `docs/design/idees-1.jpg`) : filtres par famille de genre, vue par artiste, rangement par lot,
 * et « Un par un » qui s'appuie sur l'avis gardé de l'IA quand il existe (sans nouvel appel à l'IA).
 */
export function DiversList({ items, bacs, labels }: { items: DiversItem[]; bacs: BacChip[]; labels: Record<string, string> }) {
  const [mode, setMode] = useState<Mode>("titres");
  const [filter, setFilter] = useState<string>("tout");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [done, setDone] = useState<Set<string>>(new Set());
  const [shown, setShown] = useState(PAGE);
  const [picking, setPicking] = useState<string[] | null>(null);
  const [chosen, setChosen] = useState<string[]>([]);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [saving, startSaving] = useTransition();
  const preview = usePreview();
  const bacName = (id: string) => bacs.find((b) => b.id === id)?.name ?? "";

  const left = items.filter((t) => !done.has(t.track_id));
  const counts = useMemo(() => {
    const c = new Map<string, number>();
    for (const t of left) {
      if (t.families.length === 0) c.set("sans", (c.get("sans") ?? 0) + 1);
      for (const f of t.families) c.set(f, (c.get(f) ?? 0) + 1);
    }
    return c;
  }, [left]);
  const chips = [
    { key: "tout", label: `Tout ${left.length}` },
    ...[...counts]
      .filter(([k]) => k !== "sans")
      .sort((a, b) => b[1] - a[1])
      .map(([k, n]) => ({ key: k, label: `${labels[k] ?? k} ${n}` })),
    ...(counts.get("sans") ? [{ key: "sans", label: `Sans genre ${counts.get("sans")}` }] : []),
  ];
  const active = filter === "tout" || counts.has(filter) ? filter : "tout";
  const visible = left.filter((t) => active === "tout" || (active === "sans" ? t.families.length === 0 : t.families.includes(active)));

  const groups = useMemo(() => {
    const m = new Map<string, DiversItem[]>();
    for (const t of visible) m.set(t.artist, [...(m.get(t.artist) ?? []), t]);
    return [...m].sort((a, b) => b[1].length - a[1].length);
  }, [visible]);

  const toggle = (id: string) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  function openPicker(ids: string[]) {
    const first = items.find((t) => t.track_id === ids[0]);
    setChosen(ids.length === 1 && first?.hint[0] ? [first.hint[0].bac_id] : []);
    setPicking(ids);
    setMessage(null);
  }

  function place(ids: string[], bacIds: string[]) {
    setDone((d) => new Set([...d, ...ids]));
    setSelected(new Set());
    setPicking(null);
    startSaving(async () => {
      const result = await placeManyFromDivers(ids, bacIds).catch((e: unknown) => ({ ok: false as const, message: e instanceof Error ? e.message : "Erreur" }));
      if (!result.ok) {
        setDone((d) => {
          const next = new Set(d);
          for (const id of ids) next.delete(id);
          return next;
        });
      }
      setMessage({ ok: result.ok, text: result.message ?? (result.ok ? "Rangé." : "Erreur") });
    });
  }

  function setAsideOne(id: string) {
    setDone((d) => new Set(d).add(id));
    setPicking(null);
    startSaving(async () => {
      const result = await putAside(id).catch((e: unknown) => ({ ok: false as const, message: e instanceof Error ? e.message : "Erreur" }));
      if (!result.ok) {
        setDone((d) => {
          const next = new Set(d);
          next.delete(id);
          return next;
        });
        setMessage({ ok: false, text: result.message });
      }
    });
  }

  const row = (t: DiversItem) => (
    <li key={t.track_id} className="recent__item">
      <input
        type="checkbox"
        className="check"
        checked={selected.has(t.track_id)}
        onChange={() => toggle(t.track_id)}
        aria-label={`Cocher ${t.title}`}
      />
      <button
        type="button"
        className={`recent__cover covers__item ${preview.playing === t.isrc ? "is-playing" : ""}`}
        aria-label={`Écouter un extrait : ${t.artist} — ${t.title}`}
        disabled={!t.isrc}
        onClick={() => void preview.toggle(t.isrc)}
      >
        {t.cover_url ? <Image src={t.cover_url} alt="" fill sizes="44px" /> : null}
      </button>
      <button type="button" className="grow divers-row__text" onClick={() => openPicker([t.track_id])}>
        <span className="recent__title" style={{ display: "block" }}>
          {t.title}
        </span>
        <span className="small muted">
          {t.artist}
          {t.hint[0] ? ` · l'IA pensait à ${bacName(t.hint[0].bac_id)}` : ""}
        </span>
      </button>
    </li>
  );

  return (
    <>
      <div className="filter-chips" role="tablist" aria-label="Filtrer Divers par genre">
        {chips.map((c) => (
          <button key={c.key} type="button" role="tab" aria-selected={active === c.key} className="filter-chip" onClick={() => setFilter(c.key)}>
            {c.label}
          </button>
        ))}
      </div>
      <div className="segmented segmented--3" role="radiogroup" aria-label="Affichage">
        {(
          [
            ["titres", "Titres"],
            ["artistes", "Artistes"],
            ["un", "Un par un"],
          ] as const
        ).map(([k, label]) => (
          <button key={k} type="button" role="radio" aria-checked={mode === k} className={`segmented__item ${mode === k ? "is-on" : ""}`} onClick={() => setMode(k)}>
            {label}
          </button>
        ))}
      </div>

      {message ? (
        <p className={message.ok ? "small" : "notice notice--error"} role={message.ok ? "status" : "alert"} style={{ margin: 0 }}>
          {message.text}
        </p>
      ) : null}

      {mode === "titres" ? (
        <>
          <ul className="recent">{visible.slice(0, shown).map(row)}</ul>
          {visible.length > shown ? (
            <button type="button" className="btn btn--ghost" onClick={() => setShown((n) => n + PAGE)}>
              Voir {Math.min(PAGE, visible.length - shown)} de plus
            </button>
          ) : null}
        </>
      ) : null}

      {mode === "artistes" ? (
        <div className="stack" style={{ gap: 14 }}>
          {groups.slice(0, shown).map(([artist, tracks]) => {
            const all = tracks.every((t) => selected.has(t.track_id));
            return (
              <section key={artist} className="stack" style={{ gap: 6 }}>
                <div className="row between" style={{ gap: 8 }}>
                  <b style={{ minWidth: 0 }}>
                    {artist || "Artiste inconnu"} · {tracks.length} titre{tracks.length > 1 ? "s" : ""}
                  </b>
                  <button type="button" className="btn btn--ghost btn--sm" onClick={() => openPicker(tracks.map((t) => t.track_id))}>
                    Ranger {tracks.length > 1 ? `les ${tracks.length}` : "le titre"}…
                  </button>
                </div>
                <ul className="recent">{tracks.slice(0, 3).map(row)}</ul>
                {tracks.length > 3 ? (
                  <button
                    type="button"
                    className="link-btn small"
                    style={{ alignSelf: "flex-start", minHeight: 44 }}
                    onClick={() =>
                      setSelected((s) => {
                        const next = new Set(s);
                        for (const t of tracks) {
                          if (all) next.delete(t.track_id);
                          else next.add(t.track_id);
                        }
                        return next;
                      })
                    }
                  >
                    {all ? "Tout décocher" : `Cocher les ${tracks.length} (dont ${tracks.length - 3} cachés)`}
                  </button>
                ) : null}
              </section>
            );
          })}
          {groups.length > shown ? (
            <button type="button" className="btn btn--ghost" onClick={() => setShown((n) => n + PAGE)}>
              Voir plus d&apos;artistes
            </button>
          ) : null}
        </div>
      ) : null}

      {mode === "un" ? (
        <OneByOne
          // Ceux dont l'IA avait un avis d'abord : ils se rangent en un geste.
          items={[...visible.filter((t) => t.hint.length > 0), ...visible.filter((t) => t.hint.length === 0)]}
          bacs={bacs}
          onPlace={(id, bacIds) => place([id], bacIds)}
          onSkip={(id) => setDone((d) => new Set(d).add(id))}
        />
      ) : null}

      {selected.size > 0 && mode !== "un" ? (
        <div className="lot-bar" role="region" aria-label="Sélection">
          <span className="small grow">
            <b>{selected.size} titre{selected.size > 1 ? "s" : ""}</b> coché{selected.size > 1 ? "s" : ""}
          </span>
          <button type="button" className="btn btn--quiet btn--sm" onClick={() => setSelected(new Set())}>
            Annuler
          </button>
          <button type="button" className="btn btn--sm" onClick={() => openPicker([...selected])}>
            Ranger dans…
          </button>
        </div>
      ) : null}

      <BottomSheet open={picking !== null} onClose={() => setPicking(null)} title="Ranger dans…">
        {picking ? (
          <>
            <p className="small muted" style={{ margin: 0 }}>
              {picking.length === 1
                ? `${items.find((t) => t.track_id === picking[0])?.title ?? ""} · jusqu'à ${MAX_PICK} bacs ; ton choix sert d'exemple à l'IA.`
                : `${picking.length} titres · jusqu'à ${MAX_PICK} bacs.`}
            </p>
            <BacPicker bacs={bacs} selected={chosen} onToggle={(id) => setChosen((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))} />
            <button type="button" className="btn" disabled={saving || chosen.length === 0} onClick={() => place(picking, chosen)}>
              Ranger {picking.length > 1 ? `les ${picking.length} titres` : ""} dans {chosen.length} bac{chosen.length > 1 ? "s" : ""}
            </button>
            {picking.length === 1 ? (
              <button type="button" className="btn btn--quiet" disabled={saving} onClick={() => setAsideOne(picking[0])}>
                Ne jamais ranger ce titre
              </button>
            ) : null}
          </>
        ) : null}
      </BottomSheet>
    </>
  );
}

/** Un titre à la fois : à droite, ranger ; à gauche, il reste dans Divers. Même geste qu'À trier. */
function OneByOne({
  items,
  bacs,
  onPlace,
  onSkip,
}: {
  items: DiversItem[];
  bacs: BacChip[];
  onPlace: (id: string, bacIds: string[]) => void;
  onSkip: (id: string) => void;
}) {
  const item = items[0];
  if (!item) {
    return (
      <p className="muted" style={{ margin: 0, textAlign: "center" }}>
        Plus rien ici avec ce filtre.
      </p>
    );
  }
  return <Card key={item.track_id} item={item} bacs={bacs} remaining={items.length} onPlace={onPlace} onSkip={onSkip} />;
}

function Card({
  item,
  bacs,
  remaining,
  onPlace,
  onSkip,
}: {
  item: DiversItem;
  bacs: BacChip[];
  remaining: number;
  onPlace: (id: string, bacIds: string[]) => void;
  onSkip: (id: string) => void;
}) {
  const [selected, setSelected] = useState<string[]>(item.hint.slice(0, 1).map((h) => h.bac_id));
  const [picking, setPicking] = useState(false);
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [exit, setExit] = useState<-1 | 1 | null>(null);
  const start = useRef<number | null>(null);
  const samples = useRef<{ x: number; t: number }[]>([]);
  const preview = usePreview();
  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : s.length < MAX_PICK ? [...s, id] : s));
  const leave = (dir: -1 | 1, then: () => void) => {
    if (reducedMotion()) return then();
    setExit(dir);
    window.setTimeout(then, EXIT_MS - 40);
  };
  const store = () => selected.length > 0 && leave(1, () => onPlace(item.track_id, selected));
  const skip = () => leave(-1, () => onSkip(item.track_id));
  const hinted = item.hint.map((h) => ({ bac: bacs.find((b) => b.id === h.bac_id), confidence: h.confidence })).filter((h) => h.bac);
  const shown = [...hinted.map((h) => h.bac!), ...bacs.filter((b) => selected.includes(b.id) && !hinted.some((h) => h.bac!.id === b.id))];

  return (
    <>
      <span className="mono small muted">{remaining} titre{remaining > 1 ? "s" : ""} avec ce filtre</span>
      <div className="deck">
        <span className="deck__hint deck__hint--left" style={{ opacity: dx < -20 ? 1 : 0.35 }}>
          ← Reste
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
            setDragging(true);
            e.currentTarget.setPointerCapture(e.pointerId);
          }}
          onPointerMove={(e) => {
            if (start.current === null) return;
            samples.current = [...samples.current.slice(-4), { x: e.clientX, t: e.timeStamp }];
            setDx(e.clientX - start.current);
          }}
          onPointerUp={() => {
            const moved = dx;
            const first = samples.current[0];
            const last = samples.current.at(-1);
            const speed = first && last && last.t > first.t ? (last.x - first.x) / (last.t - first.t) : 0;
            start.current = null;
            setDragging(false);
            if ((moved > SWIPE || (speed > FLICK && moved > 30)) && selected.length > 0) return store();
            if (moved < -SWIPE || (speed < -FLICK && moved < -30)) return skip();
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
      <div className="stack" style={{ gap: 6 }}>
        <span className="label" style={{ padding: "0 4px" }}>
          {hinted.length > 0 ? "À l'import, l'IA hésitait :" : "Choisis son bac"}
        </span>
        {item.reason && hinted.length > 0 ? (
          <p className="small muted" style={{ margin: "0 4px" }}>
            {item.reason}
          </p>
        ) : null}
        {shown.map((b) => {
          const on = selected.includes(b.id);
          const c = hinted.find((h) => h.bac!.id === b.id)?.confidence;
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
          + {shown.length > 0 ? "Autre bac" : "Choisir"}…
        </button>
      </div>
      <div className="stack" style={{ gap: 2 }}>
        <button type="button" className="btn" disabled={selected.length === 0} onClick={store}>
          Ranger dans {selected.length} bac{selected.length > 1 ? "s" : ""}
        </button>
        <button type="button" className="btn btn--quiet" onClick={skip}>
          Laisser dans Divers
        </button>
      </div>
      <BottomSheet open={picking} onClose={() => setPicking(false)} title="Choisir les bacs">
        <BacPicker bacs={bacs} selected={selected} onToggle={toggle} />
        <button type="button" className="btn" onClick={() => setPicking(false)}>
          OK
        </button>
      </BottomSheet>
    </>
  );
}
