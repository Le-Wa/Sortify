-- Replace single correct_playlist_id with an array to support multi-playlist labels
ALTER TABLE benchmark_labels DROP COLUMN IF EXISTS correct_playlist_id;
ALTER TABLE benchmark_labels ADD COLUMN IF NOT EXISTS correct_playlist_ids uuid[] NOT NULL DEFAULT '{}';
