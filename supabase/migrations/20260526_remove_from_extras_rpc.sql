CREATE OR REPLACE FUNCTION remove_playlist_from_extras(p_playlist_id uuid, p_user_id uuid)
RETURNS void LANGUAGE sql AS $$
  UPDATE tracks
  SET extra_playlists = array_remove(extra_playlists, p_playlist_id)
  WHERE user_id = p_user_id AND p_playlist_id = ANY(extra_playlists);
$$;
