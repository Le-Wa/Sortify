# Prochaine session — passage de relais (11 oct. 2026, soir)

## État
Sortify V2 est **en production** (https://sortify-mauve.vercel.app), branche `v2` (en avance sur `origin/v2`, pas encore poussée).
Fait aujourd'hui :
- **Pochettes à formes** (variante B choisie sur planche, `docs/design/pochettes-formes*.png`) : une forme par bac, pleine (scène) ou en contour (ambiance / moment). **Toucher la pochette** d'un bac → choix de la forme, plein / contour et couleur, renvoyée à Spotify. Walid a déjà personnalisé Tech house (noir + éclair), Afro orient (orange + soleil), Fin de nuit (lune en contour).
- **Algorithme** mesuré au banc (`docs/bench/2026-10-11-banc-essai.md`) puis appliqué :
  - Deezer remplace Last.fm quand ils se contredisent (homonymes Last.fm : 139 likes) ;
  - rangement en deux familles (scène / transversal), seuil 0,6 pour les transversaux ;
  - frontières des fiches rafraîchies (plus de « Techno nocturne » / « Bass UK garage »), automatiquement après ajout / retrait de bac ; Ino Casablanca retiré de la fiche Caraïbes ;
  - 3 bacs transversaux créés : **Route de nuit** (19), **Avant de sortir** (32), **Focus instrumental** (17).
  - Bibliothèque re-rangée (`scripts/migrate-algo-2026-10-11.mts`) : 304 titres déplacés, Divers 151 → 140, 17 playlists vérifiées identiques à la base. Sauvegarde : `backups/` (hors git).
- Walid va tester avec un ami (code d'invitation dans Réglages ; ajouter son compte dans le Spotify Developer Dashboard, mode développement).

## Test avec Jérémy (ami de Walid, 2e membre)
- 2 340 likes importés (fenêtre élargie à tout l'historique, voir « En attente »). Enrichissement meilleur que Walid (Last.fm 87 %, audio 82 %) car bibliothèque plus ancienne ; 139 titres passés sur Deezer (homonymes : Kima, DaniLeigh, Warped, SDM, Naza).
- **Divers = 1 264 titres sur 2 340 (54 %)** : il a retiré lui-même sur l'écran Proposition les bacs de sa scène principale (rap US, rap FR actuel, Kalash / Martinique, afrobeats). Idée : lui proposer plus tard de les récupérer (les bacs retirés sont effacés à la création, `lib/creation.ts`) ; en attendant, « Relancer l'analyse » dans Réglages proposera des bacs depuis Divers.
- Corrigé suite au cas Larusso (rangée dans « Rap FR old school » à 0,5 avec les seuls tags « french, female vocalists ») : genres Deezer ajoutés quand les tags Last.fm n'ont aucun style (`hasStyle`), et à la création un titre n'est rangé que si son meilleur bac atteint 0,6 (`SURE_THRESHOLD`), comme au tri quotidien. Pas de re-rangement des bibliothèques existantes (à faire avec essai à blanc si voulu).

## Nouveau bac (11/10/2026)
Page Bacs → « + Nouveau bac » : description libre → job « bac » en tâche de fond (`lib/new-bac.ts`) : fiche par l'IA (`customFiche`, Opus) → recherche des titres dans toute la bibliothèque par paquets de 600 → playlist + pochette, titres sortis de Divers (`createActiveBac`) → frontières des autres fiches rafraîchies. Suivi dans la page (jauge, titres écoutés / trouvés) via `POST /api/bac` ; l'app peut être fermée. Plafond 25 bacs actifs. **Pas encore testé de bout en bout** (crée une vraie playlist) : premier essai à faire par Walid ou Jérémy (ex. « rap US des années 2000 »).

## Tri hebdomadaire et Arrivages (11/10/2026)
- Le tri automatique passe **chaque lundi à 6 h UTC** (8 h à Paris l'été) au lieu de chaque matin (`vercel.json`, `nextCron` dans `lib/dates.ts`) ; « Nouveaux likes ? » reste disponible à la main.
- 4e onglet **Arrivages** (`app/(app)/arrivages`, `lib/arrivages.ts`, `lib/weeks.ts`) : les likes des 8 dernières semaines, une fiche dépliable par semaine (cette semaine ouverte), par bac avec ses titres, plus À trier et Divers.
- Le serveur de dev Turbopack garde parfois l'ancienne liste d'exports d'un module modifié (« X is not a function ») : relancer le serveur, ou mettre les nouvelles fonctions dans un nouveau module.

## Coût de l'IA (depuis le 11/10/2026)
Chaque appel à l'IA est enregistré dans `ai_usage` (membre, tâche, étape, modèle, tokens, coût au tarif public), via `responseText` (`lib/claude.ts`) et le contexte `withUsage` (`lib/ai-usage.ts`) posé par les jobs et les actions. Rapport : `npm run try -- scripts/ai-costs.mts [jours]`. Avant cette date, rien n'est enregistré : l'onboarding de Jérémy est estimé à ~7–9 $ (rangement de 2 340 titres ~4 $, fiches Fable ~2 $).

## Points d'attention
- **Le partage n'a pas augmenté** (17 % → 16 % des titres dans plusieurs bacs) : le seuil 0,6 a vidé Groove joyeux (124 → 84) et Fin de nuit (43 → 25) des titres douteux, compensé par les 3 nouveaux bacs. « Avant de sortir » est surtout de l'afrobeats (Rema, Burna Boy) : à surveiller, le juge le trouvait flou. Si Walid veut plus de partage : bacs transversaux à critère net (comme Focus instrumental), pas de seuil plus bas (45 % de justes à 0,5).
- L'analyse initiale (Fable) n'a pas été retouchée : elle propose toujours ~2/3 de scènes. À revoir si l'ami obtient peu de bacs transversaux.

## Fait le 12/10/2026
- Limite de **5 bacs par titre** (2 scènes, 3 transversaux ; `lib/limits.ts`) — non mesurée au banc.
- Bacs retirés de la proposition **mis de côté** (statut `archived`, sans titres) et **récupérables** depuis Bacs (job « bac » qui reprend la fiche).
- Analyse initiale : au moins 3 bacs transversaux à critère net (consigne, non mesurée).
- **Extrait au toucher** de la pochette d'un titre (Arrivages, Accueil, fiche d'un bac ; `app/ui/PreviewCover.tsx`).
- **Accueil** : « Arrivage de la semaine » (likes des 7 derniers jours, modifiables, 10 affichés) et seulement les bacs servis cette semaine ; nombre de likes en attente du tri de lundi.
- **Renommer un bac** (et sa playlist Spotify) depuis le panneau de la pochette ; les fiches voisines sont rafraîchies.
- **Apparence** auto / clair / sombre (cookie par appareil, `data-theme` sur `<html>`).
- **Alerte** : bandeau sur l'Accueil quand le dernier tri a échoué ; incidents des 7 derniers jours dans les Réglages du propriétaire.
- **Tests** : `npm test` (Vitest, `lib/__tests__/`) — homonymes, formes, mise en page, dates, semaines, couleurs, coût.
- Migrations V1 rangées dans `supabase/archive-v1/`.
- **Power user, partie Anthropic** : clé personnelle dans les Réglages, vérifiée, chiffrée (AES-GCM dérivé de `NEXTAUTH_SECRET`, `lib/secrets.ts`) ; tous les appels du membre passent par elle (`withUsage` → `claude()`), comptés `own_key` dans `ai_usage`.

## Fait le 12/10/2026 (suite)
- **Ne jamais ranger un titre** (À trier, Corriger, Divers) → drapeau `likes.excluded` ; liste « Mis de côté » dans les Réglages (« Remettre » → Divers). Testé de bout en bout.
- **Playlist « Arrivage de la semaine »** dans Spotify (likes des 7 derniers jours, mise à jour après chaque tri, `lib/arrival-playlist.ts`, réglable). Créée pour Walid ; celle de Jérémy se créera à son prochain tri. `scripts/arrival-now.mts [--all]`.
- **Notifications du lundi** (web push) : Sortify installable (`app/manifest.ts`, `public/icons`, `public/sw.js`), réglage « Prévenir le lundi » avec « Essayer », envoi après le tri du lundi (`lib/push.ts`, clés `VAPID_*` dans Vercel). Sur iPhone : ajouter Sortify à l'écran d'accueil d'abord. **Pas testé sur un vrai téléphone.**
- **Power user, partie Spotify** : `/power` (lien sur la page d'accueil) — sa propre app Spotify, identifiants vérifiés puis chiffrés ; OAuth à part (`/api/power/callback`) puis jeton de passage signé (2 min) → session NextAuth (provider « power ») ; jetons renouvelés avec ses identifiants (`appFor`). Ces membres ne comptent pas dans les 25 places. **Pas testé de bout en bout** (il faut une deuxième app Spotify avec l'adresse de redirection `…/api/power/callback`).

## À faire
1. Retours de Jérémy sur son onboarding (Walid les donnera).
2. Tester : « + Nouveau bac » et « Récupérer » de bout en bout ; un retrait / ajout fait dans Spotify puis « Nouveaux likes ? » ; une clé Anthropic personnelle réelle.
3. Tester sur un vrai téléphone : installation + « Prévenir le lundi » ; et la connexion `/power` avec une vraie app Spotify perso.
4. Plus tard pour l'algo : affiner les fiches à partir des corrections ; mesurer au banc la limite de 5 et la nouvelle consigne de l'analyse.
5. Plus tard : réordonner par glisser-déposer.

## En attente de Walid
- **Fenêtre d'import** : aujourd'hui, 2 ans de likes, ou tout l'historique s'il y en a moins de 300 (`lib/import.ts`, `CORPUS_YEARS` / `SMALL_LIBRARY`). Le pote de Walid avait 259 likes sur 2 ans → import depuis 2019 (2 340 likes, 1 918 titres sortis avant 2021). Proposition : élargir année par année jusqu'à 300 likes, puis relancer son import et son analyse.
- Re-ranger les bibliothèques avec les dernières corrections (Deezer pour les tags sans style, 0,6 minimum) : essai à blanc d'abord.
- Plus de partage (16 %) : bacs transversaux à critère net ; « Avant de sortir » à surveiller.
- Suivre la part de titres « À trier » (cible ~20 %).

## Façon de travailler
- Français, tutoiement. Walid aime qu'on lui pose les questions produit (choix proposés), et voir des planches pour le design.
- Avant toute action de masse sur ses playlists : **essai à blanc**, résumé, puis validation.
- Commit après chaque tâche ; `main` avance en fast-forward sur `v2` ; déploiement : `npx vercel@latest deploy --prod --yes` (projet non relié à GitHub ; un « Not authorized » passager se règle en relançant).
- Migrations : `psql "$POSTGRES_URL_NON_POOLING" -f supabase/migrations/<fichier>.sql` (après `set -a; source .env.local`), appliquées tout de suite.
- Scripts hors app : `npm run try -- scripts/<fichier>.mts [options]` — **le `--` est indispensable** ; charger `.env.local` avant (`set -a; source .env.local; set +a`).
- Bancs d'essai : `scripts/lab/algo-bench3.mts` (échantillon fixe et verdicts du juge dans `docs/bench/2026-10-11/`).
- Le panneau navigateur masqué met les animations en pause (ce n'est pas un bug).
