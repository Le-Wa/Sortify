-- Sprint 0.5 — champs enrichissement et push Spotify
ALTER TABLE tracks ADD COLUMN IF NOT EXISTS enrichment_source TEXT;
ALTER TABLE tracks ADD COLUMN IF NOT EXISTS pushed_to_spotify TIMESTAMPTZ;
