-- Consommation de l'IA : un enregistrement par appel (tokens et coût estimé au tarif public).
create table if not exists ai_usage (
  id                 bigint generated always as identity primary key,
  member_id          text references members(spotify_id) on delete set null,
  scope              text not null,   -- tâche : analyse, tri, bac, action…
  step               text not null,   -- appel : « Rangement », « Analyse de la bibliothèque »…
  model              text not null,
  input_tokens       integer not null default 0,
  cache_write_tokens integer not null default 0,
  cache_read_tokens  integer not null default 0,
  output_tokens      integer not null default 0,
  cost_usd           numeric(10, 5) not null default 0,
  created_at         timestamptz not null default now()
);
create index if not exists ai_usage_member on ai_usage (member_id, created_at desc);
alter table ai_usage enable row level security;
