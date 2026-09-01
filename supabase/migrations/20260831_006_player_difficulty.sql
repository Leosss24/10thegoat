-- 10theGOAT v0.11.4-beta.1
-- Adivina el jugador: difficulty pools
--
-- EASY:
--   - active players whose current/latest club is curated via clubs.is_easy_player_pool
--   - retired players curated via players.is_legend
--
-- HARD:
--   - active players with stats in a curated first-division competition
--   - legends
--
-- IMPOSSIBLE:
--   - every otherwise playable player in the database

alter table public.clubs
  add column if not exists is_easy_player_pool boolean not null default false;

alter table public.players
  add column if not exists is_legend boolean not null default false;

alter table public.competitions
  add column if not exists is_hard_player_pool boolean not null default false;

create index if not exists clubs_easy_player_pool_idx
  on public.clubs (is_easy_player_pool)
  where is_easy_player_pool = true;

create index if not exists players_legend_idx
  on public.players (is_legend)
  where is_legend = true;

create index if not exists competitions_hard_player_pool_idx
  on public.competitions (is_hard_player_pool)
  where is_hard_player_pool = true;

comment on column public.clubs.is_easy_player_pool is
  'Curated club flag for the Easy pool in Adivina el jugador.';

comment on column public.players.is_legend is
  'Editorial legend flag. Legends are eligible for Easy and Hard regardless of current club.';

comment on column public.competitions.is_hard_player_pool is
  'First-division competitions eligible for Hard in Adivina el jugador.';

-- Reset only these editorial flags so the migration is repeatable.
update public.clubs set is_easy_player_pool = false where is_easy_player_pool = true;
update public.competitions set is_hard_player_pool = false where is_hard_player_pool = true;

-- EASY: 25 high-following clubs, five per big-five league.
-- We intentionally curate by club name rather than league position.
update public.clubs c
set is_easy_player_pool = true
from public.countries co
where c.country_id = co.id
  and (
    (lower(co.name) in ('spain','españa') and lower(c.name) in (
      'real madrid','real madrid cf','fc barcelona','barcelona',
      'atletico madrid','atlético madrid','atletico de madrid','atlético de madrid',
      'athletic club','athletic bilbao','real betis','real betis balompié','real betis balompie'
    ))
    or
    (lower(co.name) in ('england','inglaterra') and lower(c.name) in (
      'manchester city','manchester united','liverpool','liverpool fc',
      'arsenal','arsenal fc','chelsea','chelsea fc'
    ))
    or
    (lower(co.name) in ('italy','italia') and lower(c.name) in (
      'inter','inter milan','internazionale','fc internazionale milano',
      'milan','ac milan','juventus','juventus fc','napoli','ssc napoli',
      'roma','as roma'
    ))
    or
    (lower(co.name) in ('germany','alemania') and lower(c.name) in (
      'bayern munich','bayern münchen','fc bayern munich','fc bayern münchen',
      'borussia dortmund','bayer leverkusen','bayer 04 leverkusen',
      'rb leipzig','rasenballsport leipzig','eintracht frankfurt'
    ))
    or
    (lower(co.name) in ('france','francia') and lower(c.name) in (
      'paris saint germain','paris saint-germain','psg',
      'marseille','olympique de marseille','monaco','as monaco',
      'lyon','olympique lyonnais','lille','lille osc'
    ))
  );

-- HARD: first divisions of the big five + Argentina.
-- Match by country + common competition aliases so unrelated competitions
-- with similar names are not selected.
update public.competitions c
set is_hard_player_pool = true
from public.countries co
where c.country_id = co.id
  and c.competition_type = 'league'
  and c.scope = 'domestic'
  and (
    (lower(co.name) in ('spain','españa') and lower(c.name) in (
      'laliga','la liga','primera division','primera división','laliga ea sports'
    ))
    or
    (lower(co.name) in ('england','inglaterra') and lower(c.name) in (
      'premier league'
    ))
    or
    (lower(co.name) in ('italy','italia') and lower(c.name) in (
      'serie a'
    ))
    or
    (lower(co.name) in ('germany','alemania') and lower(c.name) in (
      'bundesliga'
    ))
    or
    (lower(co.name) in ('france','francia') and lower(c.name) in (
      'ligue 1'
    ))
    or
    (lower(co.name) in ('argentina') and lower(c.name) in (
      'liga profesional argentina','primera division','primera división',
      'liga profesional de fútbol','liga profesional de futbol'
    ))
  );

-- Initial editorial legend seed.
-- Only players already present are affected. This list can be expanded freely
-- later in Supabase by setting players.is_legend = true.
update public.players
set is_legend = true
where is_retired = true
  and lower(coalesce(game_name, display_name, last_name, '')) in (
    'pelé','pele','maradona','diego maradona','zidane','zinedine zidane',
    'ronaldinho','ronaldo','ronaldo nazario','ronaldo nazário','r9',
    'figo','luis figo','cafu','maldini','paolo maldini','gattuso','gennaro gattuso',
    'van nistelrooy','ruud van nistelrooy','bergkamp','dennis bergkamp',
    'drogba','didier drogba','henry','thierry henry','xavi','xavi hernandez','xavi hernández',
    'iniesta','andres iniesta','andrés iniesta','pirlo','andrea pirlo',
    'totti','francesco totti','del piero','alessandro del piero',
    'beckham','david beckham','gerrard','steven gerrard','lampard','frank lampard',
    'scholes','paul scholes','rooney','wayne rooney','kaka','kaká',
    'rivaldo','romario','romário','roberto carlos','batistuta','gabriel batistuta',
    'riquelme','juan roman riquelme','juan román riquelme','forlan','forlán','diego forlan','diego forlán',
    'nedved','pavel nedved','seedorf','clarence seedorf','shevchenko','andriy shevchenko',
    'raul','raúl','raul gonzalez','raúl gonzález','casillas','iker casillas',
    'puyol','carles puyol','david villa','fernando torres','buffon','gianluigi buffon'
  );
