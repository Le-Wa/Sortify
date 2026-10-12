-- Performance indexes for queue queries (V2-S1)
-- All indexes are scoped by user_id first, matching the query patterns in queries.ts

-- Queue enrichissement : tracks sans enriched_at, par user
CREATE INDEX IF NOT EXISTS idx_tracks_user_enrich_queue
  ON tracks (user_id)
  WHERE enriched_at IS NULL;

-- Queue classification : tracks enrichis mais pas encore classifiés, par user
CREATE INDEX IF NOT EXISTS idx_tracks_user_classify_queue
  ON tracks (user_id)
  WHERE classified_at IS NULL AND enriched_at IS NOT NULL;

-- Inbox : tracks en attente de review, par user
CREATE INDEX IF NOT EXISTS idx_tracks_user_needs_review
  ON tracks (user_id)
  WHERE needs_review = TRUE AND is_archived = FALSE;

-- Classification log : lookup par track_id dans les fonctions d'admin/stats
CREATE INDEX IF NOT EXISTS idx_classification_log_track_id
  ON classification_log (track_id);

-- Lookup classification_log par user + date (admin logs, stats)
CREATE INDEX IF NOT EXISTS idx_classification_log_user_created
  ON classification_log (user_id, created_at DESC);
