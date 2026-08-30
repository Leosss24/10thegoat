import {
  findExactPlayer,
  savePlayer,
  importCareer,
  importAllAvailableStats,
} from "./lib/core-importer.mjs";

const PLAYERS = [
  { label: "Lionel Messi", search: "Messi", birthDate: "1987-06-24", nationality: "Argentina", isRetired: false },
  { label: "Cristiano Ronaldo", search: "Ronaldo", birthDate: "1985-02-05", nationality: "Portugal", isRetired: false },
  { label: "Ronaldinho", search: "Ronaldinho", birthDate: "1980-03-21", nationality: "Brazil", isRetired: true },
  { label: "Zinedine Zidane", search: "Zidane", birthDate: "1972-06-23", nationality: "France", isRetired: true },
  { label: "Erling Haaland", search: "Haaland", birthDate: "2000-07-21", nationality: "Norway", isRetired: false },
];

async function main() {
  console.log("🐐 10 The GOAT · Core Dataset v0.4.0");
  console.log("5 jugadores de control · perfiles + trayectoria + estadísticas disponibles\n");

  const grand = { players: 0, careerTeams: 0, seasons: 0, statBlocks: 0 };

  for (let index = 0; index < PLAYERS.length; index += 1) {
    const target = PLAYERS[index];
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
      console.log(`   ${marker} ${season}: ${result.received} bloques recibidos · ${result.saved} guardados`);
    });
    console.log(`✅ ${totals.saved} bloques estadísticos guardados en ${totals.seasons} temporadas consultadas.`);
    if (totals.emptySeasons) console.log(`ℹ️ ${totals.emptySeasons} temporadas no devolvieron estadísticas.`);
    if (totals.failedSeasons) console.log(`ℹ️ ${totals.failedSeasons} temporadas no estaban disponibles o devolvieron error y se continuó.`);
    if (totals.skippedMissingTeam) console.log(`⚠️ ${totals.skippedMissingTeam} bloques se omitieron por no poder resolver el equipo.`);

    grand.players += 1;
    grand.careerTeams += career.length;
    grand.seasons += totals.seasons;
    grand.statBlocks += totals.saved;
  }

  console.log("\n══════════════════════════════════════════════════");
  console.log("RESUMEN 10 THE GOAT CORE DATASET");
  console.log("══════════════════════════════════════════════════");
  console.log(`✅ Jugadores procesados: ${grand.players}`);
  console.log(`✅ Relaciones de equipos procesadas: ${grand.careerTeams}`);
  console.log(`✅ Temporadas consultadas: ${grand.seasons}`);
  console.log(`✅ Bloques estadísticos guardados: ${grand.statBlocks}`);
  console.log("\n🎉 Primer dataset multi-jugador terminado.");
  console.log("ℹ️ Todavía NO importamos transferencias ni palmarés.");
  console.log("ℹ️ Las competiciones sin league.id se conservan con ID interno de 10TG.");
  console.log("ℹ️ Friendlies / Club Friendlies se clasifican como scope=international.");
}

main().catch((error) => {
  console.error("\n❌ Importación detenida:");
  console.error(error?.message ?? error);
  process.exit(1);
});
