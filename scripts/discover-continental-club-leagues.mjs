import { mkdir, writeFile } from "node:fs/promises";

const API_BASE="https://v3.football.api-sports.io",apiKey=process.env.API_FOOTBALL_KEY;
if(!apiKey)throw new Error("Falta API_FOOTBALL_KEY en .env.local");
const EUROPE=new Set(["Albania","Andorra","Armenia","Austria","Azerbaijan","Belarus","Belgium","Bosnia","Bulgaria","Croatia","Cyprus","Czech-Republic","Denmark","England","Estonia","Faroe-Islands","Finland","France","Georgia","Germany","Gibraltar","Greece","Hungary","Iceland","Ireland","Israel","Italy","Kazakhstan","Kosovo","Latvia","Lithuania","Luxembourg","Malta","Moldova","Montenegro","Netherlands","North-Macedonia","Northern-Ireland","Norway","Poland","Portugal","Romania","Russia","San-Marino","Scotland","Serbia","Slovakia","Slovenia","Spain","Sweden","Switzerland","Turkey","Ukraine","Wales"]);
const SOUTH_AMERICA=new Set(["Argentina","Bolivia","Brazil","Chile","Colombia","Ecuador","Paraguay","Peru","Uruguay","Venezuela"]);
const excluded=/women|frauen|femeni|femin|u-?\d+|youth|junior|reserve|amateur|regional|cup|copa|play.?off|non league|intermediate|rfe[f]?|summer series|championship round|\bgroup\b/i;
const second=/segunda|second|2\.?\s*(bundes|liga|division)|serie b|ligue 2|championship|challenger|eerste divisie|primera nacional|b nacional|division profesional.*b/i;
const first=/premier|primera divis|first division|serie a|bundesliga$|ligue 1|la liga$|eredivisie|super lig|superliga|primeira liga|pro league|division profesional$|categoria primera a/i;
const VERIFIED={Ireland:[357,358],Russia:[235,236],Chile:[265,266],Denmark:[119,120],Croatia:[210,211],Argentina:[128,129],Ecuador:[242,243],Bulgaria:[172,173],Cyprus:[318,319],Montenegro:[355,356]};
const response=await fetch(`${API_BASE}/leagues?current=true`,{headers:{"x-apisports-key":apiKey}});
if(!response.ok)throw new Error(`API-Football HTTP ${response.status}`);
const payload=await response.json();if(Object.keys(payload.errors??{}).length)throw new Error(JSON.stringify(payload.errors));
const leagues=(payload.response??[]).filter(x=>x.league?.type==="League"&&(EUROPE.has(x.country?.name)||SOUTH_AMERICA.has(x.country?.name))&&!excluded.test(x.league.name)).map(x=>{
  const tier=second.test(x.league.name)?2:first.test(x.league.name)?1:null;
  const verified=VERIFIED[x.country.name];
  const current=x.seasons?.find(s=>s.current)??x.seasons?.at(-1);
  return {country:x.country.name,continent:EUROPE.has(x.country.name)?"Europe":"South America",id:x.league.id,name:x.league.name,season:current?.year??null,tier:verified?.includes(x.league.id)?verified.indexOf(x.league.id)+1:tier,selected:false};
});
for(const country of new Set(leagues.map(x=>x.country)))for(const tier of [1,2]){
  const candidates=leagues.filter(x=>x.country===country&&x.tier===tier).sort((a,b)=>(b.season??0)-(a.season??0)||a.name.length-b.name.length);
  if(candidates.length)candidates[0].selected=true;
}
leagues.sort((a,b)=>a.continent.localeCompare(b.continent)||a.country.localeCompare(b.country)||(a.tier??9)-(b.tier??9)||a.name.localeCompare(b.name));
await mkdir("tmp",{recursive:true});
await writeFile("tmp/api-football-club-import-plan.json",JSON.stringify({generatedAt:new Date().toISOString(),provider:"api_football",reviewRequired:true,leagues},null,2));
console.log(`✓ Plan generado: tmp/api-football-club-import-plan.json`);
console.log(`  ${leagues.length} ligas candidatas · ${leagues.filter(x=>x.selected).length} sugeridas como primera/segunda`);
console.log("  Revisa tier y selected antes de ejecutar la importación.");
