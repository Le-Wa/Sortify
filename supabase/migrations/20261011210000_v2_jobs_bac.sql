-- Job « bac » : création d'un nouveau bac depuis la page Bacs (fiche IA, recherche des titres, playlist).
alter table jobs drop constraint if exists jobs_kind_check;
alter table jobs add constraint jobs_kind_check check (kind in ('import', 'analyse', 'creation', 'tri', 'reanalyse', 'bac'));
