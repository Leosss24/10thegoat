// Current European Career squads + legends -> guarded SQL and JSON preview.
// Reads Supabase export/API-Football only. Never writes to the remote database.
import { readFileSync,writeFileSync,mkdirSync,existsSync,readdirSync } from 'node:fs';
import { isGridCategory,isGridEuropeanCountry,GRID_LEGEND_ADDITIONS } from '../lib/football-grid/pool.ts';
const env=process.argv.find(a=>a.startsWith('--env='))?.slice(6);if(env)process.loadEnvFile(env);
if(!process.env.API_FOOTBALL_KEY)throw new Error('Configure API_FOOTBALL_KEY.');
const source=JSON.parse(readFileSync('tmp/football-grid-snapshot.json','utf8'));
const season=Number(process.argv.find(a=>a.startsWith('--season='))?.slice(9)??2026);
const budget=Number(process.argv.find(a=>a.startsWith('--max-requests='))?.slice(15)??300);
const day=new Date().toISOString().slice(0,10);
const cache='tmp/grid-api-cache';mkdirSync(cache,{recursive:true});
let requests=0,reads=0;
async function api(path,fresh=false){
  reads++;
  const file=`${cache}/${fresh?day+'_':''}${path.replace(/[^a-zA-Z0-9]/g,'_')}.json`;
  if(existsSync(file))return JSON.parse(readFileSync(file,'utf8'));
  if(requests>=budget)throw new Error('API budget reached. Re-run to resume cached extraction. No remote writes.');
  await new Promise(r=>setTimeout(r,550));requests++;
  const response=await fetch('https://v3.football.api-sports.io'+path,{headers:{'x-apisports-key':process.env.API_FOOTBALL_KEY},signal:AbortSignal.timeout(30000)});
  const data=await response.json();
  if(!response.ok||data.errors&&Object.keys(data.errors).length)throw new Error(`API failure at ${path}: HTTP ${response.status}; ${JSON.stringify(data.errors)}`);
  writeFileSync(file,JSON.stringify(data));return data;
}
const supported=p=>['api_football','api-football'].includes(p);
const countries=new Map(source.countries.map(c=>[c.id,c]));
const clubs=source.clubs.filter(c=>!c.is_national_team&&isGridCategory(c.career_category));
const european=clubs.filter(c=>isGridEuropeanCountry(countries.get(c.country_id)?.name));
if(european.length!==26)throw new Error(`Career categories changed (${european.length} European clubs); review the pool before export.`);
const playerMap=new Map(source.player_external_ids.filter(x=>supported(x.provider)).map(x=>[Number(x.external_id),x.player_id]));
const clubMap=new Map(source.club_external_ids.filter(x=>supported(x.provider)).map(x=>[Number(x.external_id),x.club_id]));
const compMap=new Map(source.competition_external_ids.filter(x=>supported(x.provider)).map(x=>[Number(x.external_id),x.competition_id]));
const clubApi=new Map([...clubMap].map(([api,id])=>[id,api]));
const profiles=new Map();
// Reuse previously fetched profiles; fresh team statistics below take precedence.
for(const file of readdirSync(cache).filter(f=>f.endsWith('.json'))){
  const data=JSON.parse(readFileSync(`${cache}/${file}`,'utf8'));
  for(const entry of data.response??[])if(entry.player?.id&&entry.player.nationality)profiles.set(entry.player.id,entry.player);
}
const rosters=[],squadPlayers=new Map();
for(const club of european){
  const external=clubApi.get(club.id);if(!external)throw new Error(`Missing club provider mapping: ${club.name}`);
  const path=`/players/squads?team=${external}`;
  const data=await api(path,true),squad=data.response?.find(r=>r.team?.id===external)?.players;
  if(!squad?.length)throw new Error(`Empty current roster for ${club.name}; do not fall back to stale membership.`);
  rosters.push({club_id:club.id,club_name:club.name,api_team_id:external,api_player_ids:squad.map(p=>p.id),source:'https://v3.football.api-sports.io'+path});
  for(const p of squad)squadPlayers.set(p.id,p);
  console.log(`Current squad: ${club.name} (${squad.length}).`);
}
const legendIds=new Set(source.players.filter(p=>p.is_legend).map(p=>p.id));
for(const extra of GRID_LEGEND_ADDITIONS){if(playerMap.get(extra.apiId)!==extra.id)throw new Error('Legend identity mismatch');legendIds.add(extra.id);}
const wantedApi=new Set([...squadPlayers.keys(),...[...playerMap].filter(([,id])=>legendIds.has(id)).map(([api])=>api)]);
const rawStats=new Map(),unknownStats=new Map();
function collect(entry){
  const p=entry.player;if(!wantedApi.has(p.id))return;
  if(p.nationality)profiles.set(p.id,p);
  for(const s of entry.statistics??[]){
    if(!(s.games?.appearences>0))continue;
    const club=clubMap.get(s.team.id),competition=compMap.get(s.league.id);
    if(!club||!competition){unknownStats.set(`${s.team.id}:${s.league.id}`,{club:s.team.name,competition:s.league.name});continue;}
    const row={api_player_id:p.id,club_id:club,competition_id:competition,season_start_year:s.league.season,appearances:s.games.appearences};
    rawStats.set([p.id,club,competition,row.season_start_year].join(':'),row);
  }
}
// Recent seasons give official-match evidence for current members, including
// Portugal, Netherlands and Turkey. Roster membership alone is never evidence.
for(const club of european){
  for(const year of [season,season-1]){
    const base=`/players?team=${clubApi.get(club.id)}&season=${year}`;
    const first=await api(base+'&page=1');for(const p of first.response??[])collect(p);
    for(let page=2;page<=(first.paging?.total??1);page++)for(const p of (await api(base+`&page=${page}`)).response??[])collect(p);
  }
  console.log(`Official statistics: ${club.name}; ${requests} new API requests.`);
}
// Explicit user examples: retrieve Álvarez's River/City seasons by canonical ID.
const alvarez=source.players.find(p=>/juli[aá]n [aá]lvarez/i.test(p.full_name??p.display_name));
const alvarezApi=[...playerMap].find(([,id])=>id===alvarez?.id)?.[0];
if(!alvarezApi)throw new Error('Julián Álvarez identity missing');
for(const year of [2021,2023])for(const entry of (await api(`/players?id=${alvarezApi}&season=${year}`)).response??[])collect(entry);
// River needs four DIFFERENT answers in a 4×4 grid. Recover official seasons of
// eligible alumni rather than admitting River's entire current squad.
for(const [internal,year] of [[803,2021],[1475,2025],[50,2004]]){
  const external=[...playerMap].find(([,id])=>id===internal)?.[0];
  if(external&&wantedApi.has(external))for(const entry of (await api(`/players?id=${external}&season=${year}`)).response??[])collect(entry);
}
// Eligible Palmeiras alumni: recover senior appearances before their European moves.
for(const [external,year] of [[414359,2024],[425733,2024],[643,2016],[377122,2023]]){
  if(wantedApi.has(external))for(const entry of (await api(`/players?id=${external}&season=${year}`)).response??[])collect(entry);
}
for(const external of wantedApi){
  const old=source.players.find(p=>p.id===playerMap.get(external));
  if(!profiles.has(external)&&!old?.nationality_country_id){
    for(const entry of (await api(`/players/profiles?player=${external}`)).response??[])if(entry.player?.id===external)profiles.set(external,entry.player);
  }
}
const originalIds=new Set(source.players.map(p=>p.id));
let nextId=Math.max(...originalIds),countryId=Math.max(...source.countries.map(c=>c.id));
const newPlayers=[],updates=[],unusable=[];
for(const external of [...wantedApi].sort((a,b)=>a-b)){
  const profile=profiles.get(external),squad=squadPlayers.get(external);
  let id=playerMap.get(external),player=source.players.find(p=>p.id===id);
  if(!player&&!profile?.nationality){unusable.push({api_id:external,name:squad?.name,reason:'missing_nationality'});continue;}
  if(!player){
    id=++nextId;playerMap.set(external,id);
    const name=profile.name||squad.name;
    player={id,display_name:name,game_name:null,full_name:null,nationality_country_id:null,primary_position:squad?.position||profile.position||null,photo_url:profile.photo||squad?.photo,is_legend:false,is_retired:false};
    source.players.push(player);source.player_external_ids.push({player_id:id,provider:'api_football',external_id:String(external)});
    newPlayers.push({id,external_id:external,display_name:name});
  }
  const nationality=profile?.nationality||countries.get(player.nationality_country_id)?.name;
  if(!nationality){unusable.push({api_id:external,id,name:player.display_name,reason:'missing_nationality'});continue;}
  updates.push({id,external_id:external,nationality,photo:profile?.photo||squad?.photo||player.photo_url,full_name:[profile?.firstname,profile?.lastname].filter(Boolean).join(' ')||player.full_name,position:player.primary_position||squad?.position||profile?.position});
  let country=source.countries.find(c=>c.name===nationality);
  if(!country){country={id:++countryId,name:nationality,code:null,flag_emoji:null};source.countries.push(country);}
  player.nationality_country_id ||= country.id;player.full_name ||= updates.at(-1).full_name;player.photo_url ||= updates.at(-1).photo;player.primary_position ||= updates.at(-1).position;
}
const rosterRows=rosters.flatMap(r=>r.api_player_ids.filter(id=>playerMap.has(id)).map(id=>({player_id:playerMap.get(id),club_id:r.club_id,season_start_year:season})));
source.currentRosters=rosters.map(r=>({...r,player_ids:r.api_player_ids.filter(id=>playerMap.has(id)).map(id=>playerMap.get(id))}));
source.gridLegendIds=[...legendIds];
const updateIds=new Set(updates.map(p=>p.id));
const stagedStats=[...rawStats.values()].filter(r=>playerMap.has(r.api_player_id)&&updateIds.has(playerMap.get(r.api_player_id))).map(({api_player_id,...r})=>({...r,player_id:playerMap.get(api_player_id)}));
for(const row of stagedStats){
  const old=source.player_season_stats.find(s=>s.player_id===row.player_id&&s.club_id===row.club_id&&s.competition_id===row.competition_id&&s.season_start_year===row.season_start_year);
  if(old)old.appearances??=row.appearances;else source.player_season_stats.push(row);
}
const meta=(await api('/countries')).response??[];
for(const c of source.countries){const m=meta.find(m=>m.name===c.name);if(m){c.code ||= m.code;c.flag_url=m.flag;}}
const json=x=>"'"+JSON.stringify(x).replaceAll("'","''")+"'::jsonb";
const sql=`-- Football Grid: current European Premium/Elite squads + agreed legends.\n-- Generated ${new Date().toISOString()}; NO remote writes have been performed.\n-- Planned new internal IDs are guarded: concurrent conflicting imports abort safely.\nbegin;\nlock table public.players,public.player_external_ids in share row exclusive mode;\ncreate temporary table grid_profile_import on commit drop as select * from jsonb_to_recordset(${json(updates)}) x(id bigint,external_id bigint,nationality text,photo text,full_name text,position text);\ncreate temporary table grid_new_players on commit drop as select * from jsonb_to_recordset(${json(newPlayers)}) x(id bigint,external_id bigint,display_name text);\ndo $$ begin\n if exists(select 1 from grid_new_players n join public.players p on p.id=n.id where not exists(select 1 from public.player_external_ids e where e.player_id=n.id and e.provider in ('api_football','api-football') and e.external_id=n.external_id::text)) or exists(select 1 from grid_new_players n join public.player_external_ids e on e.external_id=n.external_id::text and e.provider in ('api_football','api-football') where e.player_id<>n.id) then raise exception 'Grid ID allocation has changed. Re-export and regenerate; no data was changed.'; end if;\nend $$;\ninsert into public.players(id,display_name) select id,display_name from grid_new_players on conflict(id) do nothing;\ninsert into public.player_external_ids(player_id,provider,external_id) select id,'api_football',external_id::text from grid_new_players on conflict(player_id,provider) do nothing;\nselect setval(pg_get_serial_sequence('public.players','id'),greatest((select max(id) from public.players),(select last_value from public.players_id_seq)),true);\ninsert into public.countries(name) select distinct nationality from grid_profile_import where nationality is not null on conflict(name) do nothing;\nupdate public.players p set nationality_country_id=coalesce(p.nationality_country_id,c.id),full_name=coalesce(nullif(p.full_name,''),i.full_name),photo_url=coalesce(nullif(p.photo_url,''),i.photo),primary_position=coalesce(nullif(p.primary_position,''),i.position)\nfrom grid_profile_import i join public.countries c on c.name=i.nationality where p.id=i.id and exists(select 1 from public.player_external_ids e where e.player_id=p.id and e.provider in ('api_football','api-football') and e.external_id=i.external_id::text);\ninsert into public.player_season_stats(player_id,club_id,competition_id,season_start_year,appearances,source_provider,season_status,last_synced_at)\nselect x.player_id,x.club_id,x.competition_id,x.season_start_year,x.appearances,'api_football',case when x.season_start_year=${season} then 'current' else 'completed' end,now()\nfrom jsonb_to_recordset(${json(stagedStats)}) x(player_id bigint,club_id bigint,competition_id bigint,season_start_year integer,appearances integer) join grid_profile_import i on i.id=x.player_id\nwhere exists(select 1 from public.player_external_ids e where e.player_id=i.id and e.provider in ('api_football','api-football') and e.external_id=i.external_id::text)\non conflict(player_id,club_id,competition_id,season_start_year) do update set appearances=coalesce(player_season_stats.appearances,excluded.appearances);\n-- Current squad evidence; historical rows remain available.\ncreate temporary table grid_roster_import on commit drop as select * from jsonb_to_recordset(${json(rosterRows)}) x(player_id bigint,club_id bigint,season_start_year integer);\nupdate public.player_club_seasons set is_current=false where player_id in(select player_id from grid_roster_import) and is_current;\ninsert into public.player_club_seasons(player_id,club_id,season_start_year,is_current,source_provider,last_synced_at) select player_id,club_id,season_start_year,true,'api_football',now() from grid_roster_import\non conflict(player_id,club_id,season_start_year) do update set is_current=true,source_provider='api_football',last_synced_at=now();\ncommit;\n`;
writeFileSync('supabase/seeds/football_grid_data.sql',sql);
source.exportedAt=new Date().toISOString();
writeFileSync('tmp/football-grid-enriched.json',JSON.stringify(source));
const clubInfo=c=>({id:c.id,name:c.name,country:countries.get(c.country_id)?.name,category:c.career_category});
const pool={asOf:source.exportedAt,source:'https://www.api-football.com/documentation-v3#operation/get-players-squads',europeanClubs:european.map(clubInfo),historicalClubs:clubs.map(clubInfo),legendIds:[...legendIds],rosters:source.currentRosters};
writeFileSync('data/football-grid/pool.json',JSON.stringify(pool,null,2)+'\n');
const report={generatedAt:source.exportedAt,season,apiResponsesUsed:reads,newRequests:requests,europeanClubs:european.length,historicalClubs:clubs.length,currentSquadPlayers:squadPlayers.size,legends:legendIds.size,newPlayers:newPlayers.length,profiles:updates.length,officialStatRows:stagedStats.length,unusable,unknownStatMappings:[...unknownStats.values()],appliedToSupabase:false};
writeFileSync('data/football-grid/enrichment-audit.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({...report,unusable:unusable.length,unknownStatMappings:unknownStats.size},null,2));
