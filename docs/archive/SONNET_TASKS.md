# Spec — Optimisations Sortify

## Contexte projet
- Next.js 16 (App Router, **`proxy.ts`** = ex-middleware), TypeScript strict, Supabase, NextAuth Spotify, Anthropic SDK
- Repo : `/Users/walid/Projects/sortify`
- Conventions (`CLAUDE.md` + `AGENTS.md`) : pas de `any`, queries Supabase **uniquement** dans `lib/supabase/queries.ts`, commit après chaque tâche terminée
- Migrations Supabase : créer le fichier puis l'appliquer immédiatement via `supabase db query --linked < ...` (voir `MEMORY.md`)

## Avant de commencer
- Lis `node_modules/next/dist/docs/` si tu touches au routing/cache (Next 16 a des breaking changes)
- Lance `npm run lint` après chaque tâche
- Commit avec un message court en français suivant le style de `git log`

---

## TÂCHE 1 — Supprimer le fichier mort

**Fichier** : `lib/spotify/client.ts` (0 octets)

Vérifier qu'aucun import ne le référence (`grep -r "lib/spotify/client" app lib`) puis supprimer.

**Commit** : `chore: supprime lib/spotify/client.ts vide`

---

## TÂCHE 2 — Singleton Supabase

**Problème** : `lib/supabase/client.ts:4` `createClient()` est appelée 59× dans `queries.ts`. Chaque appel instancie un nouveau client.

**Fichier** : `lib/supabase/client.ts`

Remplacer par :
```ts
import { createClient as _createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createBrowserClient as _createBrowserClient } from "@supabase/ssr";

let _server: SupabaseClient | null = null;

export function createClient(): SupabaseClient {
  if (!_server) {
    _server = _createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } }
    );
  }
  return _server;
}

export function createBrowserClient() {
  return _createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

**Tests manuels** : lancer `npm run dev`, naviguer `/playlists`, `/dashboard`, `/inbox` — aucune régression attendue.

**Commit** : `perf(supabase): singleton client server-side`

---

## TÂCHE 3 — Batch des push Spotify dans `classify/run`

**Problème** : `app/api/classify/run/route.ts:92-100` boucle `addTrackToPlaylist` par track, qui re-fetch la playlist Spotify entière à chaque appel (`lib/spotify/fetchers.ts:313`). Pour 25 tracks classifiés sur 3 playlists → ~75 fetch + 25 POST.

**Pattern de référence** : `app/api/cron/weekly-sort/route.ts:170-222` accumule par playlist puis appelle `addTracksToPlaylist` une fois.

**Fichier** : `app/api/classify/run/route.ts`

Remplacer la boucle `for (const row of tracks)` par :
1. D'abord faire tous les `classify` + `upsertTrack` + `insertClassificationLog` (sans Spotify push)
2. Accumuler dans `const tracksByPlaylist = new Map<string, string[]>()`
3. Après la boucle, faire un `for (const [playlistId, ids] of tracksByPlaylist)` qui appelle `addTracksToPlaylist` une fois par playlist

Garder le shape de la réponse (`batchResults`, `classified`, `needs_review`, etc.) identique.

**Commit** : `perf(classify): batch Spotify push par playlist`

---

## TÂCHE 4 — Unifier le refresh token

**Problème** : double implémentation de refresh Spotify : `app/api/auth/[...nextauth]/route.ts:55-94` (JWT callback) et `lib/spotify/token.ts:6-55` (server actions). Logique légèrement différente (margin, gestion d'erreur, rotation refresh_token).

**Fichier** : `lib/spotify/token.ts`

1. Extraire la logique réseau pure dans une helper `refreshSpotifyToken(refreshToken: string)` qui renvoie `{ access_token, refresh_token, expires_at }`
2. Modifier `refreshAccessToken(userId)` pour utiliser cette helper + persister en DB
3. Dans `app/api/auth/[...nextauth]/route.ts`, importer et utiliser la helper au lieu du `fetch` inline

**Commit** : `refactor(spotify): unifie refresh token logic`

---

## TÂCHE 5 — Validation runtime avec zod

**Installer** : `npm i zod`

**Pattern à appliquer** dans chaque route handler qui parse `req.json()` :

```ts
import { z } from "zod";

const Body = z.object({
  description: z.string().trim().min(1),
});

const parsed = Body.safeParse(await req.json().catch(() => ({})));
if (!parsed.success) {
  return Response.json({ error: parsed.error.message }, { status: 400 });
}
const { description } = parsed.data;
```

**Routes à migrer** (toutes celles qui font `as { ... }` sur `req.json()`) :
- `app/api/playlists/from-description/route.ts`
- `app/api/playlists/route.ts` (POST)
- `app/api/playlists/[playlist_id]/route.ts`
- `app/api/inbox/batch-validate/route.ts`
- `app/api/classify/run/route.ts`
- `app/api/playlists/reorder/route.ts`
- Tous les autres dans `app/api/` qui parsent un body

**Commit** : `feat(api): validation zod sur les routes`

---

## TÂCHE 6 — Déduplication `isValidRules`

**Fichier nouveau** : `lib/classifier/rules.ts`

Extraire la fonction `isValidRules` (présente à l'identique dans `app/api/playlists/from-description/route.ts:45` et `app/api/playlists/[playlist_id]/learn/route.ts:42`). Idéalement la remplacer par un schéma zod si tâche 5 est faite :

```ts
import { z } from "zod";

const FeatureRange = z.object({ min: z.number(), max: z.number() });

export const PlaylistRulesSchema = z.object({
  genres: z.object({
    include: z.array(z.string()),
    exclude: z.array(z.string()),
  }),
  audio_features: z.record(z.enum(["energy","danceability","valence","tempo","acousticness"]), FeatureRange).default({}),
  hard_constraints: z.object({
    max_age_days: z.number().nullable(),
    require_genre_signal: z.boolean(),
  }),
});
```

Mettre à jour les 2 routes pour l'importer.

**Commit** : `refactor(classifier): extrait PlaylistRulesSchema`

---

## TÂCHE 7 — Singleton Anthropic + cap `max_tokens`

**Fichier nouveau** : `lib/anthropic.ts`

```ts
import Anthropic from "@anthropic-ai/sdk";
let _client: Anthropic | null = null;
export function getAnthropic(): Anthropic {
  if (!_client) _client = new Anthropic();
  return _client;
}
```

**Modifier** :
- `lib/classifier/level3-llm.ts:145` — utiliser `getAnthropic()` au lieu de `new Anthropic()`
- `lib/classifier/level3-llm.ts:107` — remplacer `max_tokens: 300 * inputs.length` par `max_tokens: Math.min(4096, 200 * inputs.length)`
- `app/api/playlists/from-description/route.ts:6` — utiliser `getAnthropic()`
- `app/api/playlists/[playlist_id]/learn/route.ts:119` — utiliser `getAnthropic()`

**Retirer** le `cache_control: ephemeral` dans `from-description/route.ts:42` (appelé trop rarement pour bénéficier du cache TTL 5 min). **Garder** celui de `level3-llm.ts:83` (appelé massivement).

**Commit** : `perf(anthropic): singleton client + cap max_tokens`

---

## TÂCHE 8 — Fisher-Yates pour `sampleRandomly`

**Fichier** : `app/api/playlists/[playlist_id]/learn/route.ts:20-23`

Remplacer :
```ts
function sampleRandomly<T>(arr: T[], n: number): T[] {
  if (arr.length <= n) return arr;
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, n);
}
```

**Commit** : `fix(learn): shuffle uniforme (Fisher-Yates)`

---

## TÂCHE 9 — Timeouts sur les enrichments externes

**Problème** : `lib/enrichment/deezer.ts`, `musicbrainz.ts`, `lastfm.ts`, `reccobeats.ts` font des `fetch` sans timeout. Un service lent bloque toute la pipeline d'enrichment.

**Pattern à appliquer** à chaque `fetch(...)` dans `lib/enrichment/*.ts` :
```ts
const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
```

Le `try/catch` existant attrape déjà l'`AbortError` (renvoie `[]` ou `null`).

**Commit** : `fix(enrichment): timeout 5s sur les API externes`

---

## TÂCHE 10 — Indexes Supabase manquants

**Fichier nouveau** : `supabase/migrations/20260526_extra_indexes.sql`

```sql
-- Lookup playlists par user + assigned (getPlaylistTracksAssigned, getPlaylistsStats)
CREATE INDEX IF NOT EXISTS idx_tracks_user_assigned
  ON tracks (user_id, assigned_playlist)
  WHERE is_archived = false;

-- GIN sur extra_playlists pour les .contains et .cs.{...}
CREATE INDEX IF NOT EXISTS idx_tracks_extra_playlists_gin
  ON tracks USING gin (extra_playlists);

-- Archive view
CREATE INDEX IF NOT EXISTS idx_tracks_user_archived
  ON tracks (user_id, is_archived);
```

**Appliquer** immédiatement :
```bash
supabase db query --linked < supabase/migrations/20260526_extra_indexes.sql
```

**Commit** : `feat(db): indexes pour playlists et extra_playlists`

---

## TÂCHE 11 — `removeFromExtraPlaylists` en un seul UPDATE

**Problème** : `lib/supabase/queries.ts:135-155` boucle séquentielle N updates.

**Approche** : créer une RPC Postgres et l'appeler.

**Fichier nouveau** : `supabase/migrations/20260526_remove_from_extras_rpc.sql`
```sql
CREATE OR REPLACE FUNCTION remove_playlist_from_extras(p_playlist_id uuid, p_user_id uuid)
RETURNS void LANGUAGE sql AS $$
  UPDATE tracks
  SET extra_playlists = array_remove(extra_playlists, p_playlist_id)
  WHERE user_id = p_user_id AND p_playlist_id = ANY(extra_playlists);
$$;
```

**Appliquer** la migration.

**Modifier** `lib/supabase/queries.ts:135-155` :
```ts
export async function removeFromExtraPlaylists(playlistId: string, userId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.rpc("remove_playlist_from_extras", {
    p_playlist_id: playlistId,
    p_user_id: userId,
  });
  if (error) throw error;
}
```

**Commit** : `perf(db): RPC pour remove_from_extras (1 query au lieu de N)`

---

## TÂCHE 12 — `next.config.ts` minimal

**Fichier** : `next.config.ts`

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "i.scdn.co" },           // Spotify CDN
      { protocol: "https", hostname: "mosaic.scdn.co" },      // Spotify playlists
      { protocol: "https", hostname: "e-cdns-images.dzcdn.net" }, // Deezer
    ],
  },
};

export default nextConfig;
```

**Commit** : `chore(next): remotePatterns Spotify/Deezer`

---

## TÂCHE 13 — `tsconfig` cible Node 24

**Fichier** : `tsconfig.json`

Changer `"target": "ES2017"` en `"target": "ES2022"`. Vérifier que `npm run build` passe.

**Commit** : `chore(ts): target ES2022`

---

## Checklist finale

- [ ] Commiter après **chaque** tâche
- [ ] Lancer `npm run lint` après chaque tâche
- [ ] Pour les tâches qui touchent à la DB : appliquer la migration **immédiatement** (`supabase db query --linked < migration.sql`)
- [ ] Ne pas créer de fichier de doc (`.md`) sauf demande explicite
- [ ] Ne pas ajouter de commentaires en plus dans le code (convention du projet)
- [ ] À la fin, faire `git log --oneline -20` pour confirmer la liste des commits

**Tâches volontairement exclues** du brief (à faire plus tard, demandent des décisions produit) :
- Split de `PlaylistsClient.tsx` / `OnboardingClient.tsx` (refacto UI lourde)
- Migration vers Vercel AI Gateway
- Activation de RLS Supabase (impacte la sécurité, à valider)
- Tests unitaires du classifier
