-- Activate RLS on tables created after 20260526_enable_rls.sql.
-- The app uses service_role exclusively (bypasses RLS).
-- Zero-policy + RLS = deny all for anon/authenticated roles.
ALTER TABLE benchmark_snapshot  ENABLE ROW LEVEL SECURITY;
ALTER TABLE benchmark_labels    ENABLE ROW LEVEL SECURITY;
ALTER TABLE invite_codes        ENABLE ROW LEVEL SECURITY;
ALTER TABLE pending_auth        ENABLE ROW LEVEL SECURITY;
