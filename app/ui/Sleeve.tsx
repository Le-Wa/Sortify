import { inkFor } from "@/lib/bac-colors";
import type { SleeveMark } from "@/lib/cover-shapes";
import { SleeveMarkSvg } from "@/lib/sleeve-mark";
import { shapeBox, sleeveLayout } from "@/lib/sleeve-layout";

interface SleeveProps {
  name: string;
  color: string;
  size: number;
  /** Forme du bac ; sans forme, pochette nue (accueil marketing, suggestion). */
  mark?: SleeveMark;
  code?: string;
  rotate?: number;
  className?: string;
}

/**
 * Pochette Sortify : couleur du bac, forme du bac en haut à droite, nom en capitales condensées.
 * La taille du texte s'ajuste au mot le plus long (3 lignes max) ; la forme prend la place qui reste.
 */
export function Sleeve({ name, color, size, mark, code, rotate = 0, className = "" }: SleeveProps) {
  const { lines, fontSize, padding, small } = sleeveLayout(name, size);
  const ink = inkFor(color);

  return (
    <span
      className={`sleeve ${className}`}
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        padding,
        background: color,
        color: ink,
        transform: rotate ? `rotate(${rotate}deg)` : undefined,
      }}
    >
      {mark ? <SleeveMarkSvg mark={mark} ink={ink} {...shapeBox(name, size)} /> : null}
      <span className="row between sleeve__code" style={{ fontSize: small }}>
        <span>{code}</span>
      </span>
      <span className="sleeve__name" style={{ fontSize }}>
        {lines.map((line, i) => (
          <span key={i} style={{ display: "block" }}>
            {line}
          </span>
        ))}
      </span>
    </span>
  );
}
