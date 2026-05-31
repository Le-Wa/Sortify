ALTER TABLE users
  ADD COLUMN IF NOT EXISTS onboarding_status        TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS onboarding_mode          TEXT,
  ADD COLUMN IF NOT EXISTS onboarding_step          INT  NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS invited_by               UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS spotify_client_id        TEXT,
  ADD COLUMN IF NOT EXISTS spotify_client_secret_enc TEXT;

-- Migrate users who completed onboarding v1
UPDATE users SET onboarding_status = 'complete' WHERE onboarding_completed = true;
