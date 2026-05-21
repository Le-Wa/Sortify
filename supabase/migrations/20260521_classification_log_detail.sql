-- Détail par playlist pour les logs L3 : [{id, name, confidence}]
ALTER TABLE classification_log ADD COLUMN IF NOT EXISTS playlists_detail jsonb;
