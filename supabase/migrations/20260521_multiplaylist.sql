-- Multi-playlist : suggestion LLM conservée même en needs_review, playlists additionnelles
ALTER TABLE tracks ADD COLUMN IF NOT EXISTS llm_suggestion uuid REFERENCES playlists(id) ON DELETE SET NULL;
ALTER TABLE tracks ADD COLUMN IF NOT EXISTS extra_playlists uuid[] NOT NULL DEFAULT '{}';
