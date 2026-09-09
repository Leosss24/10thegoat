-- Football Grid v2: proportional scoring, streaks and resolution records.
-- Apply once after 014. Existing points and old rounds keep their original scoring.
begin;
alter table public.football_grid_rounds add column if not exists rules_version integer not null default 1;
alter table public.football_grid_rounds alter column rules_version set default 2;
alter table public.football_grid_rounds add column if not exists elapsed_ms bigint;
alter table public.football_grid_rounds add column if not exists streak_after integer;
alter table public.user_game_stats add column if not exists grid_current_streak integer not null default 0;
alter table public.user_game_stats add column if not exists grid_best_streak integer not null default 0;
alter table public.user_game_stats add column if not exists grid_best_time_ms bigint;
-- Backfill historical records without changing any awarded points, wins or quotas.
update public.football_grid_rounds set elapsed_ms=greatest(0,floor(extract(epoch from (finished_at-started_at))*1000)::bigint)
where status<>'active' and finished_at is not null and elapsed_ms is null;
with groups as (
 select id,user_id,difficulty,status,finished_at,
 sum((status<>'won')::integer) over(partition by user_id,difficulty order by finished_at,id) as streak_group
 from public.football_grid_rounds where status<>'active'
), streaks as (
 select id,case when status='won' then sum((status='won')::integer) over(partition by user_id,difficulty,streak_group order by finished_at,id)::integer else 0 end as streak
 from groups
)
update public.football_grid_rounds r set streak_after=s.streak from streaks s where r.id=s.id;
with records as (
 select user_id,difficulty,max(streak_after) as best_streak,min(elapsed_ms) filter(where status='won') as best_time,
 (array_agg(streak_after order by finished_at desc,id desc))[1] as current_streak
 from public.football_grid_rounds where status<>'active' group by user_id,difficulty
)
update public.user_game_stats s set grid_current_streak=r.current_streak,grid_best_streak=r.best_streak,grid_best_time_ms=r.best_time
from records r where s.user_id=r.user_id and s.game_key='football-grid-'||r.difficulty;

create or replace function public.football_grid_finish(p_id uuid,p_status text,p_now timestamptz)
returns void language plpgsql security definer set search_path=public as $$
declare r public.football_grid_rounds; delta integer; duration bigint; next_streak integer;
begin
 if p_status not in ('won','timeout','surrendered') then raise exception 'invalid_status'; end if;
 select * into r from public.football_grid_rounds where id=p_id for update;
 if not found or r.status<>'active' then return; end if;
 -- Expiry always wins, including a surrender or last answer arriving at the deadline.
 if p_now>=r.expires_at then p_status:='timeout'; end if;
 duration:=greatest(0,floor(extract(epoch from (p_now-r.started_at))*1000)::bigint);
 delta:=case
 when p_status='won' and r.rules_version>=2 then floor((case when r.difficulty='easy' then 5000 else 10000 end)*greatest(0,least(1,extract(epoch from (r.expires_at-p_now))/600)))::integer
 when p_status='won' then case when r.difficulty='easy' then 100 else 200 end
 when p_status='surrendered' then case when r.difficulty='easy' then -20 else -50 end else 0 end;
 insert into public.user_game_stats(user_id,game_key,points,played,wins,best_score,surrenders,grid_current_streak,grid_best_streak,grid_best_time_ms)
 values(r.user_id,'football-grid-'||r.difficulty,greatest(0,delta),1,(p_status='won')::integer,greatest(0,delta),(p_status='surrendered')::integer,(p_status='won')::integer,(p_status='won')::integer,case when p_status='won' then duration end)
 on conflict(user_id,game_key) do update set
 points=greatest(0,user_game_stats.points+delta),played=user_game_stats.played+1,wins=user_game_stats.wins+(p_status='won')::integer,
 best_score=greatest(user_game_stats.best_score,delta),surrenders=user_game_stats.surrenders+(p_status='surrendered')::integer,
 grid_current_streak=case when p_status='won' then user_game_stats.grid_current_streak+1 else 0 end,
 grid_best_streak=greatest(user_game_stats.grid_best_streak,case when p_status='won' then user_game_stats.grid_current_streak+1 else 0 end),
 grid_best_time_ms=case when p_status='won' then least(user_game_stats.grid_best_time_ms,duration) else user_game_stats.grid_best_time_ms end,updated_at=p_now
 returning grid_current_streak into next_streak;
 update public.football_grid_rounds set status=p_status,score=delta,finished_at=p_now,elapsed_ms=duration,streak_after=next_streak where id=r.id;
end $$;
revoke all on function public.football_grid_finish(uuid,text,timestamptz) from public,anon,authenticated;

create or replace function public.football_grid_play(
  p_action text default 'state', p_difficulty text default 'easy',
  p_round uuid default null, p_cell integer default null, p_player bigint default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid(); moment timestamptz; today date; r public.football_grid_rounds;
  expired uuid; catalog public.football_grid_catalogs; chosen jsonb; valid jsonb;
  used integer; stats jsonb; history jsonb; feedback text; round_json jsonb; chosen_variant text;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  if p_difficulty is null or p_difficulty not in ('easy','hard') or p_action is null or p_action not in ('state','start','answer','clear','surrender') then raise exception 'invalid_action'; end if;
  -- Serialise all changes for this account, including simultaneous tabs/devices.
  perform pg_advisory_xact_lock(hashtextextended(uid::text,814));
  moment := clock_timestamp(); today := (moment at time zone 'Europe/Madrid')::date;
  for expired in select id from public.football_grid_rounds where user_id=uid and status='active' and expires_at<=moment loop
    perform public.football_grid_finish(expired,'timeout',moment);
  end loop;
  select count(*) into used from public.football_grid_rounds where user_id=uid and difficulty=p_difficulty and day=today and status in ('won','timeout');
  if p_action in ('answer','clear','surrender') then
    select * into r from public.football_grid_rounds where id=p_round and user_id=uid and difficulty=p_difficulty;
    if not found then raise exception 'round_not_found'; end if;
    if r.status='active' then
      if p_action='surrender' then
        perform public.football_grid_finish(r.id,'surrendered',moment);
      elsif p_cell is null or p_cell<0 or p_cell>15 then raise exception 'invalid_cell';
      elsif p_action='clear' then
        update public.football_grid_rounds set answers=jsonb_set(answers,array[p_cell::text],'null') where id=r.id;
      elsif r.answers->p_cell <> 'null'::jsonb then feedback := 'filled';
      elsif p_player is null then raise exception 'invalid_player';
      elsif r.answers @> jsonb_build_array(p_player) then feedback := 'duplicate';
      elsif not ((r.valid_players->p_cell) @> jsonb_build_array(p_player)) then feedback := 'incorrect';
      else
        update public.football_grid_rounds set answers=jsonb_set(answers,array[p_cell::text],to_jsonb(p_player)) where id=r.id returning * into r;
        feedback := 'correct';
        if not (r.answers @> '[null]'::jsonb) then perform public.football_grid_finish(r.id,'won',moment); end if;
      end if;
    end if;
    select * into r from public.football_grid_rounds where id=r.id;
  else
    select * into r from public.football_grid_rounds where user_id=uid and difficulty=p_difficulty order by (status='active') desc,started_at desc limit 1;
    if p_action='start' and (r.id is null or r.status<>'active') then
      if used>=3 then feedback := 'daily_limit';
      else
        select * into catalog from public.football_grid_catalogs where active;
        if not found then raise exception 'catalog_unavailable'; end if;
        -- Mix the two Easy variants evenly, then select a board from that variant.
        chosen_variant := case when p_difficulty='hard' then 'club-club' when random()<0.5 then 'country-club' else 'country-position' end;
        select value into chosen from jsonb_array_elements(catalog.payload->'boards')
          where value->>'difficulty'=p_difficulty and value->>'variant'=chosen_variant
          order by random() limit 1;
        if chosen is null then raise exception 'catalog_unavailable'; end if;
        select jsonb_agg(cell.players order by cell.i) into valid from (
          select i, coalesce((select jsonb_agg(p->'id') from jsonb_array_elements(catalog.payload->'players') p
            where public.football_grid_matches(p,chosen->'rows'->(i/4)) and public.football_grid_matches(p,chosen->'columns'->(i%4))), '[]'::jsonb) players
          from generate_series(0,15) i
        ) cell;
        if exists(select 1 from jsonb_array_elements(valid) x where jsonb_array_length(x)=0) then raise exception 'invalid_catalog'; end if;
        insert into public.football_grid_rounds(user_id,catalog_version,difficulty,board,valid_players,day,started_at,expires_at,rules_version)
          values(uid,catalog.version,p_difficulty,chosen,valid,today,moment,moment+interval '10 minutes',2) returning * into r;
      end if;
    end if;
  end if;
  select count(*) into used from public.football_grid_rounds where user_id=uid and difficulty=p_difficulty and day=today and status in ('won','timeout');
  select jsonb_build_object('points',points,'played',played,'wins',wins,'best_score',best_score,'surrenders',surrenders,'current_streak',grid_current_streak,'best_streak',grid_best_streak,'best_time_ms',grid_best_time_ms) into stats
    from public.user_game_stats where user_id=uid and game_key='football-grid-'||p_difficulty;
  select coalesce(jsonb_agg(to_jsonb(h) order by h.finished_at desc,h.id desc),'[]'::jsonb) into history from (
    select id,status,score,elapsed_ms,streak_after,finished_at from public.football_grid_rounds
    where user_id=uid and difficulty=p_difficulty and status<>'active'
    order by finished_at desc,id desc limit 10
  ) h;
  if r.id is not null then round_json := to_jsonb(r)-'user_id'-'valid_players'; end if;
  return jsonb_build_object('round',round_json,'used',used,'day',today,'stats',coalesce(stats,'{"points":0,"played":0,"wins":0,"best_score":0,"surrenders":0}'::jsonb),'feedback',feedback,'server_now',moment,'rules_version',2,'history',history);
end $$;
revoke all on function public.football_grid_play(text,text,uuid,integer,bigint) from public,anon;
grant execute on function public.football_grid_play(text,text,uuid,integer,bigint) to authenticated;


commit;
