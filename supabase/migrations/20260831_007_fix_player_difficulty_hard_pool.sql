-- 10theGOAT v0.11.4-beta.2
-- Fix Hard difficulty pool: derive eligibility from current club membership,
-- not from player_season_stats coverage.

alter table public.clubs
  add column if not exists is_hard_player_pool boolean not null default false;

create index if not exists clubs_hard_player_pool_idx
  on public.clubs (is_hard_player_pool)
  where is_hard_player_pool = true;

comment on column public.clubs.is_hard_player_pool is
  'True when the club belongs to a curated first division used by Hard in Adivina el jugador.';

-- Rebuild Hard club eligibility from the current competition catalogue.
-- We use competition_external_ids because API-Football league IDs are stable
-- and avoid fragile name matching.

update public.clubs
set is_hard_player_pool = false
where is_hard_player_pool = true;

with hard_competitions as (
  select c.id
  from public.competitions c
  join public.competition_external_ids cei
    on cei.competition_id = c.id
  where cei.provider = 'api-football'
    and cei.external_id in ('140','39','135','78','61','128')
),
hard_club_ids as (
  select distinct pss.club_id
  from public.player_season_stats pss
  where pss.competition_id in (select id from hard_competitions)
)
update public.clubs c
set is_hard_player_pool = true
where c.id in (select club_id from hard_club_ids);

-- Safety fallback for databases where current competition stats are incomplete:
-- also mark clubs already curated for Easy, because Easy must remain a subset of Hard.
update public.clubs
set is_hard_player_pool = true
where is_easy_player_pool = true;

-- The old competition flag is no longer used by the client, but we keep it
-- for compatibility with beta.1 and future admin tooling.
