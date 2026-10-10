import { inkFor } from "@/lib/bac-colors";

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
  const words = name.split(/\s+/).filter(Boolean);
  const lines = splitLines(words);
  const widest = Math.max(...lines.map(lineWidthEm), 1);
  const padding = Math.round(size * 0.08);
  const fontSize = Math.min(size * 0.34, (size - padding * 2) / widest, (size * 0.62) / (lines.length * 0.84));
  const small = Math.max(7, Math.round(size * 0.055));

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

/** Largeur d'une ligne en em, mesurée sur Archivo 900 condensé 62 % en capitales. */
function lineWidthEm(line: string): number {
  let em = 0;
  for (const char of line.toUpperCase()) {
    if (char === " ") em += 0.25;
    else if ("MW".includes(char)) em += 0.72;
    else if ("IJL'’.,:;!|".includes(char)) em += 0.35;
    else em += 0.52;
  }
  return em;
}

/** Répartit les mots sur 3 lignes au plus, en équilibrant leur longueur. */
function splitLines(words: string[]): string[] {
  if (words.length <= 3) return words.length ? words : [""];
  const total = words.join(" ").length;
  const target = total / 3;
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (current && next.length > target && lines.length < 2) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  lines.push(current);
  return lines;
}

export function catalogCode(position: number): string {
  return `SRT·${String(position + 1).padStart(2, "0")}`;
}
