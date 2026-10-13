-- Avis de l'IA gardé pour les titres partis dans Divers (analyse initiale : meilleur bac sous 0,6).
-- Sert au rangement de Divers (swipe, suggestions) sans redemander à l'IA. Décision de Walid, 13/10/2026.
create table if not exists divers_hints (
  member_id   text not null,
  track_id    text not null,
  suggestions jsonb not null,           -- [{ "bac_id": uuid, "confidence": 0..1 }], du plus sûr au moins sûr
  reason      text,
  created_at  timestamptz not null default now(),
  primary key (member_id, track_id),
  foreign key (member_id, track_id) references likes (member_id, track_id) on delete cascade
);
alter table divers_hints enable row level security;
