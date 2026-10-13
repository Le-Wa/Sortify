-- Bacs des potes (13/10/2026) : rien n'est visible sans l'accord du membre (share_bacs), bac par bac (bacs.shared).
alter table members add column if not exists share_bacs boolean not null default false;
alter table members add column if not exists reco_playlist_id text; -- playlist « Reco des potes » dans son Spotify
alter table bacs add column if not exists shared boolean not null default true;

-- Bac commun entre deux potes : proposé par l'un (a), accepté par l'autre (b) ; la playlist vit chez a.
create table if not exists common_bacs (
  id          uuid primary key default gen_random_uuid(),
  member_a    text not null references members (spotify_id) on delete cascade,
  member_b    text not null references members (spotify_id) on delete cascade,
  status      text not null default 'pending' check (status in ('pending', 'active', 'refused')),
  playlist_id text,
  tracks      integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists common_bacs_members on common_bacs (member_a, member_b);
alter table common_bacs enable row level security;
