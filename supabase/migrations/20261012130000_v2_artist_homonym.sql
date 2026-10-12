-- Homonymes Last.fm : verdict par artiste (Deezer vérifié sur un de ses titres), partagé entre membres.
-- null = pas encore vérifié ; true = les tags Last.fm sont ceux d'un homonyme, on prend Deezer titre par titre.
alter table artist_tags add column if not exists homonym boolean;
