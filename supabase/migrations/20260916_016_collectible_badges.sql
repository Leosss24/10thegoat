-- Collectible badges. All writes go through the authenticated RPC.
begin;
create table if not exists public.badge_metrics(metric text primary key, kind text not null check(kind in ('unique','max')), cap integer not null check(cap>0));
create table if not exists public.badge_definitions(id text primary key,metric text not null references public.badge_metrics(metric),target integer not null,pleno_target integer);
create table if not exists public.user_badge_facts(user_id uuid not null references auth.users(id) on delete cascade,metric text not null references public.badge_metrics(metric),subject text not null check(length(subject) between 1 and 180),value integer not null check(value>0),primary key(user_id,metric,subject));
create table if not exists public.user_badges(user_id uuid not null references auth.users(id) on delete cascade,badge_id text not null references public.badge_definitions(id),earned_at timestamptz not null default now(),pleno_at timestamptz,primary key(user_id,badge_id));
alter table public.badge_metrics enable row level security;
alter table public.badge_definitions enable row level security;
alter table public.user_badge_facts enable row level security;
alter table public.user_badges enable row level security;
drop policy if exists own_badge_facts on public.user_badge_facts;
create policy own_badge_facts on public.user_badge_facts for select to authenticated using(user_id=(select auth.uid()));
drop policy if exists own_badges on public.user_badges;
create policy own_badges on public.user_badges for select to authenticated using(user_id=(select auth.uid()));
revoke all on public.badge_metrics,public.badge_definitions,public.user_badge_facts,public.user_badges from anon,authenticated;
grant select on public.user_badge_facts,public.user_badges to authenticated;
insert into public.badge_metrics(metric,kind,cap) values
('players','unique',25),
('player-perfect','max',1),
('careers','unique',5),
('career-title','max',1),
('higher-streak','max',20),
('higher-correct','unique',100),
('grids','unique',10),
('grid-perfect','max',1),
('clubs','unique',50),
('crest-streak','max',10),
('trivia-easy','max',5),
('trivia-hard','max',7),
('trivia-timed','max',10),
('odd-rounds','unique',50),
('odd-streak','max',10),
('connections','unique',10),
('connections-perfect','max',1),
('timelines','unique',25),
('timeline-streak','max',5),
('challenge-mundiales-01','max',25),
('challenge-champions-01','max',25),
('challenge-premier-league-01','max',25),
('challenge-la-liga-01','max',25),
('challenge-eurocopa-01','max',25)
on conflict(metric) do update set kind=excluded.kind,cap=excluded.cap;
insert into public.badge_definitions(id,metric,target,pleno_target) values
('player.first','players',1,null),
('player.collection','players',25,null),
('player.perfect','player-perfect',1,null),
('career.first','careers',1,null),
('career.collection','careers',5,null),
('career.title','career-title',1,null),
('higher.first','higher-streak',5,null),
('higher.collection','higher-correct',100,null),
('higher.perfect','higher-streak',20,null),
('grid.first','grids',1,null),
('grid.collection','grids',10,null),
('grid.perfect','grid-perfect',1,null),
('crest.first','clubs',1,null),
('crest.collection','clubs',50,null),
('crest.perfect','crest-streak',10,null),
('trivia.easy','trivia-easy',5,null),
('trivia.hard','trivia-hard',7,null),
('trivia.timed','trivia-timed',10,null),
('odd.first','odd-rounds',1,null),
('odd.collection','odd-rounds',50,null),
('odd.perfect','odd-streak',10,null),
('connections.first','connections',1,null),
('connections.collection','connections',10,null),
('connections.perfect','connections-perfect',1,null),
('timeline.first','timelines',1,null),
('timeline.collection','timelines',25,null),
('timeline.perfect','timeline-streak',5,null),
('challenge.mundiales-01','challenge-mundiales-01',20,25),
('challenge.champions-01','challenge-champions-01',20,25),
('challenge.premier-league-01','challenge-premier-league-01',20,25),
('challenge.la-liga-01','challenge-la-liga-01',20,25),
('challenge.eurocopa-01','challenge-eurocopa-01',20,25)
on conflict(id) do update set metric=excluded.metric,target=excluded.target,pleno_target=excluded.pleno_target;

-- Old rounds have unknown error counts; they cannot earn a retroactive perfect badge.
alter table public.football_grid_rounds add column if not exists badge_mistakes integer check(badge_mistakes>=0);
alter table public.football_grid_rounds alter column badge_mistakes set default 0;
create or replace function public.sync_own_badges(p_facts jsonb default '[]'::jsonb) returns jsonb
language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid(); f jsonb; m public.badge_metrics; n integer; subject_key text;
begin
 if uid is null then raise exception 'not_authenticated'; end if;
 if jsonb_typeof(p_facts) is distinct from 'array' or jsonb_array_length(p_facts)>100 then raise exception 'invalid_facts'; end if;
 perform pg_advisory_xact_lock(hashtextextended(uid::text,816));
 for f in select * from jsonb_array_elements(p_facts) loop
  select * into m from public.badge_metrics where metric=f->>'metric';
  if not found or m.metric in ('grids','grid-perfect') then raise exception 'invalid_metric'; end if;
  if jsonb_typeof(f->'subject') is distinct from 'string' or jsonb_typeof(f->'value') is distinct from 'number' or (f->>'value') !~ '^[0-9]+$' then raise exception 'invalid_fact'; end if;
  subject_key:=f->>'subject'; n:=(f->>'value')::integer;
  if length(subject_key) not between 1 and 180 or n<1 or (m.kind='unique' and n<>1) or (m.kind='max' and (n>m.cap or subject_key<>'best')) then raise exception 'invalid_fact'; end if;
  if m.kind='unique' and (select count(*) from public.user_badge_facts where user_id=uid and metric=m.metric)>=m.cap then continue; end if;
  insert into public.user_badge_facts(user_id,metric,subject,value) values(uid,m.metric,subject_key,n)
   on conflict(user_id,metric,subject) do update set value=greatest(user_badge_facts.value,excluded.value);
 end loop;
 -- Football Grid awards use authoritative server results, not browser claims.
 insert into public.user_badge_facts(user_id,metric,subject,value)
 select uid,'grids',board->>'id',1 from public.football_grid_rounds where user_id=uid and status='won' group by board->>'id' limit 10
 on conflict do nothing;
 if exists(select 1 from public.football_grid_rounds where user_id=uid and status='won' and badge_mistakes=0) then
  insert into public.user_badge_facts values(uid,'grid-perfect','best',1) on conflict do nothing;
 end if;
 insert into public.user_badges(user_id,badge_id,pleno_at)
 select uid,b.id,case when p.value>=b.pleno_target then now() end from public.badge_definitions b
 join (select bf.metric,case when bm.kind='unique' then count(*) else max(bf.value) end as value from public.user_badge_facts bf join public.badge_metrics bm using(metric) where bf.user_id=uid group by bf.metric,bm.kind) p on p.metric=b.metric
 where p.value>=b.target
 on conflict(user_id,badge_id) do update set pleno_at=coalesce(user_badges.pleno_at,excluded.pleno_at);
 return jsonb_build_object('facts',coalesce((select jsonb_agg(jsonb_build_object('metric',metric,'subject',subject,'value',value)) from public.user_badge_facts where user_id=uid),'[]'::jsonb),
 'awards',coalesce((select jsonb_agg(jsonb_strip_nulls(jsonb_build_object('id',badge_id,'earnedAt',earned_at,'plenoAt',pleno_at))) from public.user_badges where user_id=uid),'[]'::jsonb));
end $$;
revoke all on function public.sync_own_badges(jsonb) from public,anon;
grant execute on function public.sync_own_badges(jsonb) to authenticated;

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
      elsif r.answers @> jsonb_build_array(p_player) then feedback := 'duplicate'; update public.football_grid_rounds set badge_mistakes=coalesce(badge_mistakes,0)+1 where id=r.id;
      elsif not ((r.valid_players->p_cell) @> jsonb_build_array(p_player)) then feedback := 'incorrect'; update public.football_grid_rounds set badge_mistakes=coalesce(badge_mistakes,0)+1 where id=r.id;
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
commit;
