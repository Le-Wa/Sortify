-- Suggestions de changements de bacs (spec 02 §2.5), validées une à une sur l'Accueil :
-- nouveau bac (depuis Divers ou ré-analyse), suppression, fusion.
create table if not exists suggestions (
  id          uuid primary key default gen_random_uuid(),
  member_id   text not null references members(spotify_id) on delete cascade,
  kind        text not null check (kind in ('ajouter', 'supprimer', 'fusionner')),
  origin      text not null check (origin in ('divers', 'reanalyse')),
  payload     jsonb not null,
  status      text not null default 'open' check (status in ('open', 'accepted', 'refused')),
  created_at  timestamptz not null default now()
);
create index if not exists suggestions_member_open on suggestions (member_id, status, created_at desc);
alter table suggestions enable row level security;

-- Relancer l'analyse : nouveau type de job.
alter table jobs drop constraint if exists jobs_kind_check;
alter table jobs add constraint jobs_kind_check check (kind in ('import', 'analyse', 'creation', 'tri', 'reanalyse'));
