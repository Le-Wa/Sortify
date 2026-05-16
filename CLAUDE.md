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

## Priorités V1
1. Auth Spotify fonctionnelle (NextAuth + stockage tokens en DB)
2. Schéma Supabase + migrations
3. Moteur de classification 3 niveaux
4. Cron hebdomadaire