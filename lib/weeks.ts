/** Semaines de l'onglet Arrivages : du lundi au dimanche, à l'heure de Paris. */

const dayKey = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "Europe/Paris" });
const short = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", timeZone: "UTC" });

/** Lundi (date de Paris, « AAAA-MM-JJ ») de la semaine d'une date. */
export function weekKey(d: Date): string {
  const day = new Date(dayKey.format(d)); // minuit UTC du jour de Paris
  day.setUTCDate(day.getUTCDate() - ((day.getUTCDay() + 6) % 7));
  return day.toISOString().slice(0, 10);
}

/** « Semaine du 6 oct. » à partir d'une clé de semaine. */
export const weekLabel = (key: string) => `Semaine du ${short.format(new Date(key))}`;
