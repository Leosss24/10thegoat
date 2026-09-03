alter table public.profiles
  add column if not exists avatar_club_id bigint references public.clubs(id) on delete set null,
  add column if not exists last_seen_at timestamptz not null default now();

update public.profiles
set username_changed_at = coalesce(username_changed_at, updated_at, created_at, now())
where username is not null and username_changed_at is null;

create or replace function public.enforce_username_cooldown()
returns trigger language plpgsql set search_path = public as $$
begin
  if old.username is distinct from new.username then
    if old.username is not null and coalesce(old.username_changed_at, old.updated_at, old.created_at) > now() - interval '6 months' then
      raise exception 'username_change_cooldown';
    end if;
    new.username_changed_at = now();
  end if;
  return new;
end $$;

create table if not exists public.user_game_stats (
  user_id uuid not null references auth.users(id) on delete cascade,
  game_key text not null,
  points integer not null default 0 check (points >= 0),
  played integer not null default 0 check (played >= 0),
  wins integer not null default 0 check (wins >= 0),
  best_score integer not null default 0 check (best_score >= 0),
  hints_used integer not null default 0 check (hints_used >= 0),
  surrenders integer not null default 0 check (surrenders >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, game_key)
);
alter table public.user_game_stats enable row level security;
create policy "users read own game stats" on public.user_game_stats for select to authenticated using ((select auth.uid()) = user_id);

create or replace function public.sync_own_game_stats(p_game_key text,p_points integer,p_played integer,p_wins integer,p_best_score integer,p_hints_used integer,p_surrenders integer)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  insert into public.user_game_stats(user_id,game_key,points,played,wins,best_score,hints_used,surrenders)
  values(auth.uid(),p_game_key,greatest(0,p_points),greatest(0,p_played),greatest(0,p_wins),greatest(0,p_best_score),greatest(0,p_hints_used),greatest(0,p_surrenders))
  on conflict(user_id,game_key) do update set
    points=greatest(user_game_stats.points,excluded.points),played=greatest(user_game_stats.played,excluded.played),wins=greatest(user_game_stats.wins,excluded.wins),best_score=greatest(user_game_stats.best_score,excluded.best_score),hints_used=greatest(user_game_stats.hints_used,excluded.hints_used),surrenders=greatest(user_game_stats.surrenders,excluded.surrenders),updated_at=now();
end $$;
revoke all on function public.sync_own_game_stats(text,integer,integer,integer,integer,integer,integer) from public;
grant execute on function public.sync_own_game_stats(text,integer,integer,integer,integer,integer,integer) to authenticated;
