ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS import_since INTEGER; -- months back, null = all time

-- Backfill: existing users who already have playlists are already set up
UPDATE users
SET onboarding_completed = true
WHERE id IN (SELECT DISTINCT user_id FROM playlists);
