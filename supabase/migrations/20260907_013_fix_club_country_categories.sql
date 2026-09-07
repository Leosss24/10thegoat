-- Corrige homónimos: una categoría de carrera identifica club y país, no solo nombre.
update public.clubs as club
set career_category = case when club.domestic_division = 2 then 'national_b' else 'national' end
from public.countries as country
where club.country_id = country.id
  and (
    (country.name = 'Belarus' and club.name = 'Arsenal')
    or (country.name = 'Peru' and club.name = 'Santos')
    or (country.name = 'Portugal' and club.name = 'Nacional')
    or (country.name = 'Brazil' and club.name = 'Athletic Club')
  );

update public.clubs as club
set career_category = 'premium_international'
from public.countries as country
where club.country_id = country.id
  and country.name = 'Uruguay'
  and club.name in ('Nacional', 'Club Nacional');

update public.clubs as club
set career_category = 'elite_international'
from public.countries as country
where club.country_id = country.id
  and (
    (country.name = 'Spain' and club.name in ('Atletico Madrid', 'Atletico de Madrid'))
    or (country.name = 'Italy' and club.name in ('AS Roma', 'Roma'))
    or (country.name = 'Portugal' and club.name in ('FC Porto', 'Porto'))
    or (country.name = 'Turkey' and club.name in ('Fenerbahce', 'Fenerbahçe'))
    or (country.name = 'Chile' and club.name = 'Colo Colo')
    or (country.name = 'Colombia' and club.name = 'Atletico Nacional')
    or (country.name = 'Ecuador' and club.name in ('LDU de Quito', 'Independiente del Valle'))
    or (country.name = 'Paraguay' and club.name in ('Olimpia', 'Cerro Porteno'))
  );

update public.clubs as club
set career_category = 'elite_national'
from public.countries as country
where club.country_id = country.id
  and (
    (country.name = 'Chile' and club.name in ('U. Catolica', 'Universidad de Chile'))
    or (country.name = 'Colombia' and club.name in ('Millonarios', 'America de Cali', 'Junior', 'Deportivo Cali', 'Santa Fe'))
    or (country.name = 'Ecuador' and club.name in ('Barcelona SC', 'Emelec'))
    or (country.name = 'Paraguay' and club.name in ('Libertad Asuncion', 'Club Guarani'))
  );
