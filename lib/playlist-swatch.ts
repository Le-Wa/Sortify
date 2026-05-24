export const SWATCH_COLORS = [
  "#c89840", "#8878d0", "#6a9070", "#c87a52",
  "#a06848", "#508860", "#7878b0", "#c08060",
];

export function playlistSwatch(id: string, color?: string | null): string {
  if (color) return color;
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) & 0xffff;
  return SWATCH_COLORS[h % SWATCH_COLORS.length];
}
