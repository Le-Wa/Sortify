-- Playlist « Arrivage de la semaine » (dans Spotify) et notifications du lundi.
alter table members add column if not exists arrival_playlist boolean not null default true;
alter table members add column if not exists arrival_playlist_id text;

create table if not exists push_subscriptions (
  endpoint   text primary key,
  member_id  text not null references members(spotify_id) on delete cascade,
  keys       jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists push_subscriptions_member on push_subscriptions (member_id);
alter table push_subscriptions enable row level security;
