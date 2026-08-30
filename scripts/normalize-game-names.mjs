import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
if (!url || !key) { console.error("❌ Faltan variables de Supabase en .env.local"); process.exit(1); }
const supabase = createClient(url, key, { auth: { persistSession:false, autoRefreshToken:false } });
const auditPath=path.resolve('.import-state/game-name-audit.json');
if(!fs.existsSync(auditPath)){console.error('❌ No existe game-name-audit.json. Ejecuta primero: npm run audit:game-names');process.exit(1);}
const audit=JSON.parse(fs.readFileSync(auditPath,'utf8'));
const rows=audit.players??[];
const unsafe=rows.filter(r=>r.status!=='SAFE');
if(!rows.length){console.error('❌ La auditoría está vacía.');process.exit(1);}
if(unsafe.length){
 console.error(`❌ Normalización cancelada: quedan ${unsafe.length} casos REVIEW/EXCLUDE.`);
 for(const r of unsafe.slice(0,20)) console.error(`- [${r.status}] ${r.display_name} → ${r.proposed||'(vacío)'}`);
 console.error('\nCorrige/audita primero. No se ha escrito nada en Supabase.'); process.exit(1);
}
console.log(`\nSe van a normalizar ${rows.length} jugadores usando la auditoría aprobada.`);
console.log('Solo se actualizará players.game_name. Ninguna otra columna será modificada.\n');
let ok=0;
for(const r of rows){
 const {error}=await supabase.from('players').update({game_name:r.proposed}).eq('id',r.player_id);
 if(error){console.error(`❌ ${r.display_name}: ${error.message}`);process.exit(1);}
 ok++;
 if(ok%50===0||ok===rows.length) console.log(`✅ ${ok}/${rows.length}`);
}
console.log(`\n🎉 Normalización completada: ${ok}/${rows.length}`);
console.log('Campo modificado: players.game_name');
console.log('No se ha borrado ningún jugador ni se han tocado estadísticas, clubes, fotos o IDs.');
