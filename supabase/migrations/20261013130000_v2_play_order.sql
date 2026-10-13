-- Ordre d'une playlist de bac (13/10/2026) : « recents » (nouveaux titres en haut, par défaut) ou « dj » (tempo, tonalité, énergie).
alter table bacs add column if not exists play_order text not null default 'recents' check (play_order in ('recents', 'dj'));
