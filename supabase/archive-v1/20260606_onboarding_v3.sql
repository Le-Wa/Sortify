ALTER TABLE users
  ADD COLUMN IF NOT EXISTS proposal_ready    BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS onboarding_config JSONB;

-- Reset stale mode values from v2 (import/analyse/scratch → null)
UPDATE users
SET onboarding_mode = null
WHERE onboarding_mode IN ('import', 'analyse', 'scratch');
