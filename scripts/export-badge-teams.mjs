/** Read-only provider export. Requires API_FOOTBALL_KEY. Never writes to Supabase. */
import fs from 'node:fs';
const plan=JSON.parse(fs.readFileSync('data/badges/leagues.json','utf8'));
const cache='tmp/content-audit/provider-teams';fs.mkdirSync(cache,{recursive:true});
async function request(query,file){if(fs.existsSync(file))return JSON.parse(fs.readFileSync(file));const r=await fetch('https://v3.football.api-sports.io/teams?'+query,{headers:{'x-apisports-key':process.env.API_FOOTBALL_KEY}});const j=await r.json();if(!r.ok||Object.keys(j.errors||{}).length)throw Error(JSON.stringify(j.errors));fs.writeFileSync(file,JSON.stringify(j.response));return j.response;}
const results=[];
for(const league of plan){let season=league.season;let teams=await request(`league=${league.id}&season=${season}`,`${cache}/${league.id}-${season}.json`);if(!teams.length){season--;teams=await request(`league=${league.id}&season=${season}`,`${cache}/${league.id}-${season}.json`);}results.push({...league,season,teams});console.log(league.country,league.id,season,teams.length);}
for(const country of ['Guyana','Bahamas','Dominica','Saint-Kitts-And-Nevis','Saint-Lucia','Saint-Vincent-and-the-Grenadin','Liechtenstein']){const teams=await request('country='+encodeURIComponent(country),`${cache}/${country}.json`);results.push({country,season:null,id:null,name:'Country catalog',teams});console.log(country,teams.length);}
fs.writeFileSync('tmp/content-audit/team-results.json',JSON.stringify(results,null,2));
