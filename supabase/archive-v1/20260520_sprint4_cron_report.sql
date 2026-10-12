-- Sprint 4 — cron run report stored per user
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_cron_report JSONB;
