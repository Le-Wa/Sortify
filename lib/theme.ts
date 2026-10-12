/** Thème de l'app, choisi dans les Réglages et gardé par appareil (cookie). */
export const THEMES = ["auto", "light", "dark"] as const;
export type Theme = (typeof THEMES)[number];
export const THEME_COOKIE = "sortify-theme";

export function themeOf(value: string | undefined): Theme {
  return (THEMES as readonly string[]).includes(value ?? "") ? (value as Theme) : "auto";
}
