# Benchmark — Prompt de taxonomie (2026-06-07)

## Contexte

Optimisation du prompt de `/api/onboarding/propose-taxonomy`.  
Dataset : 200 tracks enrichies, user `d5733351` (dev persona, bibliothèque diverse).  
Métrique principale : **couverture** (% de tracks matchant au moins une playlist) + **multi-assignment** (% de tracks dans 2+ playlists).

---

## Prompt prod actuel (baseline)

```
Tu es un expert en organisation musicale. Voici un échantillon de N tracks...
Propose exactement ${targetCount} playlists...
genres_include : liste de genres musicaux cibles (3-8 genres)
```

**Performance : 56% couverture**

Problème : le LLM invente des genres (`indie soul`, `bass house`) qui n'existent pas dans la DB → pas de match.

---

## Découverte clé : catalogue de genres

Donner au LLM la liste des genres réellement présents en DB (avec fréquences) et lui demander d'utiliser **exclusivement** ces genres dans `genres_include`.

```
CATALOGUE DE GENRES (présents dans la bibliothèque) :
electronic (50), house (39), pop (23), dance (23), techno (19)...
```

Résultat : passe de 56% → 70-83% de couverture.

---

## Résultats par approche

### Benchmark 1 — 8 variantes (genre / vibe / hybride)

| Variante | Couverture | Multi-assigned |
|----------|-----------|----------------|
| Hybrid-v4 (two-pass thinking) | 83% | 140 |
| Hybrid-v1 (actuel) | 79% | 82 |
| Hybrid-v3 (axes orthogonaux) | 79% | 86 |
| Hybrid-v2 (multi explicite) | 78% | 83 |
| Energy-based | 70% | 76 |
| Mood-based | 70% | 85 |
| Listening-moment | 70% | 140 |

### Benchmark 2 — Vibe / couleur / hybride

| Variante | Couverture | Multi | Playlists |
|----------|-----------|-------|-----------|
| Couleur / température | 83% | 157 | 12 (trop) |
| Vibe / énergie | 80% | 136 | 6 |
| V3 baseline | 78% | 106 | 6 |
| Hybride genre + vibe | 77% | 122 | 7 |

### Benchmark 3 — Spectre 1→10 (genre pur → vibe pur), 8 playlists

| Niveau | Couverture | Multi | Description |
|--------|-----------|-------|-------------|
| 5 (équilibré) | **83%** | 139 | genre + mood combinés — **meilleur** |
| 1 (genre pur) | 81% | 131 | familles strictes, genres exhaustifs |
| Hybride 8 | 80% | 144 | meilleur multi-assignment |
| 3 (genre+) | 78% | 91 | genre trop étroit |
| 7 (vibe+) | 74% | 121 | LLM trop sélectif |
| 10 (vibe pur) | ✗ | — | réponse tronquée |

La courbe est en cloche : le pic est au niveau 5.

### Benchmark 4 — Prompts "serrés" (cible 15-20% multi)

| Variante | Couverture | Multi% | Dist. seuls/deux/3+ |
|----------|-----------|--------|---------------------|
| Maison principale | 82% | 53% | 59 / 60 / 45 |
| Partition + ponts | 80% | 51% | 58 / 58 / 44 |
| Exclusif par défaut | 79% | **46%** | 67 / 75 / 16 |

---

## Contrainte structurelle découverte

**15-20% multi-assignment n'est pas atteignable avec le matching genre actuel.**

Raison : chaque track a plusieurs genre-tags simultanément en DB (ex: `["soul", "rnb", "hip-hop", "british"]`). Même avec des playlists aux périmètres exclusifs, le matching par intersection produit mécaniquement du multi-assignment élevé.

**Plancher réaliste : ~30-35% multi** avec un prompt très serré.

### Deux pistes pour atteindre 15-20%

**Option A — Modifier la règle de matching dans le classifier**  
Passer de "matche si AU MOINS UN genre en commun" à "matche si le genre PRINCIPAL est dans la playlist".  
→ Implique de modifier le classifier, pas le prompt.

**Option B — Accepter ~30-35% comme plancher**  
Le prompt "exclusif par défaut" (46% multi, seulement 16 tracks dans 3+) est déjà une organisation propre qui reflète la réalité de la bibliothèque.

---

## Prompts candidats

### Spectre niveau 5 — meilleure couverture (83%)

```
Organise en 8 playlists en équilibrant genre ET vibe. Chaque playlist a une identité
de scène musicale ET un mood qui la colore (ex: "Soul nocturne", "Électro solaire",
"Rap introspectif"). genres_include = tous les genres du catalogue qui correspondent
à cette combinaison scène + mood.
```

Playlists produites : Soul nocturne, Électro solaire, Techno souterrain, Rap introspectif, Pop indie lumineuse, World électrique, Électro club driving, Nuit alternative.

### Exclusif par défaut — moins de multi (46%)

```
Règles :
- Chaque genre appartient à sa playlist naturelle. Si tu hésites entre deux, choisis
  celle où il est le plus représentatif.
- Chevauchements SEULEMENT pour les genres hybrides musicaux reconnus.
- genres_exclude : utilise-les activement pour délimiter les frontières.
Résultat : 80% des tracks dans une et une seule playlist.
```

### Hybrid-v3 — axes orthogonaux (79%, 86 multi)

```
Propose entre 3 et 6 playlists en combinant deux axes :
1. Scène musicale : électro, rap, soul, monde, rock
2. Énergie/mood : chillout, peak-hour, feel-good, sombre
Les playlists peuvent croiser les deux axes.
Pour les playlists mood/énergie : inclus tous les genres compatibles.
```

---

## Fichiers créés

- `scripts/optimize-taxonomy-prompt.ts` — script de benchmark réutilisable
  - `--user-id` : UUID Supabase
  - `--sample N` : nombre de tracks
  - `--segmentation fine|medium|coarse`
  - `--variants N`

---

## TODO

- [ ] Choisir entre Spectre 5 (couverture max) ou Exclusif (multi propre)
- [ ] Si Option A retenue : modifier le classifier pour utiliser le genre principal
- [ ] Intégrer le prompt gagnant dans `lib/onboarding/prompts/taxonomy.ts`
- [ ] Mettre à jour `propose-taxonomy/route.ts` pour passer le catalogue de genres au LLM
