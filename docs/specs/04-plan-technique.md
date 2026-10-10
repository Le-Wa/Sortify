# Sortify V2 — Plan technique

## Stack (gardée de la V1, l'infra existe déjà)
- Next.js 16 App Router + React 19, TypeScript strict (`proxy.ts`, APIs de requête async).
- NextAuth v4 + Spotify OAuth. Scopes : `user-library-read`, `playlist-read-private`, `playlist-modify-private`, `playlist-modify-public`, `ugc-image-upload` (pochettes), `user-read-email`.
- Supabase Postgres (service role côté serveur uniquement).
- Claude API (SDK `@anthropic-ai/sdk`) pour l'analyse et le rangement.
- Vercel + Cron quotidien.
- Enrichissement (mesuré le 10/10/2026 sur 1 154 likes, ~3 min 30) :
  - **Last.fm** : tags de l'artiste principal (cache partagé `artist_tags`), tags du titre en repli. 85 % des titres ont des genres. Limite 5 req/s respectée.
  - **ReccoBeats** : énergie, dansabilité, valence, acoustique, instrumental, tempo, par lots de 40 **identifiants Spotify** (les ISRC ne marchent pas — le code V1 ne récupérait rien). ~55 % de couverture, à toutes les époques.
  - **Deezer** : retiré de l'import (genres trop grossiers, 2 appels par titre). Sert uniquement aux extraits audio, résolus par ISRC au moment de l'écoute.

## Base de données V2
Nouvelles tables, **sans toucher aux tables V1** (`users`, `tracks`, `playlists`… restent en place, inutilisées) :

| Table | Rôle |
|---|---|
| `members` | compte Spotify, tokens, réglages (heure du tri, pause, suggestions), rôle owner |
| `invitations` | codes d'invitation (créé par, utilisé par) |
| `likes` | titres likés d'un membre + données enrichies (genres, audio) |
| `bacs` | fiches de bac : nom, pitch, brief, axe, couleur, ordre, playlist Spotify, actif |
| `bac_examples` | ancres positives/négatives (exemples et corrections) |
| `placements` | titre ↔ bac (confiance, source : ia / correction / manuel) |
| `pending` | titres « À trier » avec suggestions |
| `jobs` | import / analyse / création / tri en cours (statut, progression, bail du worker) |
| `artist_tags` | cache des tags Last.fm par artiste, partagé entre membres |

## Phases
1. **Socle** — nettoyage du code V1 sur `v2`, design system (tokens clair/sombre, typo, composants), layout, navigation, connexion Spotify, codes d'invitation, schéma DB.
2. **Import** — récupération des likes (2 ans, repli sur tout l'historique si < 300), enrichissement.
3. **Révélation** — analyse IA → fiches de bacs, écran Proposition (garder, renommer, autre idée, fusionner, bac sur mesure), création des playlists + pochettes.
4. **Quotidien** — rangement IA (cron + « Nouveaux likes ? »), À trier (swipe, tout accepter, pourquoi), Accueil, corrections.
5. **Bacs** — liste réordonnable, détail (fiche éditable / ajustée par l'IA, retrait), caisse Divers, Réglages, ré-analyse et suggestions de bacs.

## Jobs de fond
Un job (`lib/jobs.ts`, `lib/run-job.ts`) avance par passages de 240 s au plus, dans `after()` de la route `POST /api/jobs/[id]/run` (protégée par `CRON_SECRET`, `maxDuration` 300). Un passage prend un bail (`lease_until`), fait au moins une unité de travail, sauvegarde sa progression à chaque unité (battement de cœur) puis se relance lui-même s'il reste du travail. Un job sans battement de cœur depuis 90 s est relancé par l'écran qui le suit. L'utilisateur peut fermer l'app.

## État au 10/10/2026
- **Phase 1 — Socle** : faite. Connexion Spotify testée de bout en bout (premier compte = propriétaire). Base `sortify-v2` créée via l'intégration Vercel Marketplace (Paris `eu-west-3`, Postgres 17) ; migrations appliquées avec `psql "$POSTGRES_URL_NON_POOLING" -f …`.
- **Phase 2 — Import** : faite. Testée sur la vraie bibliothèque (1 154 likes, ~3 min 30).
- **Phase 3 — Révélation** : code fait, **création dans Spotify pas encore testée** (elle crée de vraies playlists : à lancer par l'utilisateur).
  - Analyse (`lib/analyse.ts`, enchaînée après l'import) : fiches (Fable, ~2 min 15) → rangement du corpus (Haiku, ~2 min 15) → passe « compléter » si couverture < 85 % (Opus, sur les orphelins) → remplissage des bacs à remplir. Mesuré : 13 bacs, couverture 83 %, 15 % des titres dans plusieurs bacs. Les orphelins restants sont surtout des titres sans aucun tag.
  - Proposition (`app/revelation/ProposalScreen.tsx`) : garder/retirer, renommer, autre idée, fusionner (titres des deux réunis, sans re-rangement), bac sur mesure ; extraits Deezer au toucher (`/api/preview`). Testé : dépliage, extrait, retrait/remise ; retouches IA testées hors base (`scripts/try-edits.mts`).
  - Création (`lib/creation.ts`) : `POST /me/playlists` (l'ancien `/users/{id}/playlists` renvoie 403), pochette JPEG générée (`lib/cover.tsx`, polices statiques dans `assets/fonts/`), titres ajoutés par 100 du plus récent au plus ancien, Divers = titres sans bac, puis bacs actifs.
  - Seuil de placement initial `INITIAL_PLACE_THRESHOLD = 0.5` (`lib/bacs.ts`) : à calibrer.
- À trancher pour la phase 4 : le cron Vercel Hobby ne tourne qu'une fois par jour, ce qui ne permet pas une heure de tri par membre (il faudrait un cron horaire, plan Pro). `vercel.json` pointe encore vers l'ancien cron V1.
- Essais hors app : `npm run try scripts/<fichier>.mts` (analyse, pochettes, retouches).
