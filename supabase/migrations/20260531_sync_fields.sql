ALTER TABLE tracks
  ADD COLUMN IF NOT EXISTS is_liked                   BOOLEAN  NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS manually_assigned          BOOLEAN  NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS manually_removed_playlists UUID[]   NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS classification_source      TEXT;

-- Appends a playlist ID to manually_removed_playlists (no duplicates) and clears assigned_playlist.
CREATE OR REPLACE FUNCTION mark_manually_removed_from_playlist(
  p_track_ids UUID[],
  p_playlist_id UUID
) RETURNS void LANGUAGE sql AS $$
  UPDATE tracks
  SET
    assigned_playlist             = NULL,
    manually_removed_playlists    = array_append(
                                      manually_removed_playlists,
                                      p_playlist_id
                                    )
  WHERE id = ANY(p_track_ids)
    AND NOT (manually_removed_playlists @> ARRAY[p_playlist_id]);
$$;
