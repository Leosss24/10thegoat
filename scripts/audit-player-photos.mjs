/** Read-only portrait audit. Run after export-game-catalogs and before building puzzle banks. */
import fs from 'node:fs';
import crypto from 'node:crypto';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8').replace(/^\uFEFF/,''));
const audit=read('data/connections/photo-audit.json');
const generic=new Set(audit.placeholderHashes);
const identities=new Map(read('tmp/content-audit/players.json').map(p=>[p.id,p]));
const players=read('data/football-grid/catalog.json').players.map(p=>identities.get(p.id)).filter(p=>p?.photo_url);
let index=0;const excluded=[];
await Promise.all(Array.from({length:10},async()=>{while(index<players.length){const p=players[index++];const r=await fetch(p.photo_url,{signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error(`Photo ${p.id}: HTTP ${r.status}`);const hash=crypto.createHash('sha256').update(Buffer.from(await r.arrayBuffer())).digest('hex');if(generic.has(hash))excluded.push(p.id);}}));
fs.writeFileSync('data/connections/photo-audit.json',JSON.stringify({...audit,checkedAt:new Date().toISOString(),checked:players.length,excludedPlayerIds:excluded.sort((a,b)=>a-b)},null,2)+'\n');
console.log('Photos checked:',players.length,'generic portraits excluded:',excluded.length);
