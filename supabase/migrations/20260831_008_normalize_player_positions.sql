-- 10theGOAT v0.11.6-beta.1
-- Posición canónica para porteros.
update public.players
set primary_position = 'Goalkeeper'
where lower(trim(coalesce(primary_position, ''))) in ('gk', 'keeper', 'goalie', 'portero', 'goalkeeper');
