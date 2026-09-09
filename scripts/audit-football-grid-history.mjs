// Read-only career audit: discover missing allowed clubs, then verify official appearances.
import {readFileSync,writeFileSync,existsSync,mkdirSync,readdirSync} from 'node:fs';
const env=process.argv.find(a=>a.startsWith('--env='))?.slice(6);if(env)process.loadEnvFile(env);
const source=JSON.parse(readFileSync('tmp/football-grid-enriched.json','utf8'));
const catalog=JSON.parse(readFileSync('data/football-grid/catalog.json','utf8'));
const pool=JSON.parse(readFileSync('data/football-grid/pool.json','utf8'));
const supported=p=>['api_football','api-football'].includes(p);
const playerApi=new Map(source.player_external_ids.filter(x=>supported(x.provider)).map(x=>[x.player_id,Number(x.external_id)]));
const clubMap=new Map(source.club_external_ids.filter(x=>supported(x.provider)&&pool.historicalClubs.some(c=>c.id===x.club_id)).map(x=>[Number(x.external_id),x.club_id]));
const cache='tmp/grid-api-cache';mkdirSync(cache,{recursive:true});
const allowedLeagues=new Set([140,39,135,78,61,94,88,203,128,71,268,265,239,242,250,269,270,2,3,848,15,13,11,12,143,45,48,81,137,66,96,90,206,130,73,531,97,528,1032,65]);
// Explicit official senior leagues/cups only. Unknown competitions remain unresolved.
// Retain previously verified facts when auditing an already corrected catalog.
const previousFacts=existsSync('data/football-grid/api-appearances.json')?JSON.parse(readFileSync('data/football-grid/api-appearances.json','utf8')):[];
const facts=new Map(previousFacts.map(f=>[`${f.playerId}:${f.clubId}`,f])),unresolved=[],reviewed=[],unknownCompetitions=new Map();
let requests=0;
async function api(path){
  const file=`${cache}/${path.replace(/[^a-zA-Z0-9]/g,'_')}.json`;
  if(existsSync(file)){try{return JSON.parse(readFileSync(file,'utf8'));}catch{}}
  // This project's provider limit is 300/minute; remain below 240/minute.
  await new Promise(r=>setTimeout(r,250));
  const response=await fetch('https://v3.football.api-sports.io'+path,{headers:{'x-apisports-key':process.env.API_FOOTBALL_KEY},signal:AbortSignal.timeout(30000)});
  const data=await response.json();requests++;
  if(!response.ok||data.errors&&Object.keys(data.errors).length)throw new Error(`API failed: ${path}: ${JSON.stringify(data.errors)}`);
  writeFileSync(file,JSON.stringify(data));return data;
}
function collect(entry,path){
  const player=catalog.players.find(p=>playerApi.get(p.id)===entry.player?.id);if(!player)return;
  for(const stat of entry.statistics??[]){
    const clubId=clubMap.get(stat.team?.id);
    if(!clubId || player.clubIds.includes(String(clubId)) || !(stat.games?.appearences>0))continue;
    if(!allowedLeagues.has(stat.league?.id)){unknownCompetitions.set(stat.league?.id,stat.league?.name);continue;}
    const key=`${player.id}:${clubId}`;
    if(!facts.has(key))facts.set(key,{playerId:player.id,playerName:player.name,apiPlayerId:entry.player.id,clubId,clubName:stat.team.name,apiClubId:stat.team.id,competition:stat.league.name,apiCompetitionId:stat.league.id,season:stat.league.season,appearances:stat.games.appearences,source:'https://v3.football.api-sports.io'+path});
  }
}
// Existing cached responses can already prove omissions; reuse them before new requests.
for(const file of readdirSync(cache).filter(f=>f.endsWith('.json'))){
  let data;try{data=JSON.parse(readFileSync(`${cache}/${file}`,'utf8'));}catch{continue;}
  if(data.get!=='players')continue;
  const path='/players?'+new URLSearchParams(data.parameters).toString();
  for(const entry of data.response??[])collect(entry,path);
}
function save(){
  writeFileSync('data/football-grid/api-appearances.json',JSON.stringify([...facts.values()].sort((a,b)=>a.playerId-b.playerId||a.clubId-b.clubId),null,2)+'\n');
  writeFileSync('data/football-grid/history-audit.json',JSON.stringify({auditedAt:new Date().toISOString(),catalogVersion:catalog.version,totalPlayers:catalog.players.length,reviewedPlayers:reviewed.length,newRequests:requests,confirmedMissingPairs:facts.size,affectedPlayers:new Set([...facts.values()].map(f=>f.playerId)).size,unresolved,unknownCompetitions:[...unknownCompetitions].map(([id,name])=>({id,name})),reviewed},null,2)+'\n');
}
try{
  for(const player of catalog.players){
    const external=playerApi.get(player.id);
    if(!external){unresolved.push({playerId:player.id,reason:'missing_provider_identity'});continue;}
    const teams=(await api(`/players/teams?player=${external}`)).response??[];
    let missing=0;
    for(const team of teams){
      const clubId=clubMap.get(team.team?.id);
      if(!clubId||player.clubIds.includes(String(clubId)))continue;
      missing++;
      const key=`${player.id}:${clubId}`;
      for(const year of [...team.seasons].sort((a,b)=>b-a)){
        if(facts.has(key))break;
        const path=`/players?id=${external}&season=${year}`;
        for(const entry of (await api(path)).response??[])collect(entry,path);
      }
      if(!facts.has(key))unresolved.push({playerId:player.id,playerName:player.name,clubId,clubName:team.team.name,seasons:team.seasons,reason:'no_verified_official_appearance'});
    }
    reviewed.push({playerId:player.id,teams:teams.length,missingAllowedClubs:missing});
    if(reviewed.length%25===0){save();console.log(JSON.stringify({reviewed:reviewed.length,total:catalog.players.length,confirmed:facts.size,requests}));}
  }
}finally{save();}
console.log(JSON.stringify({complete:reviewed.length===catalog.players.length,reviewed:reviewed.length,confirmed:facts.size,affectedPlayers:new Set([...facts.values()].map(f=>f.playerId)).size,unresolved:unresolved.length,requests}));
