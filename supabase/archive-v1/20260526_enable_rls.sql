-- Enable RLS on all tables.
-- The app uses service_role key exclusively (bypasses RLS), so existing API routes
-- are unaffected. RLS blocks any direct anon-key access (dashboard, external tools).
ALTER TABLE users            ENABLE ROW LEVEL SECURITY;
ALTER TABLE tracks           ENABLE ROW LEVEL SECURITY;
ALTER TABLE playlists        ENABLE ROW LEVEL SECURITY;
ALTER TABLE classification_log ENABLE ROW LEVEL SECURITY;

-- No policies needed: zero-policy + RLS = deny all for anon/authenticated roles.
-- service_role always bypasses RLS.
