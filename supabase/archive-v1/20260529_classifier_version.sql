-- Track which classifier version produced each log entry for A/B comparison
ALTER TABLE classification_log
  ADD COLUMN IF NOT EXISTS classifier_version text NOT NULL DEFAULT 'v1';

CREATE INDEX IF NOT EXISTS classification_log_classifier_version_idx
  ON classification_log (classifier_version);
