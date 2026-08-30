import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
if (!url || !key) { console.error("❌ Faltan variables de Supabase en .env.local"); process.exit(1); }
const supabase = createClient(url, key, { auth: { persistSession:false, autoRefreshToken:false } });
const OUT_DIR=path.resolve('.import-state');
const JSON_PATH=path.join(OUT_DIR,'game-name-audit.json');
const CSV_PATH=path.join(OUT_DIR,'game-name-audit.csv');

function clean(v=''){ return (v??'').trim().replace(/\s+/g,' '); }
function stripAccentsKeepSpecial(v='') {
  return v.replace(/Ñ/g,'__ENYE__').replace(/ñ/g,'__enye__').replace(/Ç/g,'__CEDI__').replace(/ç/g,'__cedi__')
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .replace(/__ENYE__/g,'Ñ').replace(/__enye__/g,'ñ').replace(/__CEDI__/g,'Ç').replace(/__cedi__/g,'ç')
    .replace(/Ł/g,'L').replace(/ł/g,'l').replace(/Đ/g,'D').replace(/đ/g,'d').replace(/Ø/g,'O').replace(/ø/g,'o')
    .replace(/Æ/g,'AE').replace(/æ/g,'ae').replace(/Œ/g,'OE').replace(/œ/g,'oe');
}
function norm(v='') { return stripAccentsKeepSpecial(v).toUpperCase().replace(/[’'`´.]/g,'').replace(/[‐‑‒–—]/g,'-').replace(/\s+/g,' ').replace(/[^A-ZÑÇ -]/g,'').replace(/-+/g,'-').trim(); }
function letters(v=''){ return v.replace(/[ -]/g,'').length; }
function initialDisplay(v){ return /^(?:[A-Za-zÀ-ÿÑñÇç]\.)\s+.+$/.test(v); }
function afterInitial(v){ return v.match(/^(?:[A-Za-zÀ-ÿÑñÇç]\.)\s+(.+)$/)?.[1] ?? ''; }
const particles=new Set(['DA','DAS','DE','DEL','DELLA','DI','DO','DOS','DU','VAN','VON','DER','DEN','TEN','TER','LA','LE','EL']);
const explicitOverrides = new Map([
  ['JON ANDER OLASAGASTI', 'OLASAGASTI'],
  ['Í. BERGMANN JÓHANNESSON', 'BERGMANN'],
  ['XAVI HERNANDEZ', 'XAVI'],
]);
const duplicateAnswersAllowed = new Set(['BELLINGHAM','PAVLOVIC','RAMOS','FERNANDEZ']);
const duplicateAnswersUseGivenName = new Set(['GARCIA','DIAZ','HERNANDEZ']);
function displayFootballName(display){
  if (!display) return '';
  if (initialDisplay(display)) return afterInitial(display); // K. Dewsbury-Hall => Dewsbury-Hall
  const w=display.split(/\s+/);
  if (w.length===1) return display; // Fermín, Neymar, Rodri
  // First token is normally given name. Preserve known surname particles and multi-token surname shown by provider.
  let start=w.length-1;
  for(let i=1;i<w.length-1;i++) if(particles.has(norm(w[i]))) { start=i; break; }
  // Three-part names such as Daniel Heuer Fernandes: provider display itself is the football-facing form.
  if(w.length>=3 && start===w.length-1) start=1;
  return w.slice(start).join(' ');
}
function propose(player){
  const display=clean(player.display_name), last=clean(player.last_name), full=clean(player.full_name);
  const override = explicitOverrides.get(display.toUpperCase());
  let raw=override || displayFootballName(display), source=override?'explicit_football_override':'display_name_football_form', reasons=[];
  if(!raw && last){raw=last;source='last_name';}
  if(!raw && full){raw=displayFootballName(full);source='full_name_fallback';reasons.push('solo full_name; revisar');}
  let proposed=norm(raw);
  const n=letters(proposed);
  if(!proposed) reasons.push('sin propuesta utilizable');
  if(n<3) reasons.push('menos de 3 letras');
  if(n>14) reasons.push('más de 14 letras');
  let status=(!proposed||n<3||n>14)?'EXCLUDE':(reasons.length?'REVIEW':'SAFE');
  return {proposed,source,reasons,status};
}
function csvCell(v){const t=Array.isArray(v)?v.join(' | '):String(v??'');return `"${t.replaceAll('"','""')}"`;}
async function fetchAll(){let rows=[],from=0;while(true){const {data,error}=await supabase.from('players').select('id,display_name,full_name,first_name,last_name,game_name,is_active,is_retired').order('id',{ascending:true}).range(from,from+999);if(error){console.error('❌ Error leyendo players:',error.message);process.exit(1);}rows.push(...(data??[]));if(!data||data.length<1000)break;from+=1000;}return rows;}
const players=await fetchAll();
const audited=players.map(p=>({player_id:p.id,display_name:p.display_name,full_name:p.full_name,first_name:p.first_name,last_name:p.last_name,current_game_name:p.game_name,is_active:p.is_active,is_retired:p.is_retired,...propose(p)}));
// Duplicate answers are handled by football-facing rules rather than database uniqueness.
// BELLINGHAM/PAVLOVIC can legitimately be the same answer. GARCIA/DIAZ are disambiguated with given name.
const groups=new Map(); for(const r of audited){if(!r.proposed)continue;const a=groups.get(r.proposed)??[];a.push(r);groups.set(r.proposed,a);}
for(const [name,rows] of groups){
  if(rows.length<2) continue;
  if(duplicateAnswersAllowed.has(name)) {
    for(const r of rows) r.reasons.push(`respuesta duplicada permitida (${rows.length} jugadores): ${name}`);
    continue;
  }
  if(duplicateAnswersUseGivenName.has(name)) {
    for(const r of rows){
      const given=norm(clean(r.first_name));
      if(given){
        r.proposed=`${given} ${name}`;
        r.source='duplicate_given_name_disambiguated';
        r.reasons.push(`apellido duplicado; se usa nombre + apellido: ${r.proposed}`);
        if(r.status==='REVIEW') r.status='SAFE';
      } else {
        r.reasons.push(`apellido duplicado sin first_name fiable; revisar: ${name}`);
        r.status='REVIEW';
      }
    }
    continue;
  }
  const displays=new Set(rows.map(r=>norm(r.display_name)));
  if(displays.size===1) { for(const r of rows) r.reasons.push(`duplicado equivalente permitido (${rows.length} filas): ${name}`); continue; }
  for(const r of rows){
    r.reasons.push(`apellido duplicado entre jugadores distintos; revisar: ${name}`);
    if(r.status==='SAFE') r.status='REVIEW';
  }
}
for(const r of audited){ if(r.current_game_name){r.reasons.push('game_name ya tiene valor; auditoría no lo modifica'); if(norm(r.current_game_name)!==r.proposed)r.status='REVIEW';} }
const order={REVIEW:0,EXCLUDE:1,SAFE:2}; audited.sort((a,b)=>order[a.status]-order[b.status]||a.display_name.localeCompare(b.display_name));
fs.mkdirSync(OUT_DIR,{recursive:true});fs.writeFileSync(JSON_PATH,JSON.stringify({generated_at:new Date().toISOString(),total:audited.length,players:audited},null,2));
const headers=['player_id','status','display_name','full_name','first_name','last_name','current_game_name','proposed','source','is_active','is_retired','reasons'];
fs.writeFileSync(CSV_PATH,'\uFEFF'+[headers.map(csvCell).join(','),...audited.map(r=>headers.map(k=>csvCell(r[k])).join(','))].join('\n'),'utf8');
const counts=audited.reduce((a,r)=>(a[r.status]=(a[r.status]??0)+1,a),{});
console.log('\n══════════════════════════════════════════════════');console.log('AUDITORÍA · GAME NAMES v5 (SOLO LECTURA)');console.log('══════════════════════════════════════════════════');
console.log(`Jugadores analizados: ${audited.length}`);console.log(`✅ SAFE:    ${counts.SAFE??0}`);console.log(`⚠️ REVIEW:  ${counts.REVIEW??0}`);console.log(`⛔ EXCLUDE: ${counts.EXCLUDE??0}`);
console.log(`\nCSV:  ${CSV_PATH}\nJSON: ${JSON_PATH}`);console.log('\nReglas v4:\n- N. Apellido → APELLIDO\n- Apellidos con guión conservan el guión\n- DEL PIERO / VAN DIJK / DE BRUYNE conservan espacios\n- No añade segundo apellido desde last_name por defecto\n- Nombre futbolístico de una palabra se conserva (FERMÍN)\n- Ñ y Ç son letras reales\n- BELLINGHAM, PAVLOVIC, RAMOS y FERNANDEZ pueden repetirse como respuesta\n- GARCIA, DIAZ y HERNANDEZ se desambiguan con nombre + apellido\n- Excepciones: Xavi Hernandez → XAVI; Jon Ander Olasagasti → OLASAGASTI; Í. Bergmann Jóhannesson → BERGMANN');
console.log('\n🔒 No se ha escrito, actualizado ni borrado ningún registro de Supabase.');console.log('\nPrimeros casos a revisar:');for(const r of audited.filter(x=>x.status!=='SAFE').slice(0,30))console.log(`- [${r.status}] ${r.display_name} → ${r.proposed||'(vacío)'} :: ${r.reasons.join('; ')}`);
