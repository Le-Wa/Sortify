# Migrations de la V1 (archivées)

Migrations de la V1 de Sortify (mai–juin 2026), figée au tag `legacy-v1`. Elles ont été appliquées à l'ancienne base ;
la V2 n'en dépend pas et ne les rejoue jamais. Les tables V1 (`users`, `tracks`, `playlists`…) restent en place, inutilisées.

Les migrations de la V2 sont dans `supabase/migrations/`, appliquées à la main :
`psql "$POSTGRES_URL_NON_POOLING" -f supabase/migrations/<fichier>.sql`.
