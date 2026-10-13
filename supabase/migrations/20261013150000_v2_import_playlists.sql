-- Import des playlists à l'onboarding (13/10/2026) : copie Sortify d'une playlist choisie, découpage d'une playlist trop large.
alter table bacs add column if not exists from_playlist text;               -- nom de la playlist d'origine (étiquette « ta playlist »)
alter table members add column if not exists playlists_done_at timestamptz; -- étape « Tes playlists » passée
alter table members add column if not exists playlist_choices jsonb;         -- [{ id, name, mode: bac|split|indice }]
