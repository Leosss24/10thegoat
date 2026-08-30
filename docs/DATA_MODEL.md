# 10 The GOAT — Core Data Model v1

## Principle

10 The GOAT owns its internal IDs. API-Football is a source, not the identity system.

`players.id`, `clubs.id` and `competitions.id` are the canonical IDs used by every game. Provider IDs live in dedicated mapping tables.

## Primary visual URLs

For v1, the most common visual resource is deliberately simple:

- `players.photo_url`: direct portrait URL returned by API-Football.
- `clubs.badge_url`: direct badge URL returned by API-Football.
- competitions have no logo field.

The browser can render these URLs directly. `media_assets` remains available for future alternate, owned or locally cached assets, but it is not required for the primary portrait/badge.

## Core entities

- `countries`: country metadata and flag emoji.
- `clubs`: clubs and national teams, including `badge_url`.
- `competitions`: leagues/cups/tournaments. No official competition-logo field in v1.
- `players`: canonical player identity, including `photo_url`.
- `player_club_seasons`: historical player/team relationship.
- `player_season_stats`: one row per player, club, competition and season.
- `player_transfers`: transfer history.
- `player_honours`: trophies and honours.
- `media_assets`: optional extended media catalogue.
- `sync_state`: scheduling and health of provider sync jobs.

## Competition visuals

- Domestic competition → country flag + country name.
- Continental/international competition → `🌍` + `Internacional`.

This rule is implemented in `lib/football/media.ts`.

## Provider independence

API-Football IDs never replace internal IDs. Example: Messi may be `players.id = 1` and have `player_external_ids(provider='api_football', external_id='154')`. Games only use the internal ID.

## Sync strategy

Current-season data can be refreshed frequently. Completed seasons can be marked `completed` and frozen. Retired players do not consume recurring API calls merely because their historical rows exist.
