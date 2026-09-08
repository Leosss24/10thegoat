-- Football Grid: account-scoped rounds, server clock, daily quota and atomic scores.
-- Catalogs are immutable exports; keep old versions for rounds already started.
create table if not exists public.football_grid_catalogs (
  version text primary key,
  payload jsonb not null,
  active boolean not null default false,
  created_at timestamptz not null default now(),
  check (jsonb_typeof(payload->'players') = 'array' and jsonb_typeof(payload->'boards') = 'array')
);
create unique index if not exists football_grid_one_catalog on public.football_grid_catalogs(active) where active;
alter table public.football_grid_catalogs enable row level security;
create policy "read grid catalogs" on public.football_grid_catalogs for select to authenticated using (true);
grant select on public.football_grid_catalogs to authenticated;

create table if not exists public.football_grid_rounds (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  catalog_version text not null references public.football_grid_catalogs(version),
  difficulty text not null check (difficulty in ('easy','hard')),
  board jsonb not null,
  valid_players jsonb not null,
  answers jsonb not null default '[null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null]',
  status text not null default 'active' check (status in ('active','won','timeout','surrendered')),
  day date not null,
  started_at timestamptz not null,
  expires_at timestamptz not null,
  finished_at timestamptz,
  score integer not null default 0
);
create unique index if not exists football_grid_one_round on public.football_grid_rounds(user_id,difficulty) where status = 'active';
create index if not exists football_grid_daily on public.football_grid_rounds(user_id,difficulty,day);
alter table public.football_grid_rounds enable row level security;
-- Rounds are exposed only through the RPC; clients cannot insert wins or reset clocks.

create or replace function public.football_grid_matches(p jsonb, axis jsonb)
returns boolean language sql immutable set search_path = public as $$
  select case axis->>'kind'
    when 'country' then p->>'countryId' = axis->>'id'
    when 'position' then p->>'position' = axis->>'id'
    when 'club' then (p->'clubIds') ? (axis->>'id')
    else false end;
$$;

create or replace function public.football_grid_finish(p_id uuid, p_status text, p_now timestamptz)
returns void language plpgsql security definer set search_path = public as $$
declare r public.football_grid_rounds; delta integer;
begin
  if p_status not in ('won','timeout','surrendered') then raise exception 'invalid_status'; end if;
  select * into r from public.football_grid_rounds where id=p_id for update;
  if not found or r.status <> 'active' then return; end if;
  delta := case when p_status='won' then case when r.difficulty='easy' then 100 else 200 end
    when p_status='surrendered' then case when r.difficulty='easy' then -20 else -50 end else 0 end;
  update public.football_grid_rounds set status=p_status,score=delta,finished_at=p_now where id=p_id;
  insert into public.user_game_stats(user_id,game_key,points,played,wins,best_score,surrenders)
    values(r.user_id,'football-grid-'||r.difficulty,greatest(0,delta),1,(p_status='won')::integer,greatest(0,delta),(p_status='surrendered')::integer)
  on conflict(user_id,game_key) do update set
    points=greatest(0,user_game_stats.points+delta),played=user_game_stats.played+1,
    wins=user_game_stats.wins+(p_status='won')::integer,
    best_score=greatest(user_game_stats.best_score,delta),surrenders=user_game_stats.surrenders+(p_status='surrendered')::integer,updated_at=p_now;
end $$;
revoke all on function public.football_grid_finish(uuid,text,timestamptz) from public,anon,authenticated;

create or replace function public.football_grid_play(
  p_action text default 'state', p_difficulty text default 'easy',
  p_round uuid default null, p_cell integer default null, p_player bigint default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid(); moment timestamptz; today date; r public.football_grid_rounds;
  expired uuid; catalog public.football_grid_catalogs; chosen jsonb; valid jsonb;
  used integer; stats jsonb; feedback text; round_json jsonb; chosen_variant text;
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
        insert into public.football_grid_rounds(user_id,catalog_version,difficulty,board,valid_players,day,started_at,expires_at)
          values(uid,catalog.version,p_difficulty,chosen,valid,today,moment,moment+make_interval(secs=>case when p_difficulty='easy' then 120 else 90 end)) returning * into r;
      end if;
    end if;
  end if;
  select count(*) into used from public.football_grid_rounds where user_id=uid and difficulty=p_difficulty and day=today and status in ('won','timeout');
  select jsonb_build_object('points',points,'played',played,'wins',wins,'best_score',best_score,'surrenders',surrenders) into stats
    from public.user_game_stats where user_id=uid and game_key='football-grid-'||p_difficulty;
  if r.id is not null then round_json := to_jsonb(r)-'user_id'-'valid_players'; end if;
  return jsonb_build_object('round',round_json,'used',used,'day',today,'stats',coalesce(stats,'{"points":0,"played":0,"wins":0,"best_score":0,"surrenders":0}'::jsonb),'feedback',feedback,'server_now',moment);
end $$;
revoke all on function public.football_grid_play(text,text,uuid,integer,bigint) from public,anon;
grant execute on function public.football_grid_play(text,text,uuid,integer,bigint) to authenticated;

-- Preserve existing games' sync behaviour. Grid results are server-owned: local
-- stale totals must not resurrect surrendered points or forge new wins.
create or replace function public.sync_own_game_stats(p_game_key text,p_points integer,p_played integer,p_wins integer,p_best_score integer,p_hints_used integer,p_surrenders integer)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if p_game_key like 'football-grid-%' then return; end if;
  insert into public.user_game_stats(user_id,game_key,points,played,wins,best_score,hints_used,surrenders)
  values(auth.uid(),p_game_key,greatest(0,p_points),greatest(0,p_played),greatest(0,p_wins),greatest(0,p_best_score),greatest(0,p_hints_used),greatest(0,p_surrenders))
  on conflict(user_id,game_key) do update set
    points=greatest(user_game_stats.points,excluded.points),played=greatest(user_game_stats.played,excluded.played),wins=greatest(user_game_stats.wins,excluded.wins),best_score=greatest(user_game_stats.best_score,excluded.best_score),hints_used=greatest(user_game_stats.hints_used,excluded.hints_used),surrenders=greatest(user_game_stats.surrenders,excluded.surrenders),updated_at=now();
end $$;
