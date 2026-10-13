# Banc d'essai — ce qui était en ligne sans mesure (13 oct. 2026)

Lecture seule (rien d'écrit en base ni dans Spotify). Script : `scripts/lab/algo-bench4.mts <dossier> <phase>`.
Coût réel (table `ai_usage`, appels hors membre) : **4,86 $** — rangement Sonnet 2,12 $, analyses Fable 1,67 $, juge Opus 0,75 $, vérifications Opus 0,32 $.
Les caches (décisions, verdicts, genres Deezer) restent dans `docs/bench/2026-10-13/`, hors git : ils contiennent la bibliothèque de Jérémy.

**Méthode.** Rangement par Sonnet 5.5 low comme dans l'app ; décision comme au tri (rangé si le meilleur bac atteint 0,6, puis chaque bac au-dessus de son seuil : 0,5 scène, 0,6 transversal ; 0,4–0,6 À trier ; sinon Divers). Juge : Opus 5.5 effort élevé (0 à 3 bacs par titre), ou vérification oui / non placement par placement. Bruit de mesure connu : ± 3 points sur 200 titres, bien plus sur les petits groupes (≤ 60 titres : ± 6 à 10 points).

## 1. Limite de 5 bacs par titre (2 scènes, 3 transversaux) — aucun effet

Échantillon et juge du 11/10 (200 titres de Walid, 16 bacs), 2 passages par variante.

| | Rangés | 2+ bacs | 4+ bacs | Avec transversal | Top 1 | Précision | Rappel |
|---|---|---|---|---|---|---|---|
| 3 bacs (2 + 2), passages 1 / 2 | 66 / 68 % | 16 / 16 % | 0 | 15 / 15 % | 86 / 85 % | 84 / 84 % | 91 % |
| **5 bacs (2 + 3), en ligne** | 68 / 69 % | 18 / 17 % | 0 | 16 / 17 % | 84 / 85 % | 82 / 82 % | 91 % |

Avec les seuils actuels, **aucun titre n'atteint 4 bacs ni 3 transversaux** (0 placement au-delà de l'ancienne limite sur 400 rangements). Écarts dans le bruit. La limite ne sert qu'aux corrections à la main.
→ **Garder tel quel.** Plus de partage ne viendra pas de la limite mais de bacs transversaux qui attirent des titres sûrs.

## 2. Consigne « au moins 3 bacs transversaux à critère net » (analyse initiale) — légèrement mieux, moins de partage

Bibliothèque de Jérémy, échantillon régulier de 450 titres, une analyse Fable par consigne (~0,83 $ chacune), 200 titres rangés, chaque placement transversal vérifié par le juge.

| Consigne | Bacs | Transversaux | Titres avec un transversal | Placements transversaux | Validés par le juge |
|---|---|---|---|---|---|
| Ancienne (« au moins deux », ~2/3 de scènes) | 15 | 3 : Soirée caribéenne (69 %), Nuit sensuelle (87 %), Dimanche soleil (100 %) | 41 % | 73 | 77 % |
| **Actuelle** | 15 | 4 : Grosse ambiance (59 %), Slow love (85 %), Sombre & tendu (100 %), Textes & conscience (88 %) | 31 % | 55 | **82 %** |

La consigne fait ce qu'elle dit : un transversal de plus, des critères écrits et vérifiables (« valence basse < 0,35, prod minimale »), plus justes. Mais elle **partage moins** (41 → 31 % des titres) : les critères nets sont plus étroits. Le moment de fête reste le plus flou des deux côtés (59–69 %). Une seule analyse par consigne : l'écart de précision (+5) est dans le bruit, celui du partage (−10) probablement pas.
→ **Garder la consigne** (la précision des transversaux était le problème du 11/10 : 48 %). Si tu veux plus de partage : viser un transversal « large mais net » (par énergie), pas un moment.

## 3. Genres Deezer pour les tags sans style — mieux, à garder

Titres dont les tags Last.fm ne disent aucun style (« french, female vocalists ») : 55 chez Walid (5 %), 58 chez Jérémy (2 %). Deezer ajoute des genres à 37 et 16 d'entre eux. Bacs actuels de chacun ; le juge voit les deux jeux de tags (léger avantage possible à la variante avec Deezer).

| | Rangés | Divers | Top 1 | Précision | Précision transversale | Rappel |
|---|---|---|---|---|---|---|
| Walid — Last.fm seul | 55 % | 22 % | 83 % | 84 % | 73 % | 84 % |
| **Walid — + Deezer (en ligne)** | 55 % | 18 % | **92 %** | **89 %** | 89 % | **96 %** |
| Jérémy — Last.fm seul | 59 % | 21 % | 93 % | 63 % | 43 % | 94 % |
| **Jérémy — + Deezer (en ligne)** | 50 % | 28 % | 93 % | **71 %** | 54 % | 91 % |

→ **Garder.** Le gain est net chez Walid ; chez Jérémy, moins de rangements mais plus justes. Les bibliothèques existantes n'en profitent pas encore (likes importés avant) : à inclure dans un re-rangement, si tu le demandes.

## 4. Homonymes vérifiés par artiste plutôt que par titre — à corriger, sans coût

En base, le verdict par artiste n'existe que pour 15 artistes (imports depuis le 12/10) : il a été simulé comme à l'import (premier titre que Deezer connaît) pour tous les artistes ayant au moins 2 likes. Les deux règles divergent sur **26 titres chez Walid (2 %) et 32 chez Jérémy (1 %)** :

| Type de désaccord | Walid | Jérémy |
|---|---|---|
| artiste signalé, mais ce titre-là ne contredit pas Last.fm (Jorja Smith signalée à cause d'un featuring, Kybba) | 10 | 22 |
| artiste signalé, titre inconnu de Deezer → **aucun tag** (Carla Prata, HUGEL — Jamaican, Princess' Lover) | 6 | 3 |
| artiste non signalé, mais ce titre contredit (Babe, Rilès, Joé Dwèt Filé) | 10 | 7 |

| Sur ces titres | Rangés | Top 1 | Précision | Rappel |
|---|---|---|---|---|
| Walid — par artiste (en ligne) | 65 % | 75 % | 86 % | 86 % |
| Walid — par titre (l'ancien, ~3× plus d'appels à Deezer) | 81 % | 83 % | 79 % | 90 % |
| **Walid — hybride** | 77 % | **96 %** | **92 %** | **93 %** |
| Jérémy — par artiste (en ligne) | 75 % | 88 % | 78 % | 87 % |
| Jérémy — par titre | 75 % | 100 % | 93 % | 100 % |
| **Jérémy — hybride** | 69 % | 96 % | **93 %** | 93 % |

**Hybride** : le verdict par artiste décide qui vérifier ; pour un artiste signalé, chaque titre garde ses tags Last.fm si ses genres Deezer ne les contredisent pas, ou si Deezer ne le connaît pas. Ces genres Deezer sont **déjà demandés titre par titre** pour les artistes signalés : aucun appel en plus, l'import reste aussi rapide. Il règle 41 des 58 désaccords (le 3e type reste, il demanderait de vérifier chaque titre).
→ **Recommandé : passer à l'hybride** (petit changement dans `genresForLikes`, `lib/import.ts`). Petits groupes : gain à confirmer, mais il va dans le même sens chez vous deux et ne coûte rien.

## Recommandations

1. Limite de 5 bacs : rien à changer.
2. Consigne des 3 transversaux : garder.
3. Deezer pour les tags sans style : garder ; profite aux bibliothèques existantes seulement après un re-rangement (essai à blanc d'abord, à ta demande).
4. Homonymes : **passer à la règle hybride** (attend ton feu vert).
