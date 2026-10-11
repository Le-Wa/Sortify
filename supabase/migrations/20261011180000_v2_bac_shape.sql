-- Forme de la pochette d'un bac (liste fermée dans lib/cover-shapes.ts), choisie par l'IA avec la fiche.
alter table bacs add column if not exists shape text;

-- Bacs existants : formes choisies avec Walid sur la planche du 11/10/2026.
update bacs set shape = case name
  when 'Tech house festival' then 'starburst'
  when 'Afrobeats & afro-RnB' then 'zigzag'
  when 'Soul nocturne' then 'crescent'
  when 'Rap français' then 'triangle'
  when 'House solaire' then 'sun'
  when 'Afro house oriental' then 'arch'
  when 'Rave warehouse' then 'bolt'
  when 'Jazz groove' then 'squiggle'
  when 'Groove joyeux' then 'flower'
  when 'Fin de nuit' then 'horizon'
  when 'Caraïbes & latino' then 'leaf'
  when 'Pop indé sensible' then 'sparkle'
  when 'Techno mélodique' then 'chevrons'
end
where shape is null and not is_divers;
