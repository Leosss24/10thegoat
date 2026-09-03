create table if not exists public.career_saves (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 50),
  career_state jsonb not null,
  player_name text not null,
  current_club text not null,
  current_year integer not null,
  player_age integer not null check (player_age between 15 and 40),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, id)
);

create index if not exists career_saves_user_updated_idx on public.career_saves(user_id, updated_at desc);
alter table public.career_saves enable row level security;
create policy "users read own career saves" on public.career_saves for select to authenticated using ((select auth.uid()) = user_id);
create policy "users create own career saves" on public.career_saves for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "users update own career saves" on public.career_saves for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "users delete own career saves" on public.career_saves for delete to authenticated using ((select auth.uid()) = user_id);

create or replace function public.limit_career_save_slots() returns trigger language plpgsql security definer set search_path=public as $$
begin
  if (select count(*) from public.career_saves where user_id=new.user_id) >= 3 then
    raise exception 'career_save_limit_reached';
  end if;
  return new;
end;
$$;
drop trigger if exists enforce_career_save_limit on public.career_saves;
create trigger enforce_career_save_limit before insert on public.career_saves for each row execute function public.limit_career_save_slots();

drop trigger if exists set_updated_at on public.career_saves;
create trigger set_updated_at before update on public.career_saves for each row execute function public.set_updated_at();
