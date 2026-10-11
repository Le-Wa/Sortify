-- Suivre les changements faits dans Spotify (likes retirés, titres retirés/ajoutés à la main dans une playlist).
alter table members add column if not exists unlike_action text not null default 'retirer'
  check (unlike_action in ('retirer', 'garder'));
-- Like retiré mais gardé dans les playlists (réglage « garder ») : Sortify ne le suit plus.
alter table likes add column if not exists unliked_at timestamptz;
-- Titre que la personne a sorti de Divers dans Spotify : plus jamais re-rangé automatiquement.
alter table likes add column if not exists excluded boolean not null default false;
