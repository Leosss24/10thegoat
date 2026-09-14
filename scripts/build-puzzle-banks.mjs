/** Build immutable game banks from public player identities and the verified Grid catalog. */
import fs from 'node:fs';
import {translatedCountry} from '../lib/football/country-i18n.ts';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));const write=(p,x)=>fs.writeFileSync(p,JSON.stringify(x,null,2)+'\n');
const raw=read('tmp/content-audit/players.json');
const identities=raw.map(p=>({id:p.id,display_name:p.display_name.trim(),photo_url:p.photo_url,aliases:[...new Set([p.full_name,p.display_name].filter(Boolean))]}));
write('data/players/catalog.json',{version:1,exportedAt:new Date().toISOString(),source:'players.display_name / players.photo_url',players:identities});
const byId=new Map(identities.map(p=>[p.id,p]));const catalog=read('data/football-grid/catalog.json');const clubs=read('tmp/content-audit/clubs.json');
const excludedPhotos=new Set(read('data/connections/photo-audit.json').excludedPlayerIds);
const players=catalog.players.filter(p=>!excludedPhotos.has(p.id)&&byId.get(p.id)?.photo_url&&byId.get(p.id)?.display_name);
const tri=(es,en,fr)=>({es,en,fr});const name=id=>byId.get(id).display_name.toUpperCase();
let seed=20260911;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
const shuffle=a=>{a=[...a];for(let i=a.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;};
const rules=[];const add=(id,kind,title,reason,predicate)=>{const pool=players.filter(predicate).map(p=>p.id);if(pool.length>=4)rules.push({id,kind,title,reason,playerIds:pool,source:'https://www.api-football.com/documentation-v3#tag/Players',catalogVersion:catalog.version});};
const clubIds=[...new Set(players.flatMap(p=>p.clubIds))];
for(const id of clubIds){const club=clubs.find(c=>String(c.id)===id);if(!club)continue;add('club-'+id,'club',tri('PASARON POR '+club.name,'PLAYED FOR '+club.name,'ONT JOUÉ À '+club.name),tri(`Los cuatro jugaron en ${club.name} durante su carrera; no necesariamente al mismo tiempo.`,`All four played for ${club.name} during their careers, not necessarily at the same time.`,`Tous les quatre ont joué à ${club.name} au cours de leur carrière, pas nécessairement ensemble.`),p=>p.clubIds.includes(id));}
for(const nation of [...new Set(players.map(p=>p.countryId))].filter(Boolean)){
const n=Object.fromEntries(['es','en','fr'].map(l=>[l,translatedCountry(nation,l)]));
add('nation-'+nation,'nation',tri('NACIONALIDAD: '+n.es,'NATIONALITY: '+n.en,'NATIONALITÉ : '+n.fr),tri(`País en común: ${n.es}.`,`Shared nationality: ${n.en}.`,`Nationalité commune : ${n.fr}.`),p=>p.countryId===nation);
for(const id of clubIds){const club=clubs.find(c=>String(c.id)===id);if(!club)continue;add(`nation-club-${nation}-${id}`,'nation-club',tri(`${n.es} · ${club.name}`,`${n.en} · ${club.name}`,`${n.fr} · ${club.name}`),tri(`País en común: ${n.es}. Los cuatro jugaron en ${club.name}.`,`Shared nationality: ${n.en}. All four played for ${club.name}.`,`Nationalité commune : ${n.fr}. Les quatre ont joué à ${club.name}.`),p=>p.countryId===nation&&p.clubIds.includes(id));}
}
for(let a=0;a<clubIds.length;a++)for(let b=a+1;b<clubIds.length;b++){const x=clubs.find(c=>String(c.id)===clubIds[a]),y=clubs.find(c=>String(c.id)===clubIds[b]);if(!x||!y)continue;add(`two-clubs-${x.id}-${y.id}`,'two-clubs',tri(`${x.name} + ${y.name}`,`${x.name} + ${y.name}`,`${x.name} + ${y.name}`),tri(`Los cuatro jugaron tanto en ${x.name} como en ${y.name}.`,`All four played for both ${x.name} and ${y.name}.`,`Tous les quatre ont joué à ${x.name} et à ${y.name}.`),p=>p.clubIds.includes(String(x.id))&&p.clubIds.includes(String(y.id)));}
const sets=new Map(rules.map(r=>[r.id,new Set(r.playerIds)]));const used=new Set();const puzzles=[];
for(let i=0;i<20;i++){
let chosen;
for(let attempt=0;attempt<10000;attempt++){
 const available=shuffle(rules.filter(r=>!used.has(r.id)));
 const rs=available.slice(0,4);
 if(new Set(rs.map(r=>r.kind)).size<2)continue;
 const pools=rs.map(r=>r.playerIds.filter(id=>rs.every(other=>other.id===r.id||!sets.get(other.id).has(id))));
 if(pools.some(p=>p.length<4))continue;
 chosen=rs.map((r,j)=>({...r,members:shuffle(pools[j].sort((a,b)=>a-b).slice(0,20)).slice(0,4).map(id=>({id:'player-'+id,playerId:id,label:name(id),photo_url:byId.get(id).photo_url}))}));break;
}
if(!chosen)throw Error('Not enough disjoint relation groups for board '+i);
for(const r of chosen)used.add(r.id);
puzzles.push({id:`connections-${String(i+1).padStart(3,'0')}`,groups:chosen.map(({playerIds,...g})=>g)});
}
write('data/connections/puzzles.json',puzzles);write('data/connections/relations.json',rules);
const legacy=read('data/odd-one-out/legacy.json');
const normalize=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
const alias=new Map();for(const p of identities)for(const s of p.aliases)alias.set(normalize(s),p);
for(const item of legacy){for(const option of item.options){const p=alias.get(normalize(option.label));if(p){option.playerId=p.id;option.label=name(p.id);}else option.label=option.label.toUpperCase();}}
const keys=new Set(legacy.map(c=>c.options.map(o=>o.id).sort().join('|')));const additions=[];
for(const r of shuffle(rules)){
if(legacy.length+additions.length>=100)break;
const inside=shuffle([...r.playerIds].sort((a,b)=>a-b).slice(0,20)).slice(0,3);
// A verified nationality excludes the outsider positively. Club-only outsiders can have incomplete career data.
if(!['nation','nation-club'].includes(r.kind))continue;
const nationality=players.find(p=>p.id===inside[0]).countryId;
const outsiders=players.filter(p=>p.countryId&&p.countryId!==nationality&&!r.playerIds.includes(p.id)).sort((a,b)=>a.id-b.id).slice(0,60);
if(!outsiders.length)continue;const odd=shuffle(outsiders)[0];const ids=[...inside,odd.id];const key=ids.slice().sort().join('|');if(keys.has(key))continue;keys.add(key);
const [a,b,c]=inside.map(name);const outsider=name(odd.id);const n=Object.fromEntries(['es','en','fr'].map(l=>[l,translatedCountry(odd.countryId,l)]));
additions.push({id:`expanded-${String(additions.length+1).padStart(3,'0')}`,difficulty:additions.length%2?'hard':'easy',category:r.kind==='nation'?tri('Nacionalidades','Nationalities','Nationalités'):tri('Trayectorias internacionales','International careers','Parcours internationaux'),options:ids.map(id=>({id:'player-'+id,playerId:id,label:name(id)})),oddOptionId:'player-'+odd.id,commonReason:tri(`${a}, ${b} y ${c}: ${r.reason.es.replace('Los cuatro','Los tres')}`,`${a}, ${b} and ${c}: ${r.reason.en.replace('All four','All three')}`,`${a}, ${b} et ${c} : ${r.reason.fr.replace('Les quatre','Les trois')}`),oddReason:tri(`${outsider} figura con otra nacionalidad (${n.es}) y no cumple esta conexión.`,`${outsider} has a different nationality (${n.en}) and does not fit this connection.`,`${outsider} a une autre nationalité (${n.fr}) et ne correspond pas à ce lien.`),source:r.source,relationId:r.id});
}
if(legacy.length+additions.length<100)throw Error('Only '+(legacy.length+additions.length)+' odd challenges');
write('data/odd-one-out/challenges.json',[...legacy,...additions]);
console.log({players:identities.length,relations:rules.length,connections:puzzles.length,uniqueGroups:used.size,odd:legacy.length+additions.length});
