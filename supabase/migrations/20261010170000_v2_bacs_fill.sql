-- Proposition : un bac retouché (« autre idée », bac sur mesure) doit être re-rempli par l'IA.
alter table bacs add column if not exists needs_fill boolean not null default false;
-- Création : la pochette Sortify a été envoyée à Spotify.
alter table bacs add column if not exists cover_uploaded_at timestamptz;
