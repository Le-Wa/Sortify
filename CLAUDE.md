@AGENTS.md

# Sortify

Compagnon Spotify qui trie automatiquement les liked songs dans des playlists personnalisées.

## Stack
- Next.js 15, App Router, TypeScript strict
- Supabase (Postgres) pour la DB
- NextAuth.js avec Spotify OAuth
- Vercel pour le déploiement + Cron Jobs
- Claude API (claude-sonnet-4-20250514) pour l'arbitrage LLM

## Conventions
- Tous les composants en TypeScript strict, pas de `any`
- Queries Supabase dans lib/supabase/queries.ts uniquement
- Variables d'env dans .env.local (jamais hardcodées)
- Gestion d'erreurs explicite partout — pas de try/catch vide

## Workflow
- Commit après chaque tâche terminée, sans attendre qu'on le demande
- Mobile-first : zones tactiles 44px min, pas de hover-only, bottom sheet plutôt que modal sur mobile
- Design system custom (CSS vars + classes `s-*` dans globals.css) — pas de classes Tailwind utilitaires dans les composants

## Priorités V1
1. Auth Spotify fonctionnelle (NextAuth + stockage tokens en DB)
2. Schéma Supabase + migrations
3. Moteur de classification 3 niveaux
4. Cron hebdomadaire

## Focus actuel — Design & UX

Le moteur tourne. La phase active est le design et l'UX.

### Pages existantes
- `/home` — nouvelle page d'accueil centrée sur les playlists (à comparer avec `/dashboard`)
- `/dashboard` — ancien dashboard avec KPIs, à garder pour comparaison
- `/playlists` — gestion des playlists (reorder, create, toggle)
- `/playlists/[id]` — détail avec actions (learn, décrire, sync, toggle, recompute)
- `/inbox` — review des tracks un par un
- `/archive` — tracks archivés
- `/admin/logs` — logs de classification

### Design system
- Tokens dans `:root` de `globals.css` — modifier là en priorité
- Classes utilitaires : `s-page`, `s-btn`, `s-btn-sm`, `s-card`, `s-section-title`, etc.
- Palette swatch playlists : 8 couleurs, assignées par hash de l'ID
- Genre tags : 24 couleurs, assignées par hash du nom de genre
- Bottom sheet (`s-bs-*`) : pattern mobile pour toutes les actions secondaires

### Branches design actives
- `design/variant-warm` — palette plus chaude, touches subtiles
- `design/impeccable-warm` — version bolder, terra dominant, h1 44px

### Principes UX retenus
- Mobile-first, bottom sheet pour les actions secondaires (pas de hover-only)
- Pas de side-stripe (`border-left` coloré) — utiliser tint de fond + border colorée
- Swatch couleur : sur la barre top des cards, le compteur de tracks, la date "Appris le"
- Titre de page en blanc (`var(--ink)`), barre courte swatch au-dessus
- Breadcrumbs en `var(--ink-dim)` neutre