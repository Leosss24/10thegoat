-- Auditoría de clubes formadores para las nacionalidades jugables.
-- Solo lectura: no modifica datos ni expone la clave de API-Football.
with required_countries(db_name, game_name) as (
  values
    ('Germany','Alemania'), ('Argentina','Argentina'), ('Belgium','Bélgica'),
    ('Brazil','Brasil'), ('Chile','Chile'), ('Colombia','Colombia'),
    ('Denmark','Dinamarca'), ('Ecuador','Ecuador'), ('Spain','España'),
    ('France','Francia'), ('England','Inglaterra'), ('Italy','Italia'),
    ('Netherlands','Países Bajos'), ('Paraguay','Paraguay'),
    ('Portugal','Portugal'), ('Uruguay','Uruguay')
), senior_clubs as (
  select c.id, c.country_id, c.domestic_division
  from public.clubs c
  where c.is_active = true
    and c.is_game_eligible = true
    and c.is_national_team = false
    and c.domestic_division in (1, 2)
    and c.name !~* '(^jong | women| ladies| femenino| feminina| femminile| frauen| primavera| juvenil| youth| academy| reserves?| u-?[0-9]+| (b|ii|iii)$)'
)
select
  r.game_name as pais,
  count(s.id) filter (where s.domestic_division = 1) as primera,
  count(s.id) filter (where s.domestic_division = 2) as segunda,
  count(s.id) as total_formadores,
  case when count(s.id) < 3 then 'IMPORTAR' else 'OK' end as estado
from required_countries r
left join public.countries co on co.name = r.db_name
left join senior_clubs s on s.country_id = co.id
group by r.game_name
order by count(s.id), r.game_name;

-- Si Colombia o Paraguay siguen marcados como IMPORTAR, ejecutar desde el repo:
-- npm run import:career-gaps -- --dry-run
-- npm run import:career-gaps
