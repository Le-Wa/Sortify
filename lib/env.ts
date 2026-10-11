import { timingSafeEqual } from "node:crypto";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Variable d'environnement manquante : ${name}`);
  return value;
}

export const env = {
  get spotifyClientId() {
    return required("SPOTIFY_CLIENT_ID");
  },
  get spotifyClientSecret() {
    return required("SPOTIFY_CLIENT_SECRET");
  },
  get nextAuthSecret() {
    return required("NEXTAUTH_SECRET");
  },
  get supabaseUrl() {
    return required("NEXT_PUBLIC_SUPABASE_URL");
  },
  get supabaseServiceKey() {
    return required("SUPABASE_SERVICE_ROLE_KEY");
  },
  /** URL publique de l'app, utilisée par les jobs pour se relancer eux-mêmes. */
  get appUrl() {
    return required("NEXTAUTH_URL").replace(/\/$/, "");
  },
  get cronSecret() {
    return required("CRON_SECRET");
  },
  get lastfmKey(): string | undefined {
    return process.env.LASTFM_API_KEY;
  },
};

/** En-tête « Authorization: Bearer <CRON_SECRET> » valide ? Comparaison en temps constant. */
export function hasCronSecret(authorization: string | null): boolean {
  const expected = Buffer.from(`Bearer ${env.cronSecret}`);
  const given = Buffer.from(authorization ?? "");
  return given.length === expected.length && timingSafeEqual(given, expected);
}
