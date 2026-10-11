-- Forme pleine ou en contour, choisie par la personne ; null = selon l'axe (pleine pour une scène).
alter table bacs add column if not exists outline boolean;
