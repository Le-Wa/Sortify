# Sortify — Design System

## Palette

Registre **product** (l'UI sert la fonctionnalité). Stratégie couleur **Restrained with one committed accent** : neutrals chauds + terra comme seul accent primaire, sage et amber en secondaires sémantiques.

| Token | Valeur | Rôle |
|---|---|---|
| `--bg` | `#131110` | Page background — brun très sombre, pas noir pur |
| `--surface` | `#1c1917` | Cards, sidebar, modals |
| `--surface2` | `#242018` | Input backgrounds, hovers |
| `--surface3` | `#2c2820` | Dropdowns, toasts |
| `--ink` | `#f4ead8` | Texte principal — blanc cassé chaud |
| `--ink-mid` | `#b0a28a` | Texte secondaire, labels |
| `--ink-dim` | `#9a8a72` | Métadonnées, placeholders |
| `--ink-dimmer` | `#4e4036` | Désactivé, dividers |
| `--terra` | `#c87a52` | Accent primaire — terra cotta |
| `--sage` | `#6a9070` | Sémantique positif / synced |
| `--amber` | `#c89840` | Sémantique moyen / en attente |

Tous les neutres sont tintés chaud (hint doré/brun) — aucun gris pur. Le fond ne part jamais vers `#000`, les textes jamais vers `#fff`.

---

## Typographie

### Polices

**Fraunces** (serif, variable) — display, titres de page, noms de playlists, scores Fraunces est une serif optique à axe optique variable, avec des ligatures expressives en italique. Elle donne du caractère sans être décorative.

**Geist Sans** (sans-serif, variable) — corps de texte, UI, boutons, labels. Variable font — supporte des weights intermédiaires (420, 450, etc.).

**Geist Mono** — code uniquement (`<pre>`, règles JSON).

### Échelle et weights

| Rôle | Police | Taille | Weight | Lettre-espacement |
|---|---|---|---|---|
| H1 page | Fraunces | 38–42px | **700** | −0.6 à −0.7px |
| H1 detail (playlist) | Fraunces | 42px | **700** | −0.7px |
| H2 modal | Fraunces | 20px | **700** | −0.3px |
| Section title | Fraunces | 18px | **700** | −0.4px |
| Nom playlist (row) | Fraunces | 15px | **700** | — |
| Stat number | Fraunces | 18–22px | **600** | — |
| Corps | Geist Sans | 14px | **420** | — |
| Label | Geist Sans | 13px | 420 | — |
| Meta / badge | Geist Sans | 12px | 500 | — |
| Micro | Geist Sans | 10–11px | 500 | +0.05–0.08em |

**Règle de hiérarchie** : ratio minimum 1.4× entre les paliers display → titre → corps. Le weight saute au minimum de 200 entre corps et heading (420 → 700).

**Pourquoi 420 pour le corps** : Geist est une variable font, 420 donne un trait légèrement plus épais que le traditionnel 400 — plus lisible sur fond sombre sans aller vers le "bold" qui alourdirait le contraste avec les headings.

### Italic de Fraunces

Utilisé exclusivement en italique pour les moments éditoriaux dans les H1 :
- `<em style={{ color: "var(--terra)" }}>playlists</em>` — le mot clé de la page
- `<em style={{ color: "var(--sage)" }}>trié</em>` — état positif

L'italic Fraunces a une forme très distincte, presque calligraphique. Ne jamais l'utiliser pour de longues phrases.

---

## Espacement (Negative Space)

Philosophie : **rythme, pas uniformité**. Les marges varient délibérément pour créer de la hiérarchie spatiale.

| Zone | Valeur | Raison |
|---|---|---|
| Page padding desktop | `36px 36px 60px` | Respiration généreuse, safe zone bottom pour mobile nav |
| Page padding mobile | `20px 16px 80px` | Compact mais pas étouffant |
| Espacement entre rows | `6px` | Dense mais lisible — c'est une liste, pas des cards |
| Espacement section | `28–36px margin-top` | Sépare clairement les blocs sémantiques |
| Padding card | `16–22px` | Confort intérieur proportionnel à la taille de la card |
| Padding modal | `28px` | Généreux — contexte de focus |
| Gap nav items | `2px` | Items proches = groupe cohérent |
| Gap boutons | `8px` | Actions proches mais distincts |

**Border-radius** : 8px (inputs, petits éléments), 12px (rows), 14px (cards inbox), 16px (cards playlists), 20px (bottom sheet top). Progression logarithmique : les conteneurs plus grands ont des coins plus ronds.

---

## Animations

Principe : **réponse physique, pas décoration**. Chaque animation répond à une action utilisateur ou confirme un état.

### Timings

| Type | Durée | Easing |
|---|---|---|
| Press (`:active`) | 60ms | Linear / très rapide |
| Hover enter | 100–120ms | `cubic-bezier(0.16, 1, 0.3, 1)` — ease out expo |
| Hover exit | 150ms | Même easing |
| Modal enter | 220ms | `cubic-bezier(0.16, 1, 0.3, 1)` |
| Bottom sheet | 220ms | `cubic-bezier(0.32, 0.72, 0, 1)` |
| Toast | 220ms | `cubic-bezier(0.16, 1, 0.3, 1)` |

**Pourquoi ease-out-expo** : la sortie exponentielle donne une sensation de "snap" — l'élément arrive vite et s'arrête net, sans rebond. C'est le curve qui donne le feeling "snappy" sans bounce.

### Catalogue

| Élément | Animation | Valeur |
|---|---|---|
| `.s-btn:active` | Scale press | `scale(0.96)`, 60ms |
| `.s-chip:active` | Scale press | `scale(0.95)`, 60ms |
| `.s-nav-item:active` | Scale micro | `scale(0.98)`, 100ms |
| `.s-card:hover` | Lift | `translateY(-1px)` |
| `.s-pl-card:hover` | Lift | `translateY(-2px)` (cards plus grandes = mouvement légèrement plus perceptible) |
| `.s-pl-row:hover` | Lift | `translateY(-1px)` |
| `.s-inbox-row:hover` | Lift | `translateY(-1px)` |
| `.s-modal` | Scale + fade in | `scale(0.96) → scale(1)` + `opacity 0 → 1` |
| `.s-toast` | Slide up | `translateY(10px) → translateY(0)` + `opacity` |
| `.s-bs` (bottom sheet) | Slide up | `translateY(100%) → 0` |
| `.s-bs-backdrop` | Fade | `opacity 0 → 1` |

### Ce qui n'est PAS animé

- Les propriétés de layout (`height`, `width`, `padding`, `margin`) — trop coûteux, jank
- Les changements de texte (états de chargement)
- Tout ce qui serait animé en continu sans interaction utilisateur

---

## Composants

### Boutons

Trois niveaux sémantiques :

| Classe | Usage | Couleur |
|---|---|---|
| `.s-btn` | Action neutre | Ink-mid sur transparent |
| `.s-btn.s-btn-primary` | Action principale | Terra tint + terra hover |
| `.s-btn.s-btn-danger` | Action destructive | Terra border, no fill |

Taille standard `8px 16px`, small `5px 10px`. Font-weight **600** partout — les boutons doivent être lisibles comme des labels d'action.

### Cards

Deux types :
- **Inline row** (`.s-pl-row`) — liste dense, padding compact `11px 14px`, border-radius 12px, hover lift 1px
- **Grid card** (`.s-pl-card`) — affichage grille, padding généreux `18px 20px`, border-radius 16px, hover lift 2px

Les cards ne portent pas de couleur de fond forte — leur tint vient du swatch de playlist (très subtil, `rgba(couleur, 0.03–0.12)`).

### Filter chips

`.s-chip` — pill shape (border-radius 20px), état `active` : terra-light bg + terra color + fw 600. Press scale `0.95`.

### Bottom sheet

Entrypoint d'action mobile universel. Slide-up `220ms`, handle `36×4px`. Items `min-height: 48px` (touch target). Jamais de modal plein écran sur mobile.

### Toast

Slide-up depuis le bas, position `fixed bottom: 24px center`. Disparaît après 3–4s, no interaction (pointer-events: none). Font-weight 500 pour lisibilité.

---

## Swatch système (couleurs de playlist)

8 couleurs dans `lib/playlist-swatch.ts`. Couleur custom (stockée DB) prioritaire, hash fallback sur l'ID. Utilisées sur :
- Barre top fine (3px) des cards grille
- Point de couleur 8px dans les rows
- Stat count en couleur swatch
- Date "Appris le" en couleur swatch (opacity 0.85)

Le swatch est la seule couleur "libre" du système — tout le reste suit la palette token.

---

## Principes UX retenus

1. **Mobile-first** — zones tactiles min 44px, bottom sheet > modal sur mobile, FAB pour la création
2. **Pas de side-stripe** — `border-left` coloré interdit. Tint de fond + barre top
3. **DnD desktop seulement** — `pointer: coarse` désactive le drag, remplacé par les boutons ↑↓ du bottom sheet
4. **Réponse physique** — chaque interaction a une animation < 100ms visible, pas juste un changement d'état
5. **Hiérarchie par weight** — pas par taille seule. Un élément peut être plus petit mais plus lourd qu'un autre pour indiquer son importance
