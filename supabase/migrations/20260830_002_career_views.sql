-- 10 THE GOAT - Career separation views
-- Keeps one normalized player/team/season relationship table while exposing
-- club career and international career separately.

create or replace view public.player_club_career as
select
  pcs.id,
  pcs.player_id,
  pcs.club_id,
  c.name as club_name,
  c.country_id,
  c.badge_url,
  pcs.season_start_year,
  pcs.shirt_number,
  pcs.is_current,
  pcs.source_provider,
  pcs.last_synced_at,
  pcs.created_at,
  pcs.updated_at
from public.player_club_seasons pcs
join public.clubs c on c.id = pcs.club_id
where c.is_national_team = false;

create or replace view public.player_international_career as
select
  pcs.id,
  pcs.player_id,
  pcs.club_id as national_team_id,
  c.name as national_team_name,
  c.country_id,
  c.badge_url,
  pcs.season_start_year,
  pcs.shirt_number,
  pcs.is_current,
  pcs.source_provider,
  pcs.last_synced_at,
  pcs.created_at,
  pcs.updated_at
from public.player_club_seasons pcs
join public.clubs c on c.id = pcs.club_id
where c.is_national_team = true;

grant select on public.player_club_career to anon, authenticated;
grant select on public.player_international_career to anon, authenticated;
