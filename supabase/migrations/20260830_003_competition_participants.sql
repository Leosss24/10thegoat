-- 10 THE GOAT v0.3.6
-- Distinguish where a competition is played from who participates in it.

alter table public.competitions
  add column if not exists participant_type text;

update public.competitions c
set participant_type = case
  when exists (
    select 1
    from public.player_season_stats pss
    join public.clubs t on t.id = pss.club_id
    where pss.competition_id = c.id
      and t.is_national_team = true
  ) then 'national_team'
  else 'club'
end
where participant_type is null;

alter table public.competitions
  alter column participant_type set default 'club';

alter table public.competitions
  alter column participant_type set not null;

alter table public.competitions
  drop constraint if exists competitions_participant_type_check;

alter table public.competitions
  add constraint competitions_participant_type_check
  check (participant_type in ('club', 'national_team'));

create index if not exists competitions_participant_type_idx
  on public.competitions(participant_type);

comment on column public.competitions.scope is
  'Geographic scope: domestic, continental or international.';

comment on column public.competitions.participant_type is
  'Participant category: club or national_team.';
