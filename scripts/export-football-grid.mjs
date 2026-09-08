// Read-only Supabase export. Never calls API-Football or writes to the database.
import { mkdirSync, writeFileSync } from 'node:fs';

const env = process.argv.find(a => a.startsWith('--env='))?.slice(6);
if (env) process.loadEnvFile(env);
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
// Provider mapping tables are not public; use the configured server key for reads.
const key = process.env.SUPABASE_SECRET_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !key) throw new Error('Configure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.');
const tables = {
  players: 'id,display_name,full_name,game_name,nationality_country_id,primary_position,photo_url,is_legend,is_retired',
  clubs: 'id,name,country_id,is_national_team,badge_url,career_category,domestic_division,domestic_league_external_id,domestic_season_start_year',
  countries: 'id,name,code,flag_emoji',
  competitions: 'id,name,competition_type,participant_type',
  player_club_seasons: 'id,player_id,club_id,season_start_year,is_current',
  player_season_stats: 'id,player_id,club_id,competition_id,season_start_year,appearances',
  player_external_ids: 'player_id,provider,external_id',
  club_external_ids: 'club_id,provider,external_id',
  competition_external_ids: 'competition_id,provider,external_id',
};
const snapshot = { exportedAt: new Date().toISOString() };
for (const [table, columns] of Object.entries(tables)) {
  const rows = [];
  for (let offset = 0; ; offset += 1000) {
    const response = await fetch(`${url}/rest/v1/${table}?select=${columns}&order=${columns.split(',')[0]}&offset=${offset}&limit=1000`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(30000),
    });
    if (!response.ok) throw new Error(`${table}: HTTP ${response.status}`);
    const page = await response.json(); rows.push(...page);
    if (page.length < 1000) break;
  }
  snapshot[table] = rows;
  console.log(`${table}: ${rows.length}`);
}
mkdirSync('tmp', { recursive: true });
writeFileSync('tmp/football-grid-snapshot.json', JSON.stringify(snapshot));
console.log('Read-only export saved to tmp/football-grid-snapshot.json (no credentials).');
