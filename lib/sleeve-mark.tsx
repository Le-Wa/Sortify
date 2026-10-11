import { shapeParts, type SleeveMark } from "./cover-shapes";

/** Forme d'une pochette (écran et image Spotify) : pleine, ou en contour pour une ambiance ou un moment. */
export function SleeveMarkSvg({ mark, ink, box, left, top }: { mark: SleeveMark; ink: string; box: number; left: number; top: number }) {
  // Contour d'au moins ~1,2 px à l'écran, quelle que soit la taille de la pochette.
  const outlineWidth = Math.max(4, (1.2 * 100) / box);
  return (
    <svg width={box} height={box} viewBox="0 0 100 100" aria-hidden="true" style={{ position: "absolute", left, top }}>
      {shapeParts(mark.shape).map((p, i) =>
        p.stroke ? (
          <path key={i} d={p.d} fill="none" stroke={ink} strokeWidth={mark.outline ? Math.max(p.stroke / 2.5, outlineWidth) : p.stroke} strokeLinecap="round" />
        ) : mark.outline ? (
          <path key={i} d={p.d} fill="none" stroke={ink} strokeWidth={outlineWidth} strokeLinejoin="round" />
        ) : (
          <path key={i} d={p.d} fill={ink} />
        ),
      )}
    </svg>
  );
}
