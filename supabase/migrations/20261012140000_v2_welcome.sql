-- Carte de bienvenue de l'Accueil, montrée une seule fois.
alter table members add column if not exists welcomed_at timestamptz;
