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
