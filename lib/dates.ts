/** Dates affichées à l'utilisateur, à l'heure de Paris (le tri quotidien tourne à 6 h UTC). */

const TZ = "Europe/Paris";
export const CRON_UTC_HOUR = 6;

const time = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: TZ });
const dayKey = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: TZ });
const short = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", timeZone: TZ });

export const hourOf = (d: Date) => time.format(d);

/** « aujourd'hui », « hier », « demain » ou « le 3 oct. ». */
export function relativeDay(d: Date, now = new Date()): string {
  const diff = Math.round((Date.parse(dayKey.format(d)) - Date.parse(dayKey.format(now))) / 86_400_000);
  if (diff === 0) return "aujourd'hui";
  if (diff === -1) return "hier";
  if (diff === 1) return "demain";
  return `le ${short.format(d)}`;
}

/** Prochain passage du tri quotidien. */
export function nextCron(now = new Date()): Date {
  const next = new Date(now);
  next.setUTCHours(CRON_UTC_HOUR, 0, 0, 0);
  if (next <= now) next.setUTCDate(next.getUTCDate() + 1);
  return next;
}
