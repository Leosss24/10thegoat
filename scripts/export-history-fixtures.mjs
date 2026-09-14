/** Read-only fixture cache used to build chronological, club-themed challenges. */
import fs from 'node:fs';
fs.mkdirSync('tmp/content-audit/fixtures',{recursive:true});
for(let season=2013;season<=2024;season++){
 const path=`tmp/content-audit/fixtures/champions-${season}.json`;if(fs.existsSync(path))continue;
 const r=await fetch(`https://v3.football.api-sports.io/fixtures?league=2&season=${season}`,{headers:{'x-apisports-key':process.env.API_FOOTBALL_KEY}});const j=await r.json();if(!r.ok||Object.keys(j.errors||{}).length)throw Error(JSON.stringify(j.errors));fs.writeFileSync(path,JSON.stringify(j.response));console.log(season,j.response.length);
}
