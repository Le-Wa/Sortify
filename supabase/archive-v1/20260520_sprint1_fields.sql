-- Sprint 1 — Dashboard + Import fields
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_sync_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS cron_enabled BOOLEAN DEFAULT false;

-- enriched_at permet de filtrer les tracks prêtes à classifier
ALTER TABLE tracks ADD COLUMN IF NOT EXISTS enriched_at TIMESTAMPTZ;
