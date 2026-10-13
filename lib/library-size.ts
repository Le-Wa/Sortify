/**
 * Garde-fous selon la taille de la bibliothèque (analyse d'onboarding du 12/10/2026, P2-g et h).
 * Module pur (sans base ni IA) : testé dans `lib/__tests__/library-size.test.ts`.
 */

/** Sous ce nombre de titres, pas d'analyse : il n'y a pas de quoi remplir deux bacs. */
export const MIN_LIBRARY = 20;
/** Sous ce nombre, petite bibliothèque : 2 ou 3 bacs au plus, sans passe « compléter ». */
export const SMALL_LIBRARY = 60;
/**
 * Fenêtre d'import : les 1 000 likes les plus récents, quel que soit leur âge (décision de Walid, 13/10/2026,
 * `docs/analyses/2026-10-13-fenetre-import.md`) : ~3 $ d'IA et ~10 min d'attente pour tout le monde.
 */
export const MAX_IMPORT = 1000;

export type LibrarySize = "trop-petite" | "petite" | "normale";

export function librarySize(tracks: number): LibrarySize {
  if (tracks < MIN_LIBRARY) return "trop-petite";
  if (tracks < SMALL_LIBRARY) return "petite";
  return "normale";
}

/** Nombre maximum de bacs proposés à l'analyse (null : libre, dicté par la bibliothèque). */
export function maxBacs(tracks: number): number | null {
  return librarySize(tracks) === "petite" ? 3 : null;
}

/** Titres qu'un bac proposé doit pouvoir accueillir au minimum. */
export function minPerBac(tracks: number): number {
  return librarySize(tracks) === "petite" ? Math.max(8, Math.round(tracks * 0.15)) : Math.max(15, Math.round(tracks * 0.03));
}

export const tooSmallMessage = (tracks: number) =>
  `Ta bibliothèque compte ${tracks} titre${tracks > 1 ? "s" : ""} liké${tracks > 1 ? "s" : ""} : c'est trop peu pour en tirer des bacs (il en faut au moins ${MIN_LIBRARY}). Like quelques titres de plus dans Spotify, puis touche « Réessayer ».`;
