/**
 * Formes des pochettes Sortify : chemins SVG dans une boîte 100 × 100.
 * Pures (pas de dépendance serveur) : servent à l'image envoyée à Spotify et à la pochette à l'écran.
 */

export interface ShapePart {
  d: string;
  /** Trait au lieu d'un remplissage (épaisseur en unités de la boîte). */
  stroke?: number;
}

type Pt = [number, number];

const r1 = (n: number) => Math.round(n * 10) / 10;
const poly = (pts: Pt[]): string => `M${pts.map(([x, y]) => `${r1(x)} ${r1(y)}`).join("L")}Z`;
const polar = (cx: number, cy: number, r: number, a: number): Pt => [cx + r * Math.cos(a), cy + r * Math.sin(a)];
const rad = (deg: number) => (deg * Math.PI) / 180;

function star(points: number, outer: number, inner: number, rotDeg = -90, cx = 50, cy = 50): string {
  const pts: Pt[] = [];
  for (let i = 0; i < points * 2; i++) pts.push(polar(cx, cy, i % 2 ? inner : outer, rad(rotDeg) + (i * Math.PI) / points));
  return poly(pts);
}

function circle(cx: number, cy: number, r: number): string {
  return `M${r1(cx - r)} ${cy}a${r} ${r} 0 1 0 ${r * 2} 0a${r} ${r} 0 1 0 ${-r * 2} 0Z`;
}

/** Contour polaire échantillonné : r(θ) autour de (cx, cy). */
function radial(fn: (a: number) => number, steps = 180, cx = 50, cy = 50): string {
  const pts: Pt[] = [];
  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    pts.push(polar(cx, cy, fn(a), a));
  }
  return poly(pts);
}

/** Croissant : le disque (cx, cy, r) privé du disque (cx2, cy2, r2). */
function crescent(cx: number, cy: number, r: number, cx2: number, cy2: number, r2: number): string {
  const pts: Pt[] = [];
  const inside2 = (p: Pt) => Math.hypot(p[0] - cx2, p[1] - cy2) < r2;
  const inside1 = (p: Pt) => Math.hypot(p[0] - cx, p[1] - cy) <= r;
  // Arc extérieur (hors du second disque), puis arc intérieur en sens inverse.
  const steps = 240;
  let start = 0;
  for (let i = 0; i < steps; i++) if (inside2(polar(cx, cy, r, (i / steps) * 2 * Math.PI)) && !inside2(polar(cx, cy, r, ((i + 1) / steps) * 2 * Math.PI))) start = i + 1;
  for (let i = 0; i < steps; i++) {
    const p = polar(cx, cy, r, ((start + i) / steps) * 2 * Math.PI);
    if (!inside2(p)) pts.push(p);
  }
  const inner: Pt[] = [];
  for (let i = 0; i < steps; i++) {
    const p = polar(cx2, cy2, r2, (i / steps) * 2 * Math.PI);
    if (inside1(p)) inner.push(p);
  }
  // L'arc intérieur doit repartir du bout de l'arc extérieur.
  const last = pts[pts.length - 1];
  // Tri angulaire autour du second centre, à partir de la direction du premier (pas de saut à ±π).
  const base = Math.atan2(cy - cy2, cx - cx2);
  const rel = (p: Pt) => {
    let a = Math.atan2(p[1] - cy2, p[0] - cx2) - base;
    while (a <= -Math.PI) a += 2 * Math.PI;
    while (a > Math.PI) a -= 2 * Math.PI;
    return a;
  };
  inner.sort((a, b) => rel(a) - rel(b));
  const d0 = Math.hypot(inner[0][0] - last[0], inner[0][1] - last[1]);
  const d1 = Math.hypot(inner[inner.length - 1][0] - last[0], inner[inner.length - 1][1] - last[1]);
  return poly([...pts, ...(d0 < d1 ? inner : inner.reverse())]);
}

// ── Glyphes ──────────────────────────────────────────────────────────────────

function chevrons(up: boolean): string {
  const parts: string[] = [];
  for (let i = 0; i < 3; i++) {
    const y = 18 + i * 26;
    const t = 14; // épaisseur
    const pts: Pt[] = up
      ? [[10, y + 24], [50, y - 6], [90, y + 24], [90, y + 24 + t], [50, y - 6 + t], [10, y + 24 + t]]
      : [[10, y - 6], [50, y + 24], [90, y - 6], [90, y - 6 + t], [50, y + 24 + t], [10, y - 6 + t]];
    parts.push(poly(pts));
  }
  return parts.join("");
}

function zigzag(): string {
  const parts: string[] = [];
  for (const y of [22, 50, 78]) {
    const pts: Pt[] = [];
    const t = 13;
    const xs = [0, 20, 40, 60, 80, 100];
    xs.forEach((x, i) => pts.push([x, y + (i % 2 ? -10 : 10) - t / 2]));
    [...xs].reverse().forEach((x, j) => pts.push([x, y + ((xs.length - 1 - j) % 2 ? -10 : 10) + t / 2]));
    parts.push(poly(pts));
  }
  return parts.join("");
}

function sun(): string {
  const parts = [circle(50, 50, 22)];
  for (let i = 0; i < 12; i++) {
    const a = (i * Math.PI) / 6;
    const w = rad(6);
    parts.push(poly([polar(50, 50, 30, a - w), polar(50, 50, 49, a - w * 0.6), polar(50, 50, 49, a + w * 0.6), polar(50, 50, 30, a + w)]));
  }
  return parts.join("");
}

function sparkle(): string {
  // Étoile à 4 branches aux flancs creusés.
  const pts: Pt[] = [];
  for (let i = 0; i < 4; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 2;
    pts.push(polar(50, 50, 50, a));
    for (let k = 1; k < 10; k++) {
      const t = k / 10;
      const r = 50 * Math.pow(Math.abs(Math.cos(t * Math.PI)), 3) + 7 * Math.sin(t * Math.PI);
      pts.push(polar(50, 50, Math.max(r, 7), a + (t * Math.PI) / 2));
    }
  }
  return poly(pts);
}

function asterisk(): string {
  const parts: string[] = [];
  for (let i = 0; i < 3; i++) {
    const a = (i * Math.PI) / 3 + Math.PI / 2;
    const w = 7;
    const [dx, dy] = [Math.cos(a), Math.sin(a)];
    const [nx, ny] = [-dy * w, dx * w];
    parts.push(poly([[50 + dx * 48 + nx, 50 + dy * 48 + ny], [50 - dx * 48 + nx, 50 - dy * 48 + ny], [50 - dx * 48 - nx, 50 - dy * 48 - ny], [50 + dx * 48 - nx, 50 + dy * 48 - ny]]));
  }
  return parts.join("");
}

const PATHS = {
  starburst: [{ d: star(8, 50, 20, -90) }],
  zigzag: [{ d: zigzag() }],
  crescent: [{ d: crescent(50, 50, 48, 68, 38, 40) }],
  triangle: [{ d: "M50 4L96 92H4Z" }],
  sun: [{ d: sun() }],
  arch: [{ d: "M18 100V52C18 30 30 12 50 2C70 12 82 30 82 52V100Z" }],
  bolt: [{ d: "M60 0L14 58H44L34 100L86 38H54L66 0Z" }],
  squiggle: [{ d: "M8 30C22 6 36 6 50 30S78 54 92 30M8 74C22 50 36 50 50 74S78 98 92 74", stroke: 12 }],
  flower: [{ d: radial((a) => 34 + 14 * Math.cos(6 * a)) }],
  horizon: [{ d: "M10 56A40 40 0 0 1 90 56Z" }, { d: "M0 66H100V76H0ZM14 86H86V96H14Z" }],
  leaf: [{ d: "M12 88C12 40 40 12 88 12C88 60 60 88 12 88Z" }],
  sparkle: [{ d: sparkle() }],
  chevrons: [{ d: chevrons(true) }],
  diamond: [{ d: "M50 2L90 50L50 98L10 50Z" }],
  drop: [{ d: "M50 2C62 22 84 44 84 64A34 34 0 0 1 16 64C16 44 38 22 50 2Z" }],
  waves: [{ d: "M4 24Q17 12 30 24T56 24T82 24T108 24M4 52Q17 40 30 52T56 52T82 52T108 52M4 80Q17 68 30 80T56 80T82 80T108 80", stroke: 9 }],
  cross: [{ d: "M36 4H64V36H96V64H64V96H36V64H4V36H36Z" }],
  stairs: [{ d: "M4 96V72H26V50H48V28H70V6H96V96Z" }],
  asterisk: [{ d: asterisk() }],
} satisfies Record<string, ShapePart[]>;

export type ShapeName = keyof typeof PATHS;

/** Formes que l'IA peut choisir pour un bac (l'astérisque est réservé à Divers), avec ce qu'elles évoquent. */
export const SHAPE_MEANINGS: Record<Exclude<ShapeName, "asterisk">, string> = {
  starburst: "étoile à 8 branches : fête, festival, projecteurs",
  zigzag: "zigzags : motif wax, rythmes africains",
  crescent: "croissant de lune : nuit, douceur nocturne",
  triangle: "triangle : pointu, direct, rap",
  sun: "soleil à rayons : solaire, journée, été",
  arch: "arc outrepassé : Maghreb, Orient",
  bolt: "éclair : rave, énergie brute",
  squiggle: "ondulations : swing, jazz, groove",
  flower: "fleur : joie, légèreté",
  horizon: "soleil sur l'horizon : fin de nuit, aube, retour",
  leaf: "feuille : tropiques, chaleur, nature",
  sparkle: "scintillement : pop, émotion",
  chevrons: "chevrons qui montent : montée, progression, techno",
  diamond: "losange : élégance, club chic",
  drop: "goutte : pluie, mélancolie",
  waves: "vagues : mer, planant, chill",
  cross: "croix : brut, rock, punk",
  stairs: "marches : béton, urbain, hip-hop",
};

export const FICHE_SHAPES = Object.keys(SHAPE_MEANINGS) as [Exclude<ShapeName, "asterisk">, ...Exclude<ShapeName, "asterisk">[]];

export function isShape(name: string | null | undefined): name is ShapeName {
  return Boolean(name && name in PATHS);
}

export function shapeParts(name: ShapeName): ShapePart[] {
  return PATHS[name];
}

/** La forme voulue si elle est libre, sinon la première forme libre (puis on recycle). */
export function uniqueShape(wanted: string | null | undefined, used: (string | null)[]): ShapeName {
  const taken = new Set(used);
  if (isShape(wanted) && wanted !== "asterisk" && !taken.has(wanted)) return wanted;
  return FICHE_SHAPES.find((s) => !taken.has(s)) ?? (isShape(wanted) ? wanted : FICHE_SHAPES[used.length % FICHE_SHAPES.length]);
}

/** Forme d'une pochette : pleine pour une scène, en contour pour une ambiance ou un moment. */
export interface SleeveMark {
  shape: ShapeName;
  outline: boolean;
}

export function markFor(bac: { name: string; shape?: string | null; axis: string; is_divers?: boolean }): SleeveMark {
  if (bac.is_divers) return { shape: "asterisk", outline: false };
  let shape: ShapeName;
  if (isShape(bac.shape)) shape = bac.shape;
  else {
    let h = 0;
    for (const c of bac.name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    shape = FICHE_SHAPES[h % FICHE_SHAPES.length];
  }
  return { shape, outline: bac.axis !== "scène" };
}
