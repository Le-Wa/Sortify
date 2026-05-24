export const SWATCH_COLORS = [
  "#c8935a", // Ambre
  "#c4a440", // Moutarde
  "#b85c48", // Brique
  "#c4758a", // Rose poudré
  "#7f77dd", // Lavande
  "#4e8fa8", // Ardoise
  "#7a9e5a", // Olive
  "#3d7a70", // Pétrole
];

export function playlistSwatch(id: string, color?: string | null): string {
  if (color) return color;
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) & 0xffff;
  return SWATCH_COLORS[h % SWATCH_COLORS.length];
}
