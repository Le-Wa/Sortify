/** Dates affichées à l'utilisateur, à l'heure de Paris (le tri automatique tourne le lundi à 6 h UTC). */

const TZ = "Europe/Paris";
export const CRON_UTC_HOUR = 6;
/** Jour du tri automatique (0 = dimanche, 1 = lundi), comme le cron de vercel.json. */
export const CRON_WEEKDAY = 1;

const time = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: TZ });
const dayKey = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: TZ });
const short = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", timeZone: TZ });
const weekday = new Intl.DateTimeFormat("fr-FR", { weekday: "long", timeZone: TZ });

export const hourOf = (d: Date) => time.format(d);

/** « aujourd'hui », « hier », « demain », « lundi » (dans la semaine qui vient) ou « le 3 oct. ». */
export function relativeDay(d: Date, now = new Date()): string {
  const diff = Math.round((Date.parse(dayKey.format(d)) - Date.parse(dayKey.format(now))) / 86_400_000);
  if (diff === 0) return "aujourd'hui";
  if (diff === -1) return "hier";
  if (diff === 1) return "demain";
  if (diff > 1 && diff < 7) return weekday.format(d);
  return `le ${short.format(d)}`;
}

/** Prochain passage du tri automatique (chaque lundi). */
export function nextCron(now = new Date()): Date {
  const next = new Date(now);
  next.setUTCHours(CRON_UTC_HOUR, 0, 0, 0);
  next.setUTCDate(next.getUTCDate() + ((CRON_WEEKDAY - next.getUTCDay() + 7) % 7));
  if (next <= now) next.setUTCDate(next.getUTCDate() + 7);
  return next;
}

/** Début de la semaine rangée par le dernier tri du lundi (7 jours avant lui) : « cette semaine » chez les potes. */
export function lastTriWeekStart(now = new Date()): Date {
  const last = nextCron(now);
  last.setUTCDate(last.getUTCDate() - 14);
  return last;
}
