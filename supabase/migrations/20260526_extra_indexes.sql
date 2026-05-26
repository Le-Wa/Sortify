-- Lookup playlists par user + assigned (getPlaylistTracksAssigned, getPlaylistsStats)
CREATE INDEX IF NOT EXISTS idx_tracks_user_assigned
  ON tracks (user_id, assigned_playlist)
  WHERE is_archived = false;

-- GIN sur extra_playlists pour les .contains et .cs.{...}
CREATE INDEX IF NOT EXISTS idx_tracks_extra_playlists_gin
  ON tracks USING gin (extra_playlists);

-- Archive view
CREATE INDEX IF NOT EXISTS idx_tracks_user_archived
  ON tracks (user_id, is_archived);
