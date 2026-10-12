-- Stores the last benchmark run results per user (upserted on each run)
CREATE TABLE IF NOT EXISTS benchmark_snapshot (
  user_id   text        PRIMARY KEY,
  ran_at    timestamptz NOT NULL DEFAULT now(),
  results   jsonb       NOT NULL DEFAULT '[]'
);

-- Stores the user's ground-truth corrections for training
CREATE TABLE IF NOT EXISTS benchmark_labels (
  user_id             text        NOT NULL,
  track_id            uuid        NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
  correct_playlist_id uuid        REFERENCES playlists(id) ON DELETE SET NULL,
  notes               text,
  labeled_at          timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, track_id)
);
