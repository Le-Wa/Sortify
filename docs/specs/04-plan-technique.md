# Sortify V2 — Plan technique

## Stack (gardée de la V1, l'infra existe déjà)
- Next.js 16 App Router + React 19, TypeScript strict (`proxy.ts`, APIs de requête async).
- NextAuth v4 + Spotify OAuth. Scopes : `user-library-read`, `playlist-read-private`, `playlist-modify-private`, `playlist-modify-public`, `ugc-image-upload` (pochettes), `user-read-email`.
- Supabase Postgres (service role côté serveur uniquement).
- Claude API (SDK `@anthropic-ai/sdk`) pour l'analyse et le rangement.
- Vercel + Cron quotidien.
- Enrichissement : Deezer (genres, ISRC, extraits), Last.fm (tags), ReccoBeats (énergie, valence…).

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
| `jobs` | analyse / création / tri en cours (statut, progression) |

## Phases
1. **Socle** — nettoyage du code V1 sur `v2`, design system (tokens clair/sombre, typo, composants), layout, navigation, connexion Spotify, codes d'invitation, schéma DB.
2. **Import** — récupération des likes (2 ans, repli sur tout l'historique si < 300), enrichissement.
3. **Révélation** — analyse IA → fiches de bacs, écran Proposition (garder, renommer, autre idée, fusionner, bac sur mesure), création des playlists + pochettes.
4. **Quotidien** — rangement IA (cron + « Nouveaux likes ? »), À trier (swipe, tout accepter, pourquoi), Accueil, corrections.
5. **Bacs** — liste réordonnable, détail (fiche éditable / ajustée par l'IA, retrait), caisse Divers, Réglages, ré-analyse et suggestions de bacs.

## État au 10/10/2026 (fin de phase 1, hors base)
- Fait : code V1 retiré de la branche `v2` (consultable au tag `legacy-v1`), dépendances inutiles retirées (Tailwind, xlsx, puppeteer).
- Fait, `npm run build` OK : `lib/` (env, db, members, auth, library, spotify/client, bac-colors), `proxy.ts`, design system (`app/globals.css`, `app/ui/`), pages Connexion (`/`), Invitation (`/invitation`), Réglages (heure/pause/suggestions, codes d'invitation, déconnexion), layout connecté `app/(app)/` (barre d'onglets, renvoi vers `/revelation` tant qu'aucun bac n'est actif), pages d'attente Accueil / À trier / Bacs / Révélation.
- Vérifié dans le navigateur (sans base) : Connexion clair/sombre, erreurs, formulaire d'invitation.
- Non testé faute de base : schéma `supabase/migrations/20261010120000_v2_schema.sql`, connexion Spotify de bout en bout, Réglages.
- **Bloquant** : le projet Supabase V1 (`jsdbonvhvjlestkxkzdv`) n'existe plus (DNS introuvable) et le `SUPABASE_ACCESS_TOKEN` est expiré. Il faut créer ou restaurer un projet Supabase, mettre à jour `.env.local`, puis appliquer la migration.
- À trancher pour la phase 4 : le cron Vercel Hobby ne tourne qu'une fois par jour, ce qui ne permet pas une heure de tri par membre (il faudrait un cron horaire, plan Pro). `vercel.json` pointe encore vers l'ancien cron V1.
- Ensuite : phase 2 (import des likes + enrichissement).
