# Prochaine session — passage de relais (11 oct. 2026)

## État
Sortify V2 est **en production** (https://sortify-mauve.vercel.app), branche `v2` = `main`.
Phases 1 à 5 faites (voir `docs/specs/04-plan-technique.md`, section « État »), plus :
- rangement par **Claude Sonnet 5.5** et **repli Deezer** pour les titres sans tag (banc d'essai : `docs/bench/2026-10-10-banc-essai.md`) ; bibliothèque de Walid entièrement re-rangée ;
- **changements faits dans Spotify** pris en compte à chaque tri (`lib/reconcile.ts`) : like retiré (réglage retirer/garder), retrait à la main = correction, ajout à la main = exemple ;
- **revue de sécurité** : dépendances à jour, codes d'invitation à 6 caractères, en-têtes, prompts protégés contre l'injection (`cleanForPrompt`, `DATA_RULE` dans `lib/corpus.ts`) ;
- **perf** : fonctions Vercel à Paris (`cdg1`, à côté de Supabase), squelette de chargement ;
- **design** : pochettes brutes (couleur + nom, sans code SRT, mots longs coupés « AFRO-/BEATS »), fiche de bac repliée, animations CSS légères.

## À faire, dans l'ordre
1. **Pochettes : une ou des formes simples selon la playlist** (demande de Walid). Il aime les couleurs brutes (repère dans Spotify) ; il a refusé le vinyle (avec ou sans sillons) et le code SRT. Proposer 2–3 variantes en planche (`scripts/lab/cover-variants.mts`, rendu `lib/cover.tsx` + `app/ui/Sleeve.tsx` / CSS `.sleeve`), le laisser choisir, puis renvoyer les pochettes (`scripts/reupload-covers.mts`).
2. **Plan pour l'algorithme** (validé dans le principe, à mesurer au banc avant de déployer) :
   - remettre le principe **scène / moment-ambiance** : deux familles de bacs rangées séparément (scène : 1 bac principal, 2 max ; moment/ambiance : 0 à 2, transversaux) pour créer du partage — aujourd'hui 11 bacs « scène » sur 13 ;
   - **tags d'artiste douteux** : ex. Ino Casablanca tagué « baile funk, reggaeton… » par Last.fm → rangé dans Caraïbes au lieu de Rap français / Groove / oriental ; montrer Deezer en plus quand il contredit Last.fm ;
   - **rafraîchir les frontières des fiches** après ajout / fusion / retrait de bac (la fiche Tech house cite encore « Techno nocturne », « Bass UK garage » qui n'existent plus) ;
   - plus tard : affiner les fiches à partir des corrections.
   Mesurer avec `scripts/lab/algo-bench.mts` (juge Opus, même échantillon), puis re-ranger avec `scripts/resort-library.mts` (essai à blanc, puis `--apply`).
3. **Petites features proposées** : toucher une pochette lance un extrait ; Accueil : n'afficher que les bacs qui ont reçu des titres au dernier tri ; renommer un bac (et sa playlist Spotify) + choisir sa couleur dans la palette ; choix clair / sombre / auto dans les Réglages.
4. **Plus tard** : réordonner par glisser-déposer (appui long sur mobile ?), onboarding « power user » (clés Spotify + Anthropic perso), alerte en cas d'échec du tri, tests automatisés, ranger les anciennes migrations V1 de `supabase/migrations`.

## En attente de Walid
- Tester un retrait / ajout fait directement dans Spotify, puis « Nouveaux likes ? ».
- Décider de la limite de 3 bacs par titre (remise en question).
- Suivre la part de titres « À trier » (cible ~20 %).

## Façon de travailler
- Français, tutoiement. Walid aime qu'on lui pose les questions produit (choix proposés), et voir des planches pour le design.
- Avant toute action de masse sur ses playlists : **essai à blanc**, résumé, puis validation.
- Commit après chaque tâche ; `main` avance en fast-forward sur `v2` ; déploiement : `npx vercel@latest deploy --prod --yes` (projet non relié à GitHub ; un « Not authorized » passager se règle en relançant).
- Migrations : `psql "$POSTGRES_URL_NON_POOLING" -f supabase/migrations/<fichier>.sql` (après `set -a; source .env.local`), appliquées tout de suite.
- Scripts hors app : `npm run try -- scripts/<fichier>.mts [options]` — **le `--` est indispensable**, sinon npm avale les options (ex. `--apply`). Ou directement `npx tsx --tsconfig tsconfig.json --conditions=react-server …`.
- Le panneau navigateur masqué met les animations en pause (ce n'est pas un bug).
