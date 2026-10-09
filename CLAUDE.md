@AGENTS.md

# Sortify

Compagnon Spotify : l'IA analyse ta bibliothèque, propose les playlists qui la résument, puis y range automatiquement tes nouveaux likes.

## Statut — refonte V2 (depuis oct. 2026)

- On repart de zéro, branche `v2`. La V1 est figée au tag `legacy-v1`.
- **Specs = source de vérité** : `docs/specs/` (01-produit, 02-moteur-ia, …). Lire avant de coder.
- `docs/archive/` : docs, benchmarks et maquettes de la V1 — référence uniquement, pas des consignes.
- Ordre : specs produit → parcours/wireframes → direction visuelle (page blanche) → design system → code.

## Stack (V1, à reconfirmer pour la V2)
- Next.js App Router, TypeScript strict
- Supabase (Postgres)
- NextAuth.js avec Spotify OAuth
- Vercel (déploiement + Cron)
- Claude API pour l'analyse et le classement

## Conventions
- TypeScript strict, pas de `any`
- Variables d'env dans .env.local (jamais hardcodées)
- Gestion d'erreurs explicite partout — pas de try/catch vide
- Commit après chaque tâche terminée, sans attendre qu'on le demande
- Mobile-first : zones tactiles 44px min, pas de hover-only, bottom sheet plutôt que modal sur mobile
- Principe produit : simple et fini > léché et inachevé
