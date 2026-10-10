-- Sortify V2 — schéma de base.
-- Nouvelles tables uniquement : les tables V1 (users, tracks, playlists…) ne sont pas touchées.

create table if not exists members (
  spotify_id      text primary key,
  display_name    text,
  email           text,
  access_token    text not null,
  refresh_token   text not null,
  expires_at      bigint not null,
  is_owner        boolean not null default false,
  sort_hour       smallint not null default 8 check (sort_hour between 0 and 23),
  sort_paused     boolean not null default false,
  suggest_bacs    boolean not null default true,
  last_sorted_at  timestamptz,
  created_at      timestamptz not null default now()
);

create table if not exists invitations (
  code        text primary key,
  created_by  text not null references members(spotify_id) on delete cascade,
  used_by     text references members(spotify_id) on delete set null,
  used_at     timestamptz,
  created_at  timestamptz not null default now()
);

create table if not exists likes (
  member_id     text not null references members(spotify_id) on delete cascade,
  track_id      text not null,
  title         text not null,
  artists       text[] not null,
  album         text,
  cover_url     text,
  isrc          text,
  released_year smallint,
  liked_at      timestamptz not null,
  genres        text[] not null default '{}',
  audio         jsonb,
  enriched_at   timestamptz,
  primary key (member_id, track_id)
);
create index if not exists likes_member_liked_at on likes (member_id, liked_at desc);

create table if not exists bacs (
  id                  uuid primary key default gen_random_uuid(),
  member_id           text not null references members(spotify_id) on delete cascade,
  name                text not null,
  sleeve_name         text,
  pitch               text not null,
  brief               text not null,
  axis                text not null check (axis in ('scène', 'ambiance', 'moment')),
  color               text not null,
  position            integer not null default 0,
  status              text not null default 'proposed' check (status in ('proposed', 'active', 'removed')),
  auto_fill           boolean not null default true,
  spotify_playlist_id text,
  is_divers           boolean not null default false,
  created_at          timestamptz not null default now()
);
create index if not exists bacs_member on bacs (member_id, position);
create unique index if not exists bacs_one_divers on bacs (member_id) where is_divers;

create table if not exists bac_examples (
  bac_id    uuid not null references bacs(id) on delete cascade,
  member_id text not null,
  track_id  text not null,
  polarity  text not null default 'positive' check (polarity in ('positive', 'negative')),
  added_at  timestamptz not null default now(),
  primary key (bac_id, track_id),
  foreign key (member_id, track_id) references likes(member_id, track_id) on delete cascade
);

create table if not exists placements (
  bac_id      uuid not null references bacs(id) on delete cascade,
  member_id   text not null,
  track_id    text not null,
  confidence  real,
  source      text not null check (source in ('ia', 'correction', 'manuel')),
  placed_at   timestamptz not null default now(),
  synced_at   timestamptz,
  primary key (bac_id, track_id),
  foreign key (member_id, track_id) references likes(member_id, track_id) on delete cascade
);
create index if not exists placements_member_recent on placements (member_id, placed_at desc);

create table if not exists pending (
  member_id    text not null,
  track_id     text not null,
  suggestions  jsonb not null,
  reason       text,
  created_at   timestamptz not null default now(),
  primary key (member_id, track_id),
  foreign key (member_id, track_id) references likes(member_id, track_id) on delete cascade
);

create table if not exists jobs (
  id          uuid primary key default gen_random_uuid(),
  member_id   text not null references members(spotify_id) on delete cascade,
  kind        text not null check (kind in ('import', 'analyse', 'creation', 'tri')),
  status      text not null default 'running' check (status in ('running', 'done', 'failed')),
  progress    jsonb not null default '{}',
  error       text,
  started_at  timestamptz not null default now(),
  finished_at timestamptz
);
create index if not exists jobs_member_recent on jobs (member_id, started_at desc);

-- Accès uniquement via la service role côté serveur.
alter table members      enable row level security;
alter table invitations  enable row level security;
alter table likes        enable row level security;
alter table bacs         enable row level security;
alter table bac_examples enable row level security;
alter table placements   enable row level security;
alter table pending      enable row level security;
alter table jobs         enable row level security;
