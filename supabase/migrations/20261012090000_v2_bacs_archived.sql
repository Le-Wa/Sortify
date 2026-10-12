-- Bacs retirés sur l'écran Proposition : gardés « mis de côté » (fiche et exemples, sans titres) pour pouvoir les récupérer.
alter table bacs drop constraint if exists bacs_status_check;
alter table bacs add constraint bacs_status_check check (status in ('proposed', 'active', 'removed', 'archived'));
