const API_BASE = "https://v3.football.api-sports.io";
const apiKey = process.env.API_FOOTBALL_KEY;
const MESSI_API_ID = 154;
const SEASON = 2018;

if (!apiKey) {
  console.error("❌ Falta API_FOOTBALL_KEY en .env.local");
  process.exit(1);
}

async function apiGet(path) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { "x-apisports-key": apiKey },
  });
  const data = await response.json();

  if (!response.ok) throw new Error(`API-Football respondió ${response.status}`);
  if (data?.errors && Object.keys(data.errors).length > 0) {
    throw new Error(`API-Football devolvió errores: ${JSON.stringify(data.errors)}`);
  }
  return data;
}

function value(v) {
  return v === null || v === undefined || v === "" ? "-" : v;
}

async function main() {
  console.log(`🐐 10 The GOAT · Diagnóstico Messi ${SEASON}`);
  console.log("ℹ️ Solo lectura: NO escribe nada en Supabase.\n");

  const data = await apiGet(`/players?id=${MESSI_API_ID}&season=${SEASON}`);
  const entry = data.response?.[0];
  const stats = entry?.statistics ?? [];

  console.log(`API-Football devolvió ${stats.length} bloques.\n`);

  const signatures = new Map();

  stats.forEach((stat, index) => {
    const team = stat.team ?? {};
    const league = stat.league ?? {};
    const games = stat.games ?? {};
    const goals = stat.goals ?? {};

    const signature = `${team.id ?? "?"}|${league.id ?? "?"}|${league.season ?? SEASON}`;
    if (!signatures.has(signature)) signatures.set(signature, []);
    signatures.get(signature).push(index + 1);

    console.log(`#${index + 1}`);
    console.log(`Equipo: ${value(team.name)} · team.id=${value(team.id)}`);
    console.log(`Competición: ${value(league.name)} · league.id=${value(league.id)}`);
    console.log(`País: ${value(league.country)} · temporada=${value(league.season)}`);
    console.log(`Tipo API: ${value(league.type)}`);
    console.log(`PJ ${value(games.appearences)} · Tit ${value(games.lineups)} · Min ${value(games.minutes)} · G ${value(goals.total)} · A ${value(goals.assists)} · Nota ${value(games.rating)}`);
    console.log(`Clave actual 10TG: ${signature}\n`);
  });

  const duplicates = [...signatures.entries()].filter(([, indexes]) => indexes.length > 1);

  console.log("Resumen:");
  console.log(`• Bloques recibidos: ${stats.length}`);
  console.log(`• Claves únicas según nuestro upsert actual: ${signatures.size}`);

  if (duplicates.length === 0) {
    console.log("✅ No hay bloques que colisionen con la clave actual player + team + competition + season.");
  } else {
    console.log("⚠️ Hay colisiones con nuestra clave actual:");
    for (const [signature, indexes] of duplicates) {
      console.log(`  ${signature} → bloques #${indexes.join(", #")}`);
    }
  }

  console.log("\n✅ Diagnóstico terminado. No se ha modificado Supabase.");
}

main().catch((error) => {
  console.error("\n❌ Diagnóstico detenido:");
  console.error(error?.message ?? error);
  process.exit(1);
});
