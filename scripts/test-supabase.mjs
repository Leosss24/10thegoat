import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  console.error("❌ Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY en .env.local");
  process.exit(1);
}

const supabase = createClient(url, anonKey);

console.log("🐐 Probando conexión de 10 The GOAT con Supabase...\n");

const checks = ["countries", "clubs", "competitions", "players"];
let ok = true;

for (const table of checks) {
  const { error } = await supabase.from(table).select("*", { count: "exact", head: true });
  if (error) {
    ok = false;
    console.log(`❌ ${table}: ${error.message}`);
  } else {
    console.log(`✅ ${table}`);
  }
}

if (!ok) {
  console.error("\nLa conexión funciona, pero faltan tablas o permisos. Comprueba que ejecutaste la migración SQL completa.");
  process.exit(1);
}

console.log("\n✅ Supabase está conectado y el esquema principal responde correctamente.");
