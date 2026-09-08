import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { candidates, solve, POSITIONS, matches } from '../lib/football-grid/engine.ts';
import { isReserveOrYouthClub, isWomensTeam } from '../lib/football/club-filter.ts';
import { isGridCategory,isGridEuropeanCountry,GRID_LEGEND_ADDITIONS } from '../lib/football-grid/pool.ts';

const snapshotPath=process.argv.find(a=>a.startsWith('--snapshot='))?.slice(11)??'tmp/football-grid-snapshot.json';
const source = JSON.parse(readFileSync(snapshotPath, 'utf8'));
const countries = new Map(source.countries.map(c => [c.id, c]));
const clubs = source.clubs.filter(c => !c.is_national_team && !isReserveOrYouthClub(c.name) && !isWomensTeam(c.name));
const seniorIds = new Set(clubs.map(c => c.id));
const historicalClubs=clubs.filter(c=>isGridCategory(c.career_category));
const europeanClubs=historicalClubs.filter(c=>isGridEuropeanCountry(countries.get(c.country_id)?.name));
const europeanIds=new Set(europeanClubs.map(c=>c.id));
const historicalIds=new Set(historicalClubs.map(c=>String(c.id)));
if(!source.currentRosters?.length)throw new Error('Current squad snapshot required. Run prepare-football-grid-pool.mjs first.');
const currentClubs=new Map();
for(const roster of source.currentRosters){
  if(!europeanIds.has(roster.club_id))throw new Error('Non-European club in current roster pool');
  for(const id of roster.player_ids){if(!currentClubs.has(id))currentClubs.set(id,[]);currentClubs.get(id).push(String(roster.club_id));}
}
const legendIds=new Set(source.players.filter(p=>p.is_legend).map(p=>p.id));
for(const extra of GRID_LEGEND_ADDITIONS){
  if(!source.player_external_ids.some(x=>x.player_id===extra.id&&Number(x.external_id)===extra.apiId&&['api_football','api-football'].includes(x.provider)))throw new Error('Legend identity mismatch');
  legendIds.add(extra.id);
}
// Existing imports classify many official competitions as "other". Explicitly
// recognise known senior competitions; never treat unknown tournaments as evidence.
const officialNames = new Set(['La Liga','Copa del Rey','UEFA Champions League','Premier League','FA Cup','League Cup','Bundesliga','DFB Pokal','Serie A','Coppa Italia','UEFA Europa League','Ligue 1','Coupe de France','Championship','2. Bundesliga','UEFA Europa Conference League','Eredivisie','Segunda División','FIFA Club World Cup','Primeira Liga','Serie B','KNVB Beker','Coupe de la Ligue','Jupiler Pro League','UEFA Super Cup','FIFA Intercontinental Cup','Taça de Portugal','Community Shield','Ligue 2','Major League Soccer','Taça da Liga','League One','Super Cup','Supercopa de España','Supercopa','Supercoppa Italiana','Trophée des Champions','CONMEBOL Libertadores','CONMEBOL Sudamericana']);
const seniorLeagueApiIds=new Set([140,39,135,78,61,94,88,203,128,71,268,265,239,242,250]);
const seniorLeagueIds=new Set(source.competition_external_ids.filter(x=>['api_football','api-football'].includes(x.provider)&&seniorLeagueApiIds.has(Number(x.external_id))).map(x=>x.competition_id));
const officialCompetitions = new Set(source.competitions.filter(c => c.participant_type === 'club' && (officialNames.has(c.name)||seniorLeagueIds.has(c.id))).map(c => c.id));
const evidence = source.player_season_stats.filter(s => s.appearances > 0 && seniorIds.has(s.club_id) && officialCompetitions.has(s.competition_id));
const clubHistory = new Map();
for (const stat of evidence) {
  if (!clubHistory.has(stat.player_id)) clubHistory.set(stat.player_id, new Set());
  clubHistory.get(stat.player_id).add(String(stat.club_id));
}
const eligible = source.players.filter(p=>legendIds.has(p.id)||currentClubs.has(p.id));
// Reviewed official appearances supplement provider gaps without inventing season totals.
const reviewed=JSON.parse(readFileSync('data/football-grid/verified-appearances.json','utf8'));
for(const fact of reviewed){
  const player=source.players.find(p=>p.id===fact.playerId);
  if(!player || ![player.full_name,player.display_name].some(n=>n?.toLowerCase().includes(fact.playerName.split(' ').at(-1).toLowerCase())) || !historicalClubs.some(c=>c.id===fact.clubId&&c.name===fact.clubName) || !fact.sources?.every(url=>url.startsWith('https://')))throw new Error('Invalid reviewed appearance identity/source');
  if(!clubHistory.has(fact.playerId))clubHistory.set(fact.playerId,new Set());
  clubHistory.get(fact.playerId).add(String(fact.clubId));
}
const players = eligible.filter(p => p.photo_url && countries.has(p.nationality_country_id) && POSITIONS.includes(p.primary_position)).map(p => ({
  id: p.id, name: p.game_name || p.display_name, aliases: [...new Set([p.display_name, p.full_name].filter(Boolean))], photo: p.photo_url,
  // Criterion keys use the provider's canonical country name, so new countries
  // in the SQL preview do not depend on future database sequence allocation.
  countryId: countries.get(p.nationality_country_id).name, position: p.primary_position, clubIds: [...(clubHistory.get(p.id) ?? [])].filter(id=>historicalIds.has(id)).sort(), legend: legendIds.has(p.id), currentClubIds:currentClubs.get(p.id)??[],
}));
const countryAxes = source.countries.map(c => ({ kind: 'country', id: c.name, name: c.name, image: c.flag_url, flag: c.flag_emoji || c.code || c.name }));
const clubAxes = historicalClubs.filter(c => c.badge_url && players.filter(p => p.clubIds.includes(String(c.id))).length >= 4).map(c => ({ kind: 'club', id: String(c.id), name: c.name, image: c.badge_url }));
const easyClubAxes=clubAxes.filter(c=>europeanIds.has(Number(c.id)));
const positionAxes = POSITIONS.map(id => ({ kind: 'position', id, name: id }));
console.log({eligible:eligible.length,players:players.length,europeanClubs:europeanIds.size,historicalClubs:historicalClubs.length,clubAxes:clubAxes.length,evidence:evidence.length});
let seed = 42781;
function random() { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; }
function shuffle(array) { const copy = [...array]; for (let i = copy.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [copy[i],copy[j]] = [copy[j],copy[i]]; } return copy; }
const boards = [], seen = new Set();
const desired = 100;
for (const variant of ['country-position','country-club','club-club']) {
  const rowsPool = variant === 'club-club' ? clubAxes : countryAxes;
  const colPool = variant === 'country-position' ? positionAxes : variant==='country-club'?easyClubAxes:clubAxes;
  const pairMap = new Map(rowsPool.map(row => {
    const matching = players.filter(p => matches(p,row));
    return [row.id, new Set(colPool.filter(col => !(row.kind === col.kind && row.id === col.id) && matching.some(p => matches(p,col))).map(c => c.id))];
  }));
  const usefulRows = rowsPool.filter(r => pairMap.get(r.id).size >= 4);
  let made = 0;
  for (let attempt = 0; attempt < 120000 && made < desired; attempt++) {
    const rows = [];
    let compatible = colPool;
    for (let i = 0; i < 4; i++) {
      const choices = usefulRows.filter(r => !rows.includes(r) && compatible.filter(c => pairMap.get(r.id).has(c.id) && (variant !== 'club-club' || c.id !== r.id)).length >= 4);
      if (!choices.length) break;
      const row = choices[Math.floor(random() * choices.length)]; rows.push(row);
      compatible = compatible.filter(c => pairMap.get(row.id).has(c.id) && (variant !== 'club-club' || c.id !== row.id));
    }
    if (rows.length !== 4) continue;
    if (compatible.length < 4) continue;
    const columns = shuffle(compatible).slice(0,4);
    const signature = variant + ':' + rows.map(r=>r.id).sort().join(',') + ':' + columns.map(c=>c.id).sort().join(',');
    if (seen.has(signature)) continue;
    const board = {id: `${variant}-${made + 1}`, difficulty: variant === 'club-club' ? 'hard' : 'easy', variant, rows, columns};
    if (!solve(candidates(board,players))) continue;
    seen.add(signature); boards.push(board); made++;
  }
  console.log(`${variant}: ${made} solvable 4×4 boards`);
}
if (['country-position','country-club','club-club'].some(v=>!boards.some(b=>b.variant===v))) throw new Error('Insufficient official-match coverage: do not publish an unsolvable mode.');
const version = createHash('sha256').update(JSON.stringify({players,boards})).digest('hex').slice(0,16);
mkdirSync('data/football-grid', { recursive: true });
writeFileSync('data/football-grid/catalog.json', JSON.stringify({version,exportedAt:source.exportedAt,players,boards}));
const report = {exportedAt:source.exportedAt,version,totalPlayers:source.players.length,eligible:eligible.length,usable:players.length,legends:players.filter(p=>p.legend).length,europeanClubs:europeanIds.size,historicalClubs:historicalClubs.length,withOfficialClubEvidence:players.filter(p=>p.clubIds.length).length,withoutOfficialClubEvidence:players.filter(p=>!p.clubIds.length).map(p=>({id:p.id,name:p.name})),boards:boards.length,byVariant:Object.fromEntries(['country-position','country-club','club-club'].map(v=>[v,boards.filter(b=>b.variant===v).length]))};
writeFileSync('data/football-grid/audit.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({...report,withoutOfficialClubEvidence:report.withoutOfficialClubEvidence.length},null,2));
