import {
  findExactPlayer,
  savePlayer,
  importCareer,
  importAllAvailableStats,
} from "./lib/core-importer.mjs";
import { HISTORICAL_REPAIR_PLAYERS } from "../data/historical-repair-players.mjs";

console.log("🐐 10 The GOAT · Reparación de históricos por API ID");
console.log("Procesa únicamente históricos con API_FOOTBALL_ID_* configurado en .env.local.\n");

const configured = HISTORICAL_REPAIR_PLAYERS.filter((player) => player.apiFootballId);
const pending = HISTORICAL_REPAIR_PLAYERS.filter((player) => !player.apiFootballId);

if (!configured.length) {
  console.log("ℹ️ No hay IDs manuales configurados todavía.\n");
  console.log("Añade una o varias líneas a .env.local, por ejemplo:");
  console.log("API_FOOTBALL_ID_CAFU=12345");
  console.log("API_FOOTBALL_ID_PAOLO_MALDINI=12345\n");
  console.log("Pendientes:");
  for (const player of pending) console.log(`- ${player.label}`);
  process.exit(0);
}

let completed = 0;
let failed = 0;
let relations = 0;
let seasons = 0;
let blocks = 0;
let skippedBlocks = 0;
const errors = [];

for (let index = 0; index < configured.length; index += 1) {
  const target = configured[index];
  console.log("\n══════════════════════════════════════════════════");
  console.log(`${index + 1}/${configured.length} · ${target.label} · API ID ${target.apiFootballId}`);
  console.log("══════════════════════════════════════════════════");

  try {
    console.log("1/3 Perfil y validación del ID...");
    const apiPlayer = await findExactPlayer(target);
    const saved = await savePlayer(apiPlayer, target);
    console.log(`✅ ${target.label} · API ${apiPlayer.id} · 10TG ${saved.player.id} · ${saved.created ? "creado" : "actualizado"}`);
    console.log(`   Foto: ${saved.player.photo_url ?? "-"}`);

    console.log("2/3 Trayectoria y escudos...");
    const career = await importCareer(apiPlayer.id, saved.player.id);
    const clubCount = career.filter((item) => !item.club.is_national_team).length;
    const nationalCount = career.filter((item) => item.club.is_national_team).length;
    const distinctSeasons = [...new Set(career.flatMap((item) => item.seasons))].length;
    relations += career.length;
    console.log(`✅ ${career.length} equipos: ${clubCount} clubes + ${nationalCount} selecciones · ${distinctSeasons} temporadas distintas`);
    for (const warning of career.warnings ?? []) {
      console.log(`   ⚠️ ${warning.team}${warning.season !== null ? ` · temporada ${warning.season}` : ""}: ${warning.reason}`);
    }

    console.log("3/3 Estadísticas por temporada...");
    const totals = await importAllAvailableStats(apiPlayer.id, saved.player.id, career, (season, result, error) => {
      if (error) {
        console.log(`   ⚠️ ${season}: no disponible (${error?.message ?? error})`);
        return;
      }
      const marker = result.received > 0 ? "✅" : "▫️";
      console.log(`   ${marker} ${season}: ${result.received} bloques recibidos · ${result.saved} guardados${result.skippedBlocks ? ` · ${result.skippedBlocks} omitidos` : ""}`);
      for (const warning of result.warnings ?? []) console.log(`      ⚠️ ${warning}`);
    });

    seasons += totals.seasons;
    blocks += totals.saved;
    skippedBlocks += totals.skippedBlocks ?? 0;
    console.log(`✅ ${totals.saved} bloques estadísticos guardados en ${totals.seasons} temporadas consultadas.`);
    if (totals.failedSeasons) console.log(`ℹ️ ${totals.failedSeasons} temporadas dieron error y se continuó.`);
    if (totals.skippedBlocks) console.log(`⚠️ ${totals.skippedBlocks} bloques individuales omitidos.`);
    completed += 1;
  } catch (error) {
    failed += 1;
    const message = error?.message ?? String(error);
    errors.push(`${target.label}: ${message}`);
    console.log(`❌ ${target.label}: ${message}`);
    console.log("   Se continúa con el siguiente histórico.");
  }
}

console.log("\n══════════════════════════════════════════════════");
console.log("RESUMEN · REPARACIÓN DE HISTÓRICOS");
console.log("══════════════════════════════════════════════════");
console.log(`✅ Jugadores completados: ${completed}/${configured.length}`);
console.log(`❌ Jugadores con error: ${failed}`);
console.log(`✅ Relaciones de equipos procesadas: ${relations}`);
console.log(`✅ Temporadas consultadas: ${seasons}`);
console.log(`✅ Bloques estadísticos guardados: ${blocks}`);
console.log(`⚠️ Bloques individuales omitidos: ${skippedBlocks}`);

if (pending.length) {
  console.log("\nIDs todavía sin configurar:");
  for (const player of pending) console.log(`- ${player.label}`);
}

if (errors.length) {
  console.log("\nJugadores a revisar:");
  for (const error of errors) console.log(`- ${error}`);
}
