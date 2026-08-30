-- 10theGOAT: separa los clubes almacenados de los clubes elegibles para minijuegos.
-- Es aditiva: no borra clubes ni mappings existentes.

alter table public.clubs
  add column if not exists is_game_eligible boolean not null default false;

create index if not exists clubs_game_eligible_idx
  on public.clubs (is_game_eligible)
  where is_game_eligible = true;

comment on column public.clubs.is_game_eligible is
  'True when the club is curated/eligible to appear as a target or answer in public club games.';
