# Banc d'essai — plan pour l'algorithme (11 oct. 2026)

Bibliothèque réelle de Walid : 1 159 likes, 13 bacs. Lecture seule (rien d'écrit en base ni dans Spotify). Coût ≈ 6 $.
Scripts : `scripts/lab/deezer-contradictions.mts`, `scripts/lab/algo-bench3.mts`, `scripts/lab/algo-bench3-replace.mts`.
Données (échantillon, verdicts du juge, fiches simulées) : `docs/bench/2026-10-11/`.

**Méthode.** Échantillon fixe de 200 titres (160 au hasard hors exemples + 40 de Divers) et une **sonde** de 40 titres dont les tags Last.fm contredisent Deezer. Juge : Claude Opus 5.5 effort élevé, sur 16 bacs (les 13 actuels aux frontières rafraîchies + 3 transversaux simulés), avec tags Last.fm **et** Deezer. Toutes les variantes rangent avec Sonnet 5.5 low, comme l'app. Bruit de mesure (même variante, 2 passages) : ± 3 points.

## 1. Tags douteux : surtout des homonymes

Sur 904 likes qui ont à la fois des tags Last.fm et des genres Deezer, **139 (15 %) se contredisent**. La cause principale : Last.fm confond des artistes homonymes — HUGEL (DJ) ↔ rappeur finlandais, FEEL ↔ groupe de rock polonais, TIF ↔ J-pop, Crown et DRAMA ↔ metal, Novak ↔ screamo. Les tags étant ceux de l'artiste, toute sa discographie est touchée.

| Sur la sonde (40 titres aux tags contredits) | Top 1 |
|---|---|
| Actuel (2 passages) | 70 % / 67 % |
| + genres Deezer quand ils contredisent Last.fm | 79 % |
| + genres Deezer pour tous les titres | 77 % |
| **Deezer à la place de Last.fm quand ils se contredisent** (2 passages) | **83 % / 83 %** |

Sur l'échantillon normal, aucun effet mesurable (± 3 points). Cas d'Ino Casablanca : le juge le met aussi dans Caraïbes, parce que **la fiche Caraïbes le cite comme exemple** (héritage des mauvais tags lors de l'analyse) — ça se corrige dans la fiche.

## 2. Fiches aux frontières rafraîchies

4 fiches citaient « Techno nocturne » ou « Bass UK garage », bacs disparus. Une passe Opus réécrit seulement les phrases de frontière : plus aucun bac disparu cité. Effet sur le rangement neutre à légèrement positif (rappel 91 → 93 %, accord Divers 47 → 50 %).

## 3. Deux familles et bacs transversaux

| Variante (échantillon de 200) | Rangés | À trier | Divers | Titres dans 2+ bacs | Avec un transversal | Top 1 | Précision | Rappel |
|---|---|---|---|---|---|---|---|---|
| Actuel | 67 % | 23 % | 11 % | 16 % | 11 % | 89 % | 82 % | 91 % |
| Fiches rafraîchies + deux familles (13 bacs) | 66 % | 25 % | 10 % | 12 % | 11 % | 88 % | **86 %** | 91 % |
| 16 bacs (3 transversaux de plus), prompt actuel | 71 % | 22 % | 7 % | 30 % | 24 % | 87 % | 74 % | 91 % |
| 16 bacs, deux familles, Deezer si désaccord (2 passages) | 68 % | 25 % | 8 % | 25 % | 25 % | 86 % | 78 % | 90 % |

Précision par famille (rangements validés par le juge) :

| | Bacs de scène | Bacs transversaux |
|---|---|---|
| Actuel | 85 % | 59 % (Groove joyeux 12/20) |
| Deux familles, 13 bacs | **90 %** | 62 % |
| Deux familles, 16 bacs | 89 % | 48 % — Focus instrumental 4/4, Groove joyeux 13/21, Route de nuit 3/9, Avant de sortir 3/12 |

Précision des bacs transversaux selon la confiance (16 bacs, deux familles, 2 passages) :

| Seuil transversal | Précision | Titres qui reçoivent un transversal |
|---|---|---|
| 0,5 (règle actuelle) | 45 % | 29 % |
| 0,6 | 57 % | 15 % |
| **0,7** | **93–100 %** | 7 % |
| 0,8 | 100 % | 4 % |

## Conclusions

1. **Deezer à la place de Last.fm quand ils se contredisent** : +13 points sur les titres touchés (15 % de la bibliothèque), sans effet ailleurs. Demande de récupérer les genres Deezer de tous les likes (pas seulement en repli).
2. **Rafraîchir les frontières** après chaque ajout / fusion / retrait de bac : corrige les références mortes, sans risque.
3. **Ranger en deux familles** : les bacs de scène gagnent ~5 points de précision (85 → 90 %).
4. **Les bacs transversaux ne sont fiables qu'à confiance élevée.** Placés dès 0,5 comme aujourd'hui, un sur deux est contesté par le juge. À 0,7, ils sont presque toujours justes, mais le partage reste modeste. Les ambiances d'usage objectif (Focus instrumental) marchent ; les moments flous (« Avant de sortir », « Route de nuit ») non — même leçon que la V0 (spec 02).
