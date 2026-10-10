-- Jobs de fond : un seul worker à la fois (bail), et battement de cœur pour repérer un job bloqué.
alter table jobs add column if not exists lease_until timestamptz;
alter table jobs add column if not exists updated_at timestamptz not null default now();
create unique index if not exists jobs_one_running on jobs (member_id, kind) where status = 'running';

-- Tags Last.fm par artiste, partagés entre membres (un artiste revient souvent).
create table if not exists artist_tags (
  artist     text primary key,
  tags       text[] not null,
  fetched_at timestamptz not null default now()
);
alter table artist_tags enable row level security;
