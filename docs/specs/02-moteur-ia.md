# Sortify — Moteur IA (v0, brouillon)

> Comment l'IA définit les playlists puis y range les titres.
> Construit à partir des essais de mai–juin 2026 (traces : `docs/archive/benchmark-taxonomy-prompt-2026-06-07.md`, commits `classifier`/`benchmark`/`onboarding`, branche `fix/audit-p1-p2`).

## 1. Ce qu'on a appris (V0)

| Essai | Résultat | Leçon |
|---|---|---|
| Classifieur 3 niveaux (règles genres → centroïde audio → LLM) | Complexe, fragile, difficile à régler | Trop de pièces. Le LLM seul faisait mieux. |
| Engine v2 « LLM seul décide » (Haiku, batch de 5) | Meilleur que v1 au benchmark A/B | Bonne direction. Batchs petits + retry sinon réponses tronquées. |
| Taxonomie : LLM propose des playlists définies par `genres_include` | 56 % des titres matchés | Le LLM invente des genres absents des tags → aucun match. |
| + catalogue des genres réels fourni au LLM | 70–83 % | Mieux, mais plafond. |
| Équilibre genre ↔ ambiance (spectre 1→10) | Pic à « 5 » : scène + mood (« Soul nocturne », « Électro solaire ») | **Le bon format de playlist = une scène + une couleur.** Le pur « vibe » rend le LLM trop sélectif. |
| Viser 15–20 % de multi-playlists | Impossible : plancher ~30–35 % | **Le matching par intersection de genre-tags est le vrai problème** (un titre a 4–5 tags → il matche partout). |

**Conclusion : abandonner le matching par genre-tags.** Les genres restent un *signal* donné au LLM, plus une *règle* de matching.

## 2. Principe V1

Deux étapes, toutes deux faites par le LLM, sur la même représentation :

```
           ┌──────────────── fiche titre ────────────────┐
           │ titre · artiste · année · genres · audio    │
           │ (energy, danceability, valence, acoustic.)  │
           └─────────────────────────────────────────────┘
                     │                          │
       (une fois)    ▼                          ▼   (chaque jour)
   ANALYSE : toute la biblio          RANGEMENT : nouveaux likes
   → ~10 « fiches playlist »          → pour chaque titre : 0..n playlists
                                        + confiance par playlist
```

### 2.1 La fiche playlist (sortie de l'analyse)

Une playlist n'est plus une liste de genres, c'est **une description riche que le LLM relit à chaque tri** :

- `nom` — court, évocateur (« Soirée potes », « Dimanche lent »)
- `pitch` — une phrase pour l'humain
- `brief` — 3–5 lignes pour le LLM : scène(s), énergie, ambiance, moment d'écoute, ce qui est **dedans** et ce qui est **à la frontière/dehors**
- `exemples` — 5–8 titres de la biblio qui l'incarnent (ancres)
- `axe` — genre / ambiance / moment (pour garantir un mix)

### 2.2 Analyse (onboarding)

- Corpus : **les likes des 2 dernières années** (reflète le goût actuel, pas l'historique complet). Si trop gros pour un appel : échantillon stratifié (genre/époque/artiste) + statistiques globales.
- Consigne : **nombre de playlists libre**, dicté par la taille du corpus et le nombre de « directions » réelles de la biblio (garde-fous indicatifs : rarement < 5, rarement > 15). **Mix d'axes** (scènes, ambiances/énergies, moments). Chaque titre doit avoir au moins une maison.
- Modèle : le plus capable (appel unique, rare, qualité > coût).
- Vérification : on range l'échantillon avec les fiches → couverture et taux de multi affichés en interne. Si couverture < 85 %, on relance avec les orphelins (« compléter », déjà prototypé en V0).

### 2.3 Rangement (quotidien + bouton)

- Entrée : nouveaux likes + toutes les fiches playlist.
- Sortie par titre : `[{playlist, confiance}]` (**3 playlists max**) + une raison courte.
- Règle :
  - confiance ≥ seuil haut → ajouté directement ;
  - entre les deux → « À trier » avec suggestion pré-cochée ;
  - rien au-dessus du seuil bas → playlist « Divers ».
- Modèle : rapide/économique, batchs petits (5–10), concurrence limitée, retry en coupant le batch.

### 2.4 L'IA apprend de mes corrections

Quand je corrige dans « À trier », le titre rejoint les `exemples` de la playlist (ancres vivantes). Pas de ré-entraînement, juste un contexte qui s'enrichit. Les fiches restent lisibles et modifiables.

## 3. Ce qu'on garde / jette du code V0

- **Garder (à réécrire proprement)** : enrichissement (Spotify + Last.fm/MusicBrainz pour genres, ReccoBeats pour audio features, Deezer pour preview/ISRC), batching LLM robuste, écriture batch dans Spotify.
- **Jeter** : level1-rules, level2-cluster/centroïdes, `genres_include/exclude`, benchmark A/B, personas, BYOK, onboarding multi-chemins.

## 4. Questions ouvertes

- ❓ Seuils de confiance : à calibrer sur ta vraie biblio — idéalement 50 titres labellisés une fois à la main (vérité terrain).
- ✅ Nombre de playlists : libre, selon la taille et les directions de la biblio.
- ✅ Max 3 playlists par titre.
- ✅ Corpus d'analyse : likes des 2 dernières années.
