-- 10 THE GOAT · v0.9.2
-- Adds a dedicated, optional game-facing player name.
-- This migration is additive only: it does not delete or overwrite player data.

alter table public.players
  add column if not exists game_name text;

create index if not exists players_game_name_idx
  on public.players (lower(game_name))
  where game_name is not null;

comment on column public.players.game_name is
  'Curated short football name used by word/name games. NULL means not yet approved for those games.';
