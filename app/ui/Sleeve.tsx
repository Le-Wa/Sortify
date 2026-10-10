import { inkFor } from "@/lib/bac-colors";
import { sleeveLayout } from "@/lib/sleeve-layout";

export { catalogCode } from "@/lib/sleeve-layout";

interface SleeveProps {
  name: string;
  color: string;
  size: number;
  code?: string;
  corner?: string;
  rotate?: number;
  className?: string;
}

/**
 * Pochette Sortify : couleur du bac, nom en capitales condensées, code catalogue.
 * La taille du texte s'ajuste au mot le plus long (3 lignes max).
 */
export function Sleeve({ name, color, size, code, corner, rotate = 0, className = "" }: SleeveProps) {
  const { lines, fontSize, padding, small } = sleeveLayout(name, size);

  return (
    <span
      className={`sleeve ${className}`}
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        padding,
        background: color,
        color: inkFor(color),
        transform: rotate ? `rotate(${rotate}deg)` : undefined,
      }}
    >
      <span className="row between sleeve__code" style={{ fontSize: small }}>
        <span>{code}</span>
        <span>{corner}</span>
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
