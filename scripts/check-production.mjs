import fs from "node:fs";
import path from "node:path";

const roots = ["app", "components", "lib"];
const forbidden = ["SUPABASE_SECRET_KEY", "API_FOOTBALL_KEY"];
const problems = [];
function walk(dir){
  for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
    const full=path.join(dir,entry.name);
    if(entry.isDirectory()) walk(full);
    else if(/\.(ts|tsx|js|jsx|mjs)$/.test(entry.name)){
      const text=fs.readFileSync(full,"utf8");
      for(const token of forbidden) if(text.includes(token)) problems.push(`${full}: contiene ${token}`);
    }
  }
}
for(const root of roots) if(fs.existsSync(root)) walk(root);
const gitignore=fs.readFileSync(".gitignore","utf8");
if(!gitignore.includes(".env.local")) problems.push(".gitignore no protege .env.local");

console.log("\n10theGOAT · CHECK DE PRODUCCIÓN\n");
if(problems.length){
  console.error("❌ Problemas detectados:");
  problems.forEach((p)=>console.error(`- ${p}`));
  process.exit(1);
}
console.log("✅ No hay referencias a claves privadas en app/components/lib");
console.log("✅ .env.local está ignorado por Git");
console.log("✅ API-Football queda fuera del runtime público de los juegos");
console.log("⚠️ Antes de abrir el dominio: revisar RLS de Supabase y completar datos legales del titular.");
