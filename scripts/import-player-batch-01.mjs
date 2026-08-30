import {
  findExactPlayer,
  savePlayer,
  importCareer,
  importAllAvailableStats,
} from "./lib/core-importer.mjs";

// Primer lote amplio tras validar el pipeline con Messi, Cristiano, Ronaldinho, Zidane y Haaland.
// Se usan fecha de nacimiento + nacionalidad para evitar homónimos en la búsqueda de API-Football.
const PLAYERS = [
  { label: "Kylian Mbappé", search: "Mbappe", birthDate: "1998-12-20", nationality: "France", isRetired: false },
  { label: "Neymar", search: "Neymar", birthDate: "1992-02-05", nationality: "Brazil", isRetired: false },
  { label: "Luis Suárez", search: "Suarez", birthDate: "1987-01-24", nationality: "Uruguay", isRetired: false },
  { label: "Robert Lewandowski", search: "Lewandowski", birthDate: "1988-08-21", nationality: "Poland", isRetired: false },
  { label: "Karim Benzema", search: "Benzema", birthDate: "1987-12-19", nationality: "France", isRetired: false },
  { label: "Mohamed Salah", search: "Salah", birthDate: "1992-06-15", nationality: "Egypt", isRetired: false },
  { label: "Kevin De Bruyne", search: "De Bruyne", searches: ["De Bruyne", "Bruyne", "Kevin De Bruyne"], birthDate: "1991-06-28", nationality: "Belgium", isRetired: false },
  { label: "Harry Kane", search: "Kane", birthDate: "1993-07-28", nationality: "England", isRetired: false },
  { label: "Luka Modrić", search: "Modric", birthDate: "1985-09-09", nationality: "Croatia", isRetired: false },
  { label: "Toni Kroos", search: "Kroos", birthDate: "1990-01-04", nationality: "Germany", isRetired: true },
  { label: "Andrés Iniesta", search: "Iniesta", birthDate: "1984-05-11", nationality: "Spain", isRetired: true },
  { label: "Xavi", search: "Xavi", birthDate: "1980-01-25", nationality: "Spain", isRetired: true },
  { label: "Sergio Busquets", search: "Busquets", birthDate: "1988-07-16", nationality: "Spain", isRetired: false },
  { label: "Sergio Ramos", search: "Ramos", birthDate: "1986-03-30", nationality: "Spain", isRetired: false },
  { label: "Iker Casillas", search: "Casillas", birthDate: "1981-05-20", nationality: "Spain", isRetired: true },
  { label: "Gianluigi Buffon", search: "Buffon", birthDate: "1978-01-28", nationality: "Italy", isRetired: true },
  { label: "Andrea Pirlo", search: "Pirlo", birthDate: "1979-05-19", nationality: "Italy", isRetired: true },
  { label: "Thierry Henry", search: "Henry", birthDate: "1977-08-17", nationality: "France", isRetired: true },
  { label: "Zlatan Ibrahimović", search: "Ibrahimovic", birthDate: "1981-10-03", nationality: "Sweden", isRetired: true },
  { label: "Kaká", search: "Kaka", birthDate: "1982-04-22", nationality: "Brazil", isRetired: true },
  { label: "Ronaldo Nazário", search: "Ronaldo", searches: ["Ronaldo", "Ronaldo Nazario", "Nazario"], birthDate: "1976-09-18", nationality: "Brazil", isRetired: true, lookupSeasons: [2006, 2007, 2008, 2009, 2010] },
  { label: "Luís Figo", search: "Figo", searches: ["Figo", "Luis Figo"], birthDate: "1972-11-04", nationality: "Portugal", isRetired: true, lookupSeasons: [2008, 2007, 2006, 2005] },
  { label: "David Beckham", search: "Beckham", birthDate: "1975-05-02", nationality: "England", isRetired: true },
  { label: "Wayne Rooney", search: "Rooney", birthDate: "1985-10-24", nationality: "England", isRetired: true },
  { label: "Samuel Eto'o", search: "Eto", searches: ["Eto", "Etoo", "Samuel Eto"], birthDate: "1981-03-10", nationality: "Cameroon", isRetired: true },
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
  if (totals.failedSeasons) console.log(`ℹ️ ${totals.failedSeasons} temporadas dieron error y se continuó.`);
  if (totals.skippedMissingTeam) console.log(`⚠️ ${totals.skippedMissingTeam} bloques se omitieron por no poder resolver el equipo.`);
  if (totals.skippedBlocks) console.log(`⚠️ ${totals.skippedBlocks} bloques individuales se omitieron, sin abortar al jugador.`);
  if (career.warnings?.length) console.log(`⚠️ ${career.warnings.length} relaciones de trayectoria se omitieron, sin abortar al jugador.`);

  return {
    careerTeams: career.length,
    seasons: totals.seasons,
    statBlocks: totals.saved,
    failedSeasons: totals.failedSeasons,
    skippedMissingTeam: totals.skippedMissingTeam,
    skippedBlocks: totals.skippedBlocks,
    careerWarnings: career.warnings?.length ?? 0,
  };
}

async function main() {
  console.log("🐐 10 The GOAT · Población BBDD · Lote 01");
  console.log(`${PLAYERS.length} jugadores nuevos · perfiles + trayectoria + estadísticas disponibles`);
  console.log("El proceso es idempotente: si lo repites, actualiza en vez de duplicar.\n");

  const grand = {
    ok: 0,
    failed: 0,
    careerTeams: 0,
    seasons: 0,
    statBlocks: 0,
    failedSeasons: 0,
    skippedMissingTeam: 0,
    skippedBlocks: 0,
    careerWarnings: 0,
    failures: [],
  };

  for (let index = 0; index < PLAYERS.length; index += 1) {
    const target = PLAYERS[index];
    try {
      const result = await importOne(target, index);
      grand.ok += 1;
      grand.careerTeams += result.careerTeams;
      grand.seasons += result.seasons;
      grand.statBlocks += result.statBlocks;
      grand.failedSeasons += result.failedSeasons;
      grand.skippedMissingTeam += result.skippedMissingTeam;
      grand.skippedBlocks += result.skippedBlocks;
      grand.careerWarnings += result.careerWarnings;
    } catch (error) {
      grand.failed += 1;
      grand.failures.push({ player: target.label, error: error?.message ?? String(error) });
      console.error(`❌ ${target.label}: ${error?.message ?? error}`);
      console.error("   Se continúa con el siguiente jugador.");
    }
  }

  console.log("\n══════════════════════════════════════════════════");
  console.log("RESUMEN · LOTE 01");
  console.log("══════════════════════════════════════════════════");
  console.log(`✅ Jugadores completados: ${grand.ok}/${PLAYERS.length}`);
  console.log(`❌ Jugadores con error: ${grand.failed}`);
  console.log(`✅ Relaciones de equipos procesadas: ${grand.careerTeams}`);
  console.log(`✅ Temporadas consultadas: ${grand.seasons}`);
  console.log(`✅ Bloques estadísticos guardados: ${grand.statBlocks}`);
  if (grand.failedSeasons) console.log(`ℹ️ Temporadas individuales con error: ${grand.failedSeasons}`);
  if (grand.skippedMissingTeam) console.log(`⚠️ Bloques omitidos por equipo no resoluble: ${grand.skippedMissingTeam}`);
  if (grand.skippedBlocks) console.log(`⚠️ Bloques individuales omitidos sin abortar jugador: ${grand.skippedBlocks}`);
  if (grand.careerWarnings) console.log(`⚠️ Relaciones de trayectoria omitidas sin abortar jugador: ${grand.careerWarnings}`);

  if (grand.failures.length) {
    console.log("\nJugadores a revisar:");
    for (const failure of grand.failures) console.log(`- ${failure.player}: ${failure.error}`);
  }

  console.log("\n🎉 Lote terminado. No se importan aún transferencias ni palmarés.");
}

main().catch((error) => {
  console.error("\n❌ Error fatal de importación:");
  console.error(error?.message ?? error);
  process.exit(1);
});
