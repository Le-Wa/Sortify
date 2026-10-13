-- « Ranger mes anciens likes » (13/10/2026) : les likes plus anciens que la fenêtre d'import (1 000 derniers),
-- importés à la demande. Un membre sur la clé de Sortify demande, le propriétaire valide.
alter table likes add column if not exists backfilled_at timestamptz; -- posé pendant le job « anciens », effacé à la fin

alter table jobs drop constraint if exists jobs_kind_check;
alter table jobs add constraint jobs_kind_check
  check (kind = any (array['import', 'analyse', 'creation', 'tri', 'reanalyse', 'bac', 'anciens']));

create table if not exists old_likes_requests (
  id          uuid primary key default gen_random_uuid(),
  member_id   text not null references members (spotify_id) on delete cascade,
  estimate    integer not null,          -- likes à ranger, estimés à la demande
  cost_usd    numeric not null,          -- coût de l'IA estimé
  status      text not null default 'pending' check (status in ('pending', 'accepted', 'refused')),
  created_at  timestamptz not null default now(),
  decided_at  timestamptz
);
create index if not exists old_likes_requests_open on old_likes_requests (status, created_at desc);
alter table old_likes_requests enable row level security;
