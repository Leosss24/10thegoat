import {
  findExactPlayer,
  savePlayer,
  importCareer,
  importAllAvailableStats,
} from "./lib/core-importer.mjs";

const PLAYERS = [
  {
    label: "Ronaldo Nazário",
    search: "Ronaldo",
    searches: ["Ronaldo", "Ronaldo Nazario", "Nazario"],
    birthDate: "1976-09-18",
    nationality: "Brazil",
    isRetired: true,
    lookupTeams: [{ team: "Real Madrid", season: 2006 }],
  },
  {
    label: "Luís Figo",
    search: "Figo",
    searches: ["Figo", "Luis Figo"],
    birthDate: "1972-11-04",
    nationality: "Portugal",
    isRetired: true,
    lookupTeams: [{ team: "Inter", season: 2008 }],
  },
];

async function importOne(target, index) {
  console.log(`\n══════════════════════════════════════════════════`);
  console.log(`${index + 1}/${PLAYERS.length} · ${target.label}`);
  console.log(`══════════════════════════════════════════════════`);

  console.log("1/3 Perfil...");
  const apiPlayer = await findExactPlayer(target);
  const savedPlayer = await savePlayer(apiPlayer, target);
  console.log(`✅ ${target.label} · API ${apiPlayer.id} · 10TG ${savedPlayer.player.id} · ${savedPlayer.created ? "creado" : "actualizado"}`);
  console.log(`   Foto: ${savedPlayer.player.photo_url ?? "-"}`);

  console.log("2/3 Trayectoria y escudos...");
  const career = await importCareer(apiPlayer.id, savedPlayer.player.id);
  if (career.warnings?.length) {
    for (const warning of career.warnings) {
      console.log(`   ⚠️ ${warning.team}${warning.season !== null ? ` · temporada ${warning.season}` : ""}: ${warning.reason}`);
    }
  }
  const clubCount = career.filter((item) => !item.club.is_national_team).length;
  const nationalCount = career.filter((item) => item.club.is_national_team).length;
  const distinctSeasons = [...new Set(career.flatMap((item) => item.seasons))].length;
  console.log(`✅ ${career.length} equipos: ${clubCount} clubes + ${nationalCount} selecciones · ${distinctSeasons} temporadas distintas`);

  console.log("3/3 Estadísticas por temporada...");
  const totals = await importAllAvailableStats(apiPlayer.id, savedPlayer.player.id, career, (season, result, error) => {
    if (error) {
      console.log(`   ⚠️ ${season}: no disponible (${error?.message ?? error})`);
      return;
    }
    const marker = result.received > 0 ? "✅" : "▫️";
    console.log(`   ${marker} ${season}: ${result.received} bloques recibidos · ${result.saved} guardados${result.skippedBlocks ? ` · ${result.skippedBlocks} omitidos` : ""}`);
    if (result.warnings?.length) {
      for (const warning of result.warnings) console.log(`      ⚠️ ${warning}`);
    }
  });

  console.log(`✅ ${totals.saved} bloques estadísticos guardados en ${totals.seasons} temporadas consultadas.`);
}

async function main() {
  console.log("🐐 10 The GOAT · Reparación Lote 01");
  console.log("Solo procesa los 2 jugadores históricos que siguen pendientes.\n");

  let ok = 0;
  const failures = [];

  for (let index = 0; index < PLAYERS.length; index += 1) {
    const target = PLAYERS[index];
    try {
      await importOne(target, index);
      ok += 1;
    } catch (error) {
      failures.push({ player: target.label, error: error?.message ?? String(error) });
      console.error(`❌ ${target.label}: ${error?.message ?? error}`);
    }
  }

  console.log("\n══════════════════════════════════════════════════");
  console.log("RESUMEN · REPARACIÓN HISTÓRICOS");
  console.log("══════════════════════════════════════════════════");
  console.log(`✅ Jugadores completados: ${ok}/${PLAYERS.length}`);
  console.log(`❌ Jugadores con error: ${failures.length}`);
  if (failures.length) {
    console.log("\nJugadores a revisar:");
    for (const failure of failures) console.log(`- ${failure.player}: ${failure.error}`);
  }
}

main().catch((error) => {
  console.error("\n❌ Error fatal de reparación:");
  console.error(error?.message ?? error);
  process.exit(1);
});
