-- Clasificación y competición doméstica actual para el mercado del Modo Carrera.
alter table public.clubs add column if not exists career_category text not null default 'national';
alter table public.clubs add column if not exists domestic_division smallint;
alter table public.clubs add column if not exists domestic_league_name text;
alter table public.clubs add column if not exists domestic_league_external_id text;
alter table public.clubs add column if not exists domestic_season_start_year integer;
alter table public.clubs drop constraint if exists clubs_career_category_check;
alter table public.clubs add constraint clubs_career_category_check check (career_category in ('premium_international','elite_international','elite_national','national','national_b'));
alter table public.clubs drop constraint if exists clubs_domestic_division_check;
alter table public.clubs add constraint clubs_domestic_division_check check (domestic_division is null or domestic_division in (1,2));
create index if not exists clubs_career_category_idx on public.clubs(career_category);
create index if not exists clubs_domestic_league_idx on public.clubs(domestic_league_external_id,domestic_season_start_year);
comment on column public.clubs.career_category is 'Career market order: premium international, elite international, elite national, national, national B.';
comment on column public.clubs.domestic_division is 'Current domestic division (1 or 2) for the imported season.';
