-- V2-S2 — Playlists dynamiques
-- IMPORTANT : appliquer cette migration AVANT de déployer le code qui lit
-- playlists.priority comme colonne standalone. Le UPDATE ci-dessous backfille
-- la valeur depuis le JSONB dans la même transaction, donc la colonne est
-- peuplée dès que la migration est appliquée.

ALTER TABLE playlists ADD COLUMN IF NOT EXISTS llm_help_text TEXT;
ALTER TABLE playlists ADD COLUMN IF NOT EXISTS learned_at TIMESTAMPTZ;

-- Extraire priority du JSONB vers une colonne dédiée
ALTER TABLE playlists ADD COLUMN IF NOT EXISTS priority INT NOT NULL DEFAULT 0;
UPDATE playlists SET priority = COALESCE((rules->>'priority')::int, 0);
