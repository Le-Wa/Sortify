# Prochaine session — passage de relais (13 oct. 2026, soir)

## État
Sortify V2 est **en production** (https://sortify-mauve.vercel.app). Branches `v2` = `main`, poussées sur GitHub (`origin`). 2 membres : Walid (propriétaire) et Jérémy (« Le G 87 »). Tri automatique le lundi.
Fait le 11/10 :
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
- **Power user, partie Spotify** : `/power` (lien sur la page d'accueil) — sa propre app Spotify, identifiants vérifiés puis chiffrés ; OAuth à part (`/api/power/callback`) puis jeton de passage signé (2 min) → session NextAuth (provider « power ») ; jetons renouvelés avec ses identifiants (`appFor`). Ces membres ne comptent pas dans les 5 places (limite du mode développement Spotify). **Pas testé de bout en bout** (il faut une deuxième app Spotify avec l'adresse de redirection `…/api/power/callback`).

## Fait le 12/10/2026 (onboarding, suite de `docs/analyses/2026-10-12-onboarding.md`)
- Proposition : « Divers : N titres (X %) » en permanence (alerte au-delà de 30 %), et pour chaque bac l'effet de le retirer / le remettre (`proposalImpact`, `lib/revelation.ts`). Vérifié sur les vraies données (140 / 1 039).
- Import : homonymes vérifiés sur Deezer une fois par artiste (verdict `artist_tags.homonym`, partagé), plus à chaque titre ; un homonyme inconnu de Deezer n'a aucun tag. Durée annoncée selon le nombre de likes.

## Pédagogie de l'onboarding (12/10/2026, planche `docs/design/pedagogie-*.jpg`)
Textes dans `app/ui/pedagogie/content.ts` (sans jargon technique, demande de Walid). Connexion : « Comment ça marche » dépliable (étapes, mots du disquaire, bon à savoir) ; après le code d'invitation : mini-guide en 4 écrans, « Passer » à tout moment ; attente : « Coin du disquaire » selon l'étape ; proposition : « Comment lire ta proposition » ; création : « Et ensuite ? » ; Accueil : bienvenue une seule fois (`members.welcomed_at`). Planche vivante : `/lab/pedagogie` (développement seulement). Mini-guide après le code non testé en vrai (il faut être déconnecté).

## Fait le 13/10/2026
- **Onboarding (suite de l'analyse du 12/10)**, déployé :
  - `/power` : champ « Ta clé Anthropic (facultatif) », vérifiée avec l'app Spotify puis enregistrée au retour de Spotify, **avant** que l'analyse ne démarre (`verifyAnthropicKey`, `lib/own-keys.ts` ; cookie de passage chiffré).
  - « Inviter un pote » : rappel + lien vers le dashboard Spotify (`/dashboard/<client id>/settings`, onglet User Management) et case « J'ai ajouté son e-mail… » obligatoire avant « Créer un code ». Quand les 5 places sont prises : « Créer un code (power user) ».
  - Garde-fous (`lib/library-size.ts`, testés) : **< 20 titres** → l'analyse refuse avec un message clair, « Réessayer » relit les likes (`lib/revelation.ts`) ; **< 60 titres** → 2 ou 3 bacs, pas de passe « compléter », message sur la proposition ; **import plafonné aux 2 500 likes les plus récents** (`MAX_IMPORT`, `capped` dans la progression, message sur la proposition).
  - **Coût de l'IA par membre** (`lib/ai-budget.ts`) : section « Coût de l'IA (30 jours) » dans les Réglages du propriétaire ; bandeau sur son Accueil si un membre dépasse **10 $ en 7 jours** (clés personnelles exclues).
- **Fenêtre d'import** : comparaison de 4 options dans `docs/analyses/2026-10-13-fenetre-import.md` (données Spotify : `scripts/lab/import-window.mts`). Recommandation : les 1 000 derniers likes (~3 $, ~10 min), plus tard « Ranger mes anciens likes ». **Rien codé**, en attente de Walid.
- **Banc du 13/10** (`docs/bench/2026-10-13-banc-essai.md`, `scripts/lab/algo-bench4.mts`, 4,86 $) : limite de 5 bacs sans effet (aucun titre ne dépasse 3 bacs) ; consigne des 3 transversaux gardée (82 % de placements validés contre 77 %, mais 31 % de titres partagés contre 41 %) ; Deezer pour les tags sans style gardé (Walid top 1 83 → 92 %) ; homonymes : **règle hybride recommandée** (verdict du titre pour les artistes signalés, sans appel Deezer en plus ; Walid top 1 75 → 96 % sur les 26 titres concernés). Le verdict par artiste n'est en base que pour 15 artistes (imports depuis le 12/10).
- **Idées** triées dans `docs/analyses/2026-10-13-idees.md` (effort, coût, design, points d'attention). Recommandation : importer ses playlists Spotify d'abord, puis Incertains + comptoir vide + ce bac dort.

## À faire
1. Retours de Jérémy sur son onboarding (Walid les donnera).
2. **Décidé par Walid le 13/10 et déployé** : import des **1 000 derniers likes** (`MAX_IMPORT`, `lib/library-size.ts`) ; homonymes en **règle hybride** (`genresForLikes`). Ne s'applique qu'aux prochains imports / tris (pas de re-rangement).
   Aussi le 13/10 (après ses réponses) :
   - **Avis de l'IA gardé pour Divers** à l'onboarding (table `divers_hints`) : les hésitations (< 0,6) vont dans Divers avec leur avis, pour le swipe de Divers sans IA.
   - **« Ranger mes anciens likes »** (`lib/old-likes.ts`, job « anciens ») : carte dans Réglages ; le membre sur la clé de Sortify demande, Walid accepte / refuse sur son Accueil (coût estimé) ; direct pour le propriétaire et les clés perso. Sûrs → bacs, sinon Divers + avis ; ajoutés **en bas** des playlists ; `likes.backfilled_at` les écarte du tri et de la synchro pendant le job. Refus testé ; **le job lui-même n'a pas tourné** (il écrit dans les playlists) — pour Walid : ~1 083 likes d'avant oct. 2024, ~1,67 $, ~6 min ; essai à blanc avant s'il le veut.
   - **Inférence par artiste écartée par le banc** (rangement d'office : 3 % validés ; indice au tri : 2,7× plus d'erreurs) — section 5 de `docs/bench/2026-10-13-banc-essai.md`.
   - Décisions de Walid : import des playlists en **copie Sortify** d'abord, playlist trop large → **découpage proposé** ; Divers : filtres + artiste + lot, « Fais-moi des bacs avec Divers », swipe avec l'avis gardé.
   - **Planche** `docs/design/idees-1..4.jpg` + `idees-potes.jpg` (planche vivante `/lab/idees?s=divers|playlists|gains|tard|potes`, dev).
   - Réponses de Walid (13/10, après-midi) : **plus de banc ni de dépense d'IA** sans son feu vert (budget épuisé) ; playlists : enlever les montants (fait sur la planche) ; petits gains + animations « Apple » : **faits** ; bilan du mois : abandonné ; ordre DJ : **fait** ; bacs des potes : planche d'exploration (3 pistes) **en attente de son choix** ; Divers : **fait**.
   - **Petits gains** (en ligne) : À trier — filtres « Incertains » / par bac (« Tout accepter » limité au filtre), coup sec, carte qui part du côté choisi, vibration Android ; **comptoir vide** (célébration seulement si on vient de le vider) ; **« ce bac dort »** (8 semaines sans titre liké, bacs de plus de 8 semaines, seulement si le membre like ; « Laisser dormir » = `bacs.asleep_ok_until`). Principes : `docs/analyses/2026-10-13-animations.md`. Démo sans écriture : `/lab/a-trier`.
   - **Ordre DJ** (en ligne, `lib/dj-order.ts` testé, `lib/dj.ts`) : tempo (± 6 %, demi / double), tonalité sur la roue de Camelot, énergie en montée ; tonalité ReccoBeats ajoutée aux 2 536 likes qui avaient de l'audio (`scripts/backfill-key.mts`) ; réglage sur la fiche du bac avec **aperçu chiffré** avant de réécrire la playlist (`bacs.play_order`), gardé après chaque synchro. Essai à blanc sur tous les bacs : `scripts/lab/dj-preview.mts` (ex. House solaire : bon tempo 41 → 86 %, tonalités 28 → 81 %). **Aucune playlist réécrite** : c'est Walid qui choisit.
   - **Divers** (en ligne) : filtres par famille de genre, vues Titres / Artistes (artistes à 2+ titres, les autres regroupés) / Un par un (avis gardé d'abord, sinon choix à la main, sans IA), rangement par lot (`placeManyFromDivers`, une seule synchro), « Fais-moi des bacs avec Divers » (≥ 30 titres, jusqu'à 2 propositions à la demande ; c'est un appel IA déclenché par le membre).
   - Affinité Walid × Jérémy (sans IA, `scripts/lab/affinity.mts`) : 39 %, 38 artistes et 12 titres en commun.
   - Walid (soir) : bacs des potes **A + B + C**, import des playlists **sans montants**, **ne pas ranger ses anciens likes**.
   - **Bacs des potes** (en ligne, `lib/potes.ts`, `lib/affinity.ts` testé, page `/potes`, carte sur Bacs) : accord dans Réglages (« Montrer mes bacs », bac par bac ; `members.share_bacs`, `bacs.shared`) — **activé pour Walid et Jérémy le 13/10 au soir** (Walid : « considère que Jérémy est d'accord ») ; A vitrine (affinité, bacs partagés, page d'un bac de pote) ; B croisement sur la fiche d'un bac (seuil de ressemblance 0,44, calé avec `scripts/lab/potes-check.mts`) → playlist « Reco des potes » ; C bac commun (`common_bacs`, proposé / accepté, playlist chez celui qui propose, remise à jour après chaque tri). Vérifié à deux : vitrine (39 %), bac « R&B nocturne » de Jérémy (218 titres, 3 déjà chez Walid), croisement Soul nocturne → R&B nocturne (8 titres). Pas encore créés : « Reco des potes » et le bac commun (écrivent dans Spotify).
   - **Import des playlists** (en ligne, `lib/playlists-import.ts`, `lib/playlist-split.ts` testé) : après l'import des likes, si la personne possède des playlists (≥ 15 titres, hors Sortify), écran « Tu ranges déjà un peu ? » (`/revelation`, étape `playlists`) ; chaque playlist cochée devient un bac (copie, fiche Opus `playlistFiche`, ses titres likés rangés d'office, étiquette « ta playlist ») ; trop large (aucun genre à 50 %) → découpage par famille, indice, ou de côté ; l'analyse ne double pas ces bacs et lit les indices. Lecture des playlists 3 à la fois (Spotify a répondu 429 à 25 en parallèle). Vérifié sur les playlists de Walid (`/lab/playlists`, lecture seule) : 15 candidates, « Good vibes planantes » découpée en Électro 53 / Soul & R&B 33 / Pop & rock 16. **Pas testé de bout en bout** (il faut un nouveau membre). Walid et Jérémy marqués « étape passée » (`members.playlists_done_at`).
   - Relance de Jérémy (avec son accord) : à préparer, il a déjà des bacs actifs.
3. Tester (Walid s'en occupe) : « + Nouveau bac » et « Récupérer » de bout en bout ; un retrait / ajout fait dans Spotify puis « Nouveaux likes ? » ; une clé Anthropic personnelle réelle (Réglages et maintenant `/power`) ; le mini-guide après un code d'invitation (navigation privée) ; le lien du dashboard dans « Inviter un pote » (adresse `/settings` supposée).
4. Tester sur un vrai téléphone : installation + « Prévenir le lundi » ; et la connexion `/power` avec une vraie app Spotify perso.
5. Plus tard : affiner les fiches à partir des corrections.
6. Idées (voir `docs/analyses/2026-10-13-idees.md`) : selon le choix de Walid.
7. **Plus tard : choix du LLM par membre, autres fournisseurs** (GPT, Gemini, Mistral…), pour les power users avec leur propre clé. Demande : couche commune (Vercel AI SDK / AI Gateway) à la place des appels Anthropic directs (sorties structurées, cache des fiches, repli en cas de refus, effort), puis chaque modèle passé au banc (`scripts/lab/algo-bench3.mts`) avant d'être proposé (liste validée). ~2–3 jours. Variante plus simple écartée pour l'instant par Walid : réglage « Qualité » parmi les modèles Claude (Haiku 76 % / Sonnet 86 % de premier bac juste).

## En attente de Walid
- Relancer l'import et l'analyse de Jérémy (avec son accord) une fois la fenêtre d'import décidée ; il a déjà créé « Foulées rythmées » (Divers 1 264 → 1 039).
- Re-ranger les bibliothèques avec les dernières corrections (Deezer pour les tags sans style, 0,6 minimum, règle hybride si validée) : essai à blanc d'abord, seulement à sa demande.
- Coût de l'onboarding enfin mesurable dans `ai_usage` au prochain pote (rapport : `scripts/ai-costs.mts`, ou Réglages).
- Plus de partage (16 %) : bacs transversaux à critère net ; « Avant de sortir » à surveiller.
- Suivre la part de titres « À trier » (cible ~20 %).

## Façon de travailler
- Français, tutoiement. Walid aime qu'on lui pose les questions produit (choix proposés), et voir des planches pour le design.
- Avant toute action de masse sur ses playlists : **essai à blanc**, résumé, puis validation.
- Commit après chaque tâche ; `main` avance en fast-forward sur `v2` ; déploiement : `npx vercel@latest deploy --prod --yes` (projet non relié à GitHub ; un « Not authorized » passager se règle en relançant).
- Migrations : `psql "$POSTGRES_URL_NON_POOLING" -f supabase/migrations/<fichier>.sql` (après `set -a; source .env.local`), appliquées tout de suite.
- Scripts hors app : `npm run try -- scripts/<fichier>.mts [options]` — **le `--` est indispensable** ; charger `.env.local` avant (`set -a; source .env.local; set +a`).
- Bancs d'essai : `scripts/lab/algo-bench3.mts` (échantillon fixe et verdicts du juge dans `docs/bench/2026-10-11/`) ; `scripts/lab/algo-bench4.mts <dossier> <limite|transversaux|style|homonymes>` (caches hors git : bibliothèque de Jérémy). Options de banc : `SortOptions.maxTransversal / maxPerTrack`, `proposeFiches(corpus, { rules })`. Le coût réel d'un banc se lit dans `ai_usage` (membre vide).
- Le panneau navigateur masqué met les animations en pause (ce n'est pas un bug).
