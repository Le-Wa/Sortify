# Analyse du parcours d'onboarding (12 oct. 2026, lecture du code, sans exécution)

Sources : `app/page.tsx`, `app/invitation/`, `app/power/`, `lib/auth.ts`, `lib/revelation.ts`, `lib/import.ts`, `lib/analyse.ts`,
`app/revelation/*` (WaitScreen, ProposalScreen, CreationScreen), `lib/creation.ts`, `app/(app)/layout.tsx`.
Cas réel : Jérémy (2e membre, 11/10/2026).

## 1. Le parcours aujourd'hui

| # | Étape | Écran / code | Durée estimée | Coût IA | Ce que voit la personne |
|---|---|---|---|---|---|
| 0 | Préalable : le propriétaire ajoute l'e-mail Spotify du pote dans le dashboard Spotify **et** lui crée un code | Réglages → Inviter | — | — | Rien (hors app) |
| 1 | Page d'accueil → « J'ai un code d'invitation » | `app/page.tsx`, `app/invitation` | < 1 min | — | Code `DISQ-XXXXXX`, puis Spotify enchaîne |
| 2 | Connexion Spotify (autorisation des scopes) | NextAuth, `lib/auth.ts` | < 1 min | — | Écran Spotify |
| 3 | Import des likes (2 ans, ou tout l'historique si < 300) | WaitScreen « On fouille tes bacs » | 1 min (likes) | — | Compteur de likes lus, pochette du dernier titre |
| 4 | Enrichissement (Last.fm, Deezer, ReccoBeats) | WaitScreen | **~8 min pour 1 000 likes, ~15 min pour 2 300** (voir P1-c) | — | Jauge « Genres, énergie et ambiances… » |
| 5 | Analyse : fiches (Fable) → rangement (Sonnet) → compléter (Opus) → remplissage | WaitScreen (jauge par étapes) | 4 à 8 min | 2 à 9 $ selon la taille | Pochettes feuilletées, jauge |
| 6 | Proposition : garder / retirer, renommer, autre idée, fusionner, « Il manque un bac ? » | ProposalScreen | libre | ~0,3 $ par retouche IA | Intercalaires dépliables, extraits |
| 7 | Création des playlists + pochettes | CreationScreen « On presse tes bacs » | 1 à 3 min | — | Pochettes qui se remplissent |
| 8 | Accueil | `/accueil` | — | — | Arrivage de la semaine, bacs servis |

Total : **15 à 30 minutes** entre le code et l'Accueil, dont ~10 à 25 min d'attente passive. L'écran annonce « ~5 min ».
L'app peut être fermée à tout moment (jobs de fond, reprise automatique) : c'est un vrai point fort.

## 2. Points forts
- Tout tourne en tâche de fond avec reprise (bail, relance si bloqué, « Réessayer » / « Reprendre » sur échec).
- Retouches riches sur la proposition (autre idée, fusion, sur mesure, extraits au toucher).
- Rien n'est créé dans Spotify avant validation de la proposition.
- Les bacs retirés sont maintenant mis de côté et récupérables (depuis le 12/10).
- Erreurs Spotify du mode développement expliquées sur la page d'accueil.

## 3. Problèmes, par priorité

### P1 — à corriger avant le prochain pote

**a. Retirer un bac n'a pas de conséquence visible.** Sur la proposition, rien n'indique combien de titres partiront dans Divers.
Jérémy a retiré ses bacs rap US / rap FR / afro : **54 % de sa bibliothèque** est partie dans Divers sans qu'il le sache.
→ Afficher en permanence « Divers : N titres (X %) » et, quand on retire un bac, « → N titres iront dans Divers ».
Mentionner qu'un bac retiré reste récupérable depuis Bacs. (`ProposalScreen.tsx`, `startCreation` calcule déjà Divers.)

**b. Fenêtre d'import : « tout l'historique » sous 300 likes.** Une bibliothèque peu active sur 2 ans importe tout depuis des années
(Jérémy : 259 likes sur 2 ans → 2 340 likes depuis 2019, 83 % sortis avant 2021). Bacs datés, import 2× plus long, coût IA 2×.
→ Élargir année par année jusqu'à ~300 likes (`importPage`, `lib/import.ts`). Point déjà « à décider ».

**c. L'enrichissement est devenu le goulot.** Depuis le 11/10, Deezer est interrogé pour **chaque** titre tagué (détection des homonymes),
à 8 requêtes/s max (limite Deezer 50/5 s), 2 requêtes par titre : +4 à +9 min. Or les homonymes sont une affaire d'**artiste**.
→ Vérifier un titre par artiste (et mettre le résultat en cache avec les tags d'artiste, `artist_tags`) : ~3× moins d'appels.
→ Corriger « Première analyse · ~5 min » (`WaitScreen.tsx`) par une estimation selon le nombre de likes.

**d. Le power user ne peut pas mettre sa clé Anthropic avant l'analyse.** La clé se règle dans Réglages, inaccessible pendant
la Révélation (aucun lien) : l'analyse, la plus chère, part sur la clé de Sortify.
→ Champ « Ta clé Anthropic (facultatif) » sur `/power`, ou lien Réglages depuis l'écran d'attente, avant le lancement de l'analyse.

### P2 — à faire bientôt

**e. Deux étapes manuelles pour le propriétaire** (dashboard Spotify + code), et l'erreur ne survient qu'à la connexion.
→ Dans la carte « Inviter un pote » : case « J'ai ajouté son e-mail dans le dashboard Spotify » avant d'afficher le code, avec le lien
direct vers le dashboard. (Rien d'automatisable : l'API Spotify ne permet pas d'ajouter des utilisateurs.)

**f. « Tes playlists actuelles ne sont pas touchées », mais les playlists Sortify seront publiques.** L'API ignore `public: false`
(constaté le 10/10). → Le dire avant la création (« visibles sur ton profil Spotify ; tu peux les rendre privées dans Spotify »).

**g. Petite bibliothèque.** Aucun garde-fou sous ~50 likes : l'IA proposera quand même ≥ 5 bacs de quelques titres.
→ Sous 60 likes : proposer 2–3 bacs maximum, ou attendre d'avoir plus de likes, avec un message clair.

**h. Grosse bibliothèque.** Au-delà de ~2 500 likes, coût et durée montent sans plafond (rangement ≈ 0,2 c/titre).
→ Plafonner le corpus d'analyse (ex. 2 000 titres les plus récents), ranger le reste en tâche de fond ensuite ; alerte de coût par membre (`ai_usage`).

**i. Fin d'onboarding sans « et maintenant ? ».** On arrive sur l'Accueil sans savoir que le tri passe le lundi, ni qu'on peut installer
l'app et être prévenu. → Un écran ou une carte de bienvenue unique : « Ton premier tri : lundi 8 h · Installe Sortify · Prévenir le lundi ».

### P3 — confort

**j.** Aucune notification quand l'analyse est prête (on peut fermer l'app, mais rien ne rappelle de revenir). Les notifications n'étant
possibles qu'une fois l'app installée, proposer l'installation dès l'écran d'attente.
**k.** L'écran Proposition ne dit pas qui sont les bacs « scène » et « transversaux » (étiquette seulement dépliée) ; un mot d'explication aiderait
à comprendre pourquoi un titre est dans deux bacs.
**l.** Les compteurs d'un bac retouché affichent « … » pendant le remplissage, sans durée indicative.
**m.** Pas de récapitulatif avant « Créer N bacs dans Spotify » (N playlists, M titres, Divers X %, playlists publiques).

## 4. Ordre recommandé
1. **P1-a** compteur Divers sur la proposition (le cas Jérémy) — petit, fort impact.
2. **P1-b** fenêtre d'import (décision de Walid), puis relancer Jérémy avec son accord.
3. **P1-c** Deezer par artiste + durée annoncée réaliste.
4. **P1-d** clé Anthropic sur `/power`.
5. **P2-i** carte de bienvenue (installation, notifications, lundi) et **P2-f** mention des playlists publiques.
6. Le reste selon les retours des prochains potes.
