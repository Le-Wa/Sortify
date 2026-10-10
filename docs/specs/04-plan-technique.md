# Sortify V2 — Plan technique

## Stack (gardée de la V1, l'infra existe déjà)
- Next.js 16 App Router + React 19, TypeScript strict (`proxy.ts`, APIs de requête async).
- NextAuth v4 + Spotify OAuth. Scopes : `user-library-read`, `playlist-read-private`, `playlist-modify-private`, `playlist-modify-public`, `ugc-image-upload` (pochettes), `user-read-email`.
- Supabase Postgres (service role côté serveur uniquement).
- Claude API (SDK `@anthropic-ai/sdk`, `lib/claude.ts`) :
  - analyse : **Claude Fable 5.1** (spec 02 : « le plus capable »), effort `medium`, sortie structurée, repli serveur `fallbacks: "default"` ;
  - retouches (autre idée, fusion, sur mesure, passe « compléter », ajustement d'une fiche) : **Claude Opus 5.5** ;
  - rangement : **Claude Sonnet 5.5** en effort `low` depuis le banc d'essai du 10/10/2026 (`docs/bench/`) : 86 % de premier bac juste contre 76 % pour Haiku 5.5, décisions stables à 94 %. Lots de 20 (100 pour remplir un seul bac), 6 en parallèle, fiches en cache.
- Vercel (plan Hobby) + Cron quotidien `0 6 * * *` → `/api/cron/tri` (`vercel.json`), protégé par `CRON_SECRET`.
- Enrichissement (mesuré le 10/10/2026 sur 1 154 likes, ~3 min 30) :
  - **Last.fm** : tags de l'artiste principal (cache partagé `artist_tags`), tags du titre en repli. 85 % des titres ont des genres. Limite 5 req/s respectée.
  - **ReccoBeats** : énergie, dansabilité, valence, acoustique, instrumental, tempo, par lots de 40 **identifiants Spotify** (les ISRC ne marchent pas — le code V1 ne récupérait rien). ~55 % de couverture, à toutes les époques.
  - **Deezer** : extraits audio (résolus par ISRC au moment de l'écoute) et, depuis le banc d'essai, **repli pour les titres que Last.fm ne connaît pas** : genres d'album préfixés `deezer:` (`lib/enrichment/deezer.ts`), 90 % de couverture sur ces titres. Il ne reste que 17 likes sans tag sur 1 159.

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
| `suggestions` | changements de bacs proposés (ajouter / supprimer / fusionner), depuis Divers ou la ré-analyse, validés sur l'Accueil |

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
  - Analyse (`lib/analyse.ts`, enchaînée après l'import) : fiches (Fable, ~2 min 15) → rangement du corpus (Haiku à l'époque, Sonnet depuis le banc d'essai) → passe « compléter » si couverture < 85 % (Opus, sur les orphelins) → remplissage des bacs à remplir. Mesuré : 13 bacs, couverture 83 %, 15 % des titres dans plusieurs bacs. Les orphelins restants sont surtout des titres sans aucun tag.
  - Proposition (`app/revelation/ProposalScreen.tsx`) : garder/retirer, renommer, autre idée, fusionner (titres des deux réunis, sans re-rangement), bac sur mesure ; extraits Deezer au toucher (`/api/preview`). Testé : dépliage, extrait, retrait/remise ; retouches IA testées hors base (`scripts/try-edits.mts`).
  - Création (`lib/creation.ts`) : `POST /me/playlists` (l'ancien `/users/{id}/playlists` renvoie 403), pochette JPEG générée (`lib/cover.tsx`, polices statiques dans `assets/fonts/`), titres ajoutés par 100 du plus récent au plus ancien, Divers = titres sans bac, puis bacs actifs.
  - Seuil de placement initial `INITIAL_PLACE_THRESHOLD = 0.5` (`lib/bacs.ts`) : à calibrer.
- **Phase 4 — Quotidien** : code fait, testé sans nouveau like réel.
  - Tri (`lib/tri.ts`, job « tri ») : nouveaux likes (plus récents que le dernier connu) → enrichissement → rangement IA (Sonnet) → synchro Spotify (`lib/sync.ts`, nouveaux titres en haut) → `last_sorted_at`. Seuils : ≥ 0,6 rangé directement (avec ses autres bacs ≥ 0,5), 0,4–0,6 « À trier », sinon Divers. Mesuré sur 240 titres : 74 % rangés, 15 % À trier, 10 % Divers (`scripts/try-tri.mts`).
  - Cron Hobby quotidien (`/api/cron/tri`) + bouton « Nouveaux likes ? » (`/api/tri` pour le suivi). Pas d'heure par membre (`sort_hour` inutilisé).
  - À trier (`app/(app)/a-trier`) : un titre à la fois, swipe droite = ranger, gauche = Divers, « Pourquoi ? », « + Autre bac… », « Tout accepter ». Accueil : résumé du dernier tri, comptoir, derniers rangements avec « Corriger », rangée de bacs.
  - Apprentissage (`lib/daily.ts`) : bac choisi contre l'IA → exemple positif ; bac proposé refusé ou retiré → contre-exemple ; 20 au plus par bac et par polarité. Retrait Spotify : `DELETE /playlists/{id}/items` `{ items: [{ uri }] }`.
- **Phase 5 — Bacs** : code fait.
  - Bacs (`app/(app)/bacs`) : liste avec titres et likes de la semaine, « Réordonner » (↑↓, ordre de la rangée de l'Accueil), caisse Divers (ranger un titre à la main).
  - Détail d'un bac : fiche modifiable à la main ou « demande à l'IA de l'ajuster » (Opus, ~15 s), arrivées récentes avec « Retirer » (contre-exemple, Divers si plus aucun bac), remplissage automatique, « Retirer ce bac de Sortify » (la playlist reste dans Spotify).
  - Suggestions (`lib/suggestions.ts`) : après chaque tri, si les suggestions sont activées, au plus une fois par semaine, l'IA cherche dans Divers un groupe d'au moins 15 titres ; « Relancer l'analyse » (Réglages, job `reanalyse`, Fable) propose ajouter / supprimer / fusionner. Tout s'affiche sur l'Accueil (Créer / Non merci). Accepter crée la playlist et sa pochette ; les titres concernés quittent Divers.
  - Réglages : relancer l'analyse, supprimer mes données (confirmation « SUPPRIMER », cascade en base, playlists gardées dans Spotify).
  - Testé : écrans, réordonnancement, ajustement IA (hors base), vérification de Divers, ré-analyse réelle (1 proposition : « Techno mélodique »), aller-retour Divers → bac → Divers vérifié dans Spotify. Pas testé en réel : accepter une suggestion, retirer un bac de Sortify, fusion de bacs actifs, suppression des données.
- Ensuite : déploiement en production (le cron ne tourne qu'en prod), puis retours d'usage.
- Essais hors app : `npm run try scripts/<fichier>.mts` (analyse, pochettes, retouches).
