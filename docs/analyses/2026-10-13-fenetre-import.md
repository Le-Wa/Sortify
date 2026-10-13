# Fenêtre d'import — comparaison (13 oct. 2026, à décider par Walid)

Rien n'est codé : ce document sert à choisir. Règle actuelle (`lib/import.ts`) : 2 ans de likes, ou tout l'historique s'il y en a moins de 300.
Depuis le 13/10, l'import est de toute façon plafonné aux **2 500 likes les plus récents** (`MAX_IMPORT`, `lib/library-size.ts`).

## Les données

Lecture seule de Spotify (`scripts/lab/import-window.mts`) et de la base, le 13/10/2026.

| | Walid | Jérémy |
|---|---|---|
| Likes au total | 2 243 (depuis 2014) | 2 340 (depuis 2019) |
| 12 derniers mois | 678 | 123 |
| 24 mois | 1 157 | 259 |
| 36 mois | 1 263 | 434 |
| 48 mois | 1 284 | 666 |
| 60 mois | 1 288 | 921 |
| Rythme actuel | ~13 likes / semaine | ~2,4 likes / semaine |
| Titres sortis avant 2021, parmi les likes récents (2023–2026) | ~10 % | ~50 % |
| … parmi les likes anciens (2019–2020 pour Jérémy, 2014–2020 pour Walid) | 100 % | 100 % |

Walid a deux époques nettes (2014–2019, puis 2024–2026, presque rien entre les deux). Jérémy like peu mais régulièrement, avec un gros pic en 2019–2020 (1 226 likes, que des titres d'avant 2021).

## Comment sont estimés le coût et l'attente

- **Coût IA de l'onboarding** ≈ **1 $ + 0,21 centime par titre** :
  - fiches (Fable 5.1) : tout le corpus est lu, ~55 à 62 tokens par titre (compté avec l'API sur nos deux bibliothèques), plus la réflexion et la réponse ; mesuré au banc du 13/10 : **0,83 $ pour 450 titres** ;
  - rangement (Sonnet 5.5) : 0,14 à 0,16 c / titre (bancs du 10/10 et du 13/10) ;
  - passe « compléter » + remplissages : ~0,4 $.
  - `ai_usage` ne contient pas encore d'onboarding complet (il démarre le 11/10) : les chiffres viennent du banc et du comptage des tokens, à ± 25 %. Mesuré dans `ai_usage` : une retouche Opus sur la proposition de Jérémy coûte ~0,45 $ (elle relit tout le corpus).
- **Attente** ≈ 6 min + 1 min par 240 likes (formule de l'écran d'attente, calée le 12/10 ; 8 min au minimum). Une relance est plus rapide : les tags d'artistes sont déjà en cache.
- **Ensuite**, une bibliothèque plus grosse rend chaque retouche et chaque « + Nouveau bac » plus cher (≈ 0,024 c par titre et par retouche), mais **le tri du lundi ne dépend pas de la fenêtre** (seulement des nouveaux likes : ~0,50 $ / mois pour Walid, ~0,10 $ pour Jérémy).

## Les options

| | Règle | Walid (onboarding aujourd'hui) | Jérémy |
|---|---|---|---|
| **A. Actuelle** | 2 ans ; tout si < 300 | 1 157 likes · **~3,40 $** · ~11 min | 2 340 likes (depuis 2019) · **~5,90 $** · ~16 min · 82 % sortis avant 2021 |
| **B. Élargir année par année jusqu'à 300** (proposition du relais) | 2 ans, +1 an tant qu'il y a moins de 300 likes | identique à A | 434 likes (depuis oct. 2023) · **~1,90 $** · ~8 min · ~50 % avant 2021 |
| **C. Les 1 000 derniers likes** | les 1 000 plus récents, quel que soit l'âge | 1 000 likes (depuis juin 2025) · **~3,10 $** · ~10 min | 1 000 likes (depuis juin 2021) · **~3,10 $** · ~10 min · ~60 % avant 2021 |
| **D. Tout l'historique** | tout, dans la limite de 2 500 | 2 243 likes (depuis 2014) · **~5,70 $** · ~15 min · ~50 % avant 2021 | identique à A |

### Ce que ça donne

- **A — Actuelle.** Bon pour Walid. Pour Jérémy, le seuil « < 300 » fait tout basculer : ses bacs sont construits surtout sur 2019–2020 (1 226 likes sur 2 340), alors que ses nouveaux likes, ceux que le tri du lundi range, ressemblent à 2023–2026. Risque : des bacs datés et plus de titres « À trier ». Effet de seuil brutal : 299 likes en 2 ans → tout importer ; 301 → 2 ans.
- **B — Élargir jusqu'à 300.** Le moins cher et le plus rapide pour Jérémy, des bacs qui collent à ce qu'il like aujourd'hui. Mais 434 titres, c'est peu : avec ~2 likes par semaine, il aura ~6 à 8 bacs de 30 à 60 titres, et ses 1 900 likes plus anciens n'apparaîtront dans aucune playlist. Variante « jusqu'à 500 » : 666 likes depuis oct. 2022, ~2,40 $, ~9 min.
- **C — Les 1 000 derniers.** Même coût et même attente pour tout le monde, faciles à annoncer (« on part de tes 1 000 derniers likes »). Pour Walid, on perd 157 likes de fin 2024 – début 2025 par rapport à aujourd'hui ; pour Jérémy, on remonte à mi-2021 : des playlists bien remplies, plus récentes qu'en A. Un gros likeur (1 000 likes en 8 mois) n'aurait que ses derniers mois.
- **D — Tout l'historique.** Le plus complet : toute la bibliothèque est rangée, y compris les années 2014–2019 de Walid. Le plus cher et le plus long (~6 $, ~15 min pour vous deux), et des bacs qui mélangent deux époques : l'analyse proposera des bacs « d'avant » que les nouveaux likes ne nourriront presque jamais.

### Complément possible (n'importe quelle option)

Garder une fenêtre courte à l'onboarding (coût et attente bas), puis proposer plus tard **« Ranger mes anciens likes »** dans Bacs ou Réglages : l'import continue en tâche de fond, les anciens titres sont rangés dans les bacs existants (rangement seul, ~0,15 c par titre : 1 000 anciens likes ≈ 1,50 $), le reste va dans Divers. La complétude devient un choix de la personne, une fois qu'elle a vu ses bacs.

## Recommandation

**C (les 1 000 derniers likes)**, avec plus tard « Ranger mes anciens likes » pour qui veut tout. Coût et attente prévisibles (~3 $, ~10 min pour tout le monde), des bacs à jour du goût actuel, assez de titres pour des playlists bien remplies, et plus d'effet de seuil. B serait à préférer si le coût prime ; D seulement si « toute ma bibliothèque rangée » est la promesse principale.

Pour Jérémy, quelle que soit l'option : la relance de l'import et de l'analyse se fera **avec son accord**. Elle est à préparer : il a déjà des bacs actifs (dont « Foulées rythmées ») et des corrections, que la Révélation ne sait pas reprendre telle quelle. Essai à blanc et résumé chiffré d'abord.
