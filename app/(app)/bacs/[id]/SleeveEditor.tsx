"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { BAC_COLORS, inkFor } from "@/lib/bac-colors";
import { FICHE_SHAPES, SHAPE_MEANINGS, type ShapeName, type SleeveMark } from "@/lib/cover-shapes";
import { SleeveMarkSvg } from "@/lib/sleeve-mark";
import { BottomSheet } from "../../../ui/BottomSheet";
import { Sleeve } from "../../../ui/Sleeve";
import { restyle } from "../actions";

const COLOR_NAMES = ["orange", "rose", "cobalt", "lilas", "jaune", "turquoise", "vert", "noir", "gris"];

interface Props {
  bac: { id: string; name: string; sleeve: string; color: string; mark: SleeveMark };
}

/** Pochette du bac : la toucher ouvre le choix de la forme et de la couleur. */
export function SleeveEditor({ bac }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [shape, setShape] = useState<ShapeName>(bac.mark.shape);
  const [color, setColor] = useState(bac.color);
  const [outline, setOutline] = useState(bac.mark.outline);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const ink = inkFor(color);
  const changed = shape !== bac.mark.shape || color !== bac.color || outline !== bac.mark.outline;

  function close() {
    setOpen(false);
    setShape(bac.mark.shape);
    setColor(bac.color);
    setOutline(bac.mark.outline);
    setError(null);
  }

  function save() {
    setError(null);
    startTransition(async () => {
      const result = await restyle(bac.id, shape, color, outline).catch((e: unknown) => ({ ok: false as const, message: e instanceof Error ? e.message : "Erreur" }));
      if (result.ok) {
        setOpen(false);
        router.refresh();
      } else setError(result.message);
    });
  }

  return (
    <>
      <button type="button" className="sleeve-edit" aria-label={`Personnaliser la pochette de ${bac.name}`} onClick={() => setOpen(true)}>
        <Sleeve name={bac.sleeve} color={bac.color} size={128} mark={bac.mark} />
        <span className="sleeve-edit__hint" aria-hidden="true">
          ✎
        </span>
      </button>

      <BottomSheet open={open} onClose={close} title="Ta pochette">
        <div className="row" style={{ justifyContent: "center" }}>
          <Sleeve name={bac.sleeve} color={color} size={150} mark={{ shape, outline }} />
        </div>

        <span className="label">Forme</span>
        <div className="shape-grid" role="radiogroup" aria-label="Forme">
          {FICHE_SHAPES.map((s) => (
            <button
              key={s}
              type="button"
              role="radio"
              aria-checked={s === shape}
              aria-label={SHAPE_MEANINGS[s]}
              className={`shape-grid__item ${s === shape ? "is-on" : ""}`}
              style={{ background: color }}
              onClick={() => setShape(s)}
            >
              <SleeveMarkSvg mark={{ shape: s, outline }} ink={ink} box={28} left={8} top={8} />
            </button>
          ))}
        </div>

        <div className="segmented" role="radiogroup" aria-label="Remplissage">
          {[
            { value: false, label: "Pleine" },
            { value: true, label: "Contour" },
          ].map((o) => (
            <button key={o.label} type="button" role="radio" aria-checked={outline === o.value} className={`segmented__item ${outline === o.value ? "is-on" : ""}`} onClick={() => setOutline(o.value)}>
              {o.label}
            </button>
          ))}
        </div>

        <span className="label">Couleur</span>
        <div className="swatches" role="radiogroup" aria-label="Couleur">
          {BAC_COLORS.map((c, i) => (
            <button
              key={c.bg}
              type="button"
              role="radio"
              aria-checked={c.bg === color}
              aria-label={COLOR_NAMES[i] ?? c.bg}
              className={`swatches__item ${c.bg === color ? "is-on" : ""}`}
              style={{ background: c.bg }}
              onClick={() => setColor(c.bg)}
            />
          ))}
        </div>

        {error ? (
          <p className="notice notice--error" role="alert">
            {error}
          </p>
        ) : null}
        <button type="button" className="btn" disabled={!changed || pending} onClick={save}>
          {pending ? "Envoi à Spotify…" : "Enregistrer"}
        </button>
      </BottomSheet>
    </>
  );
}
