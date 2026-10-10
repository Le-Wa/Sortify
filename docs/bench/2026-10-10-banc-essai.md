# Banc d'essai — enrichissement et rangement (10 oct. 2026)

Bibliothèque réelle de Walid : 1 159 likes, 13 bacs. Tout en lecture seule (rien d'écrit en base ni dans Spotify).
Scripts : `scripts/lab/` (`enrich-sources.mts`, `algo-bench.mts`, `algo-bench2.mts`, `judge-check.mts`). Coût total ≈ 3 $.

## 1. Enrichissement

| | Titres |
|---|---|
| Avec tags Last.fm | 988 (85 %) — 3,9 tags en moyenne, presque tous des tags d'artiste |
| Sans aucun tag | 171 (15 %), dont 88 dans Divers — surtout des artistes émergents sortis en 2024–2026 |
| Sans audio (ReccoBeats) | 538 (46 %) |
| Tags sans style (seulement pays / « female vocalists ») | 10 — négligeable |

**Sources testées sur 60 titres sans tag :**

| Source | Couverture |
|---|---|
| **Deezer (genres de l'album, via ISRC)** | **54 / 60 (90 %)** — grossier (« electro », « techno/house », « rap/hip hop »…) mais utile |
| Last.fm, tags du titre | 0 |
| MusicBrainz | 0 |
| Spotify, genres de l'artiste | 0 (vides pour une app en mode développement) |
| Connaissances de l'IA (Haiku / Sonnet) | 4 connus ; Sonnet devine 14 autres sans certitude |

## 2. Rangement

**Méthode.** 200 titres (160 au hasard hors exemples des fiches + 40 de Divers). Un juge, Claude Opus 5.5 en effort élevé, range chaque titre indépendamment (0 à 3 bacs). Fiabilité du juge : un second juge (Claude Fable 5.1) est d'accord à **90 %** (23 des 29 « Divers » d'Opus confirmés) — c'est le plafond réaliste.

Indicateurs (seuil « rangé » = 0,6) : **top 1** = le 1er bac proposé est l'un de ceux du juge ; **précision** = part des rangements directs que le juge valide ; **rappel** = part des bacs du juge retrouvés (rangés ou à trier) ; **accord Divers** = titres que le juge laisse en Divers et que la variante y envoie aussi.

| Variante | Coût / 200 | Temps | Rangés | À trier | Divers | Top 1 | Précision | Rappel | Accord Divers | Même décision sur 2 passages |
|---|---|---|---|---|---|---|---|---|---|---|
| **A. Haiku low, lots de 20 (actuel)** | 0,02 $ | 19 s | 70 % | 23 % | 8 % | 76 % | 78 % | 80 % | 34 % | **84 %** |
| B. Haiku medium | 0,03 $ | 30 s | 69 % | 23 % | 9 % | 81 % | 83 % | 84 % | 38 % | — |
| **C. Sonnet 5.5 low** | 0,31 $ | 16 s | 70 % | 20 % | 11 % | **86 %** | 83 % | **92 %** | 59 % | **94 %** |
| D. Haiku low, lots de 5 | 0,05 $ | 34 s | 69 % | 20 % | 11 % | 81 % | 81 % | 84 % | 45 % | — |
| E. Haiku low, sans tags ni audio | 0,02 $ | 21 s | 76 % | 17 % | 8 % | 69 % | 67 % | 71 % | 21 % | — |
| F. Haiku low + Deezer si sans tag | 0,02 $ | 24 s | 74 % | 21 % | 6 % | 80 % | 74 % | 84 % | 28 % | — |
| G. Sonnet low + Deezer | 0,31 $ | 16 s | 70 % | 25 % | 6 % | **88 %** | 83 % | **95 %** | 41 % | — |
| H. Sonnet medium + Deezer | 0,31 $ | 17 s | 70 % | 24 % | 7 % | 87 % | 83 % | 95 % | 48 % | — |
| I. Haiku medium + Deezer | 0,03 $ | 31 s | 68 % | 29 % | 4 % | 83 % | 85 % | 86 % | 17 % | — |

**Calibration (accord du juge selon la confiance du 1er choix)**

| Confiance | Haiku low (actuel) | Sonnet low |
|---|---|---|
| 0,5–0,6 | 26 % | 37 % |
| **0,6–0,7** | **53 %** | **77 %** |
| 0,7–0,8 | 76 % | 91 % |
| 0,8–0,9 | 91 % | 93 % |
| 0,9–1 | 100 % | 100 % |

Avec Haiku, un titre rangé directement à 0,6–0,7 n'est juste qu'une fois sur deux ; avec Sonnet, trois fois sur quatre. Monter le seuil à 0,7 améliore la précision (≈ 90 %) mais envoie un tiers des titres dans « À trier ».

**Erreurs typiques (actuel)** : confusions entre bacs électroniques voisins (Tech house festival / House solaire / Rave warehouse / Techno mélodique), et entre Afrobeats et Afro house oriental. Ce sont des frontières de fiches plus que des contresens.

## 3. Conclusions

1. **Les tags comptent beaucoup** : sans eux, la précision tombe de 78 % à 67 %. L'enrichissement actuel est donc utile, et son seul vrai trou, ce sont les 15 % de titres sans tag.
2. **Sonnet 5.5 range nettement mieux que Haiku**, à vitesse égale : +10 points de top 1, +12 de rappel, décisions bien plus stables (94 % contre 84 %) et une confiance qui veut dire quelque chose. Il approche le plafond de 90 % fixé par l'accord entre juges. Coût : environ 0,15 centime par titre, soit ~0,50 $ par mois et par membre au quotidien, et ~1,80 $ par analyse initiale.
3. **Deezer en repli pour les titres sans tag** : couverture de 90 % de ces titres, gain modeste mais réel (Divers passe de 11 % à 6 %, rappel 92 → 95 % avec Sonnet). Le juge est parfois plus strict que la variante sur ces titres.
4. **Les seuils 0,6 / 0,4 sont bons avec Sonnet** : 70 % rangés, ~20 % à trier, ~10 % Divers.
5. Plus d'effort (medium) ou des lots plus petits améliorent Haiku un peu, sans l'amener au niveau de Sonnet.

## 4. Recommandations

1. Ranger avec **Claude Sonnet 5.5 (effort low)** au lieu de Haiku, pour le tri quotidien et le remplissage des bacs. Seuils inchangés.
2. Ajouter **Deezer (genres d'album) en repli** dans l'enrichissement quand Last.fm n'a rien.
3. Plus tard : resserrer les frontières des bacs électroniques voisins (fiches), et vérifier sur 20–30 titres tranchés par Walid là où les variantes divergent.
