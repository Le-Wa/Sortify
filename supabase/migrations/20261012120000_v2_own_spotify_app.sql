-- Onboarding « power user » : app Spotify personnelle (client id + secret chiffré). Ces membres ne comptent pas
-- dans la limite de 25 comptes du mode développement de l'app Spotify de Sortify.
alter table members add column if not exists spotify_client_id text;
alter table members add column if not exists spotify_client_secret_enc text;
