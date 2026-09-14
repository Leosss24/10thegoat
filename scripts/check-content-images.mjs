/** One-off resource validation; never runs during a game. */
import fs from 'node:fs';
const b=JSON.parse(fs.readFileSync('data/badges/catalog.json'));const p=JSON.parse(fs.readFileSync('data/connections/puzzles.json'));
const urls=[...new Set([...b.clubs.map(c=>c.badge_url),...p.flatMap(p=>p.groups.flatMap(g=>g.members.map(m=>m.photo_url)))])];let index=0;const errors=[];
await Promise.all(Array.from({length:12},async()=>{while(index<urls.length){const url=urls[index++];try{const r=await fetch(url,{method:'HEAD',signal:AbortSignal.timeout(12000)});if(!r.ok||!r.headers.get('content-type')?.startsWith('image/'))errors.push({url,status:r.status,type:r.headers.get('content-type')});}catch(e){errors.push({url,error:e.message});}}}));
fs.writeFileSync('tmp/content-audit/image-check.json',JSON.stringify({checked:urls.length,errors},null,2));console.log('Checked',urls.length,'images; errors:',errors.length);console.log(errors.slice(0,12));
