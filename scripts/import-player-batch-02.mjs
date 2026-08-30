import fs from "node:fs/promises";
import path from "node:path";
import {
  apiGet,
  supabase,
  findExactPlayer,
  savePlayer,
  importCareer,
  importAllAvailableStats,
} from "./lib/core-importer.mjs";

const TOTAL_TARGET = 200;
const RETIRED_TARGET = 35;
const ACTIVE_TARGET = 165;
const ACTIVE_SEASON = Number(process.env.BATCH02_ACTIVE_SEASON ?? 2026);
const MANIFEST_PATH = path.resolve(".import-state/batch02-active-manifest.json");

const LEAGUES = [
  { key: "la_liga", name: "La Liga", country: "España", apiLeagueId: 140, quota: 42 },
  { key: "premier_league", name: "Premier League", country: "Inglaterra", apiLeagueId: 39, quota: 41 },
  { key: "bundesliga", name: "Bundesliga", country: "Alemania", apiLeagueId: 78, quota: 41 },
  { key: "serie_a", name: "Serie A", country: "Italia", apiLeagueId: 135, quota: 41 },
];

// 35 retirados adicionales. No repite los retirados ya introducidos en Core/Lote 01.
const RETIRED_PLAYERS = [
  { label: "Raúl González", search: "Raul", searches: ["Raul", "Raul Gonzalez"], birthDate: "1977-06-27", nationality: "Spain", isRetired: true },
  { label: "Roberto Carlos", search: "Roberto Carlos", birthDate: "1973-04-10", nationality: "Brazil", isRetired: true },
  { label: "Cafu", search: "Cafu", birthDate: "1970-06-07", nationality: "Brazil", isRetired: true },
  { label: "Paolo Maldini", search: "Maldini", birthDate: "1968-06-26", nationality: "Italy", isRetired: true },
  { label: "Alessandro Nesta", search: "Nesta", birthDate: "1976-03-19", nationality: "Italy", isRetired: true },
  { label: "Fabio Cannavaro", search: "Cannavaro", birthDate: "1973-09-13", nationality: "Italy", isRetired: true },
  { label: "Francesco Totti", search: "Totti", birthDate: "1976-09-27", nationality: "Italy", isRetired: true },
  { label: "Alessandro Del Piero", search: "Del Piero", birthDate: "1974-11-09", nationality: "Italy", isRetired: true },
  { label: "Gennaro Gattuso", search: "Gattuso", birthDate: "1978-01-09", nationality: "Italy", isRetired: true },
  { label: "Clarence Seedorf", search: "Seedorf", birthDate: "1976-04-01", nationality: "Netherlands", isRetired: true },
  { label: "Ruud van Nistelrooy", search: "Nistelrooy", searches: ["Nistelrooy", "Van Nistelrooy"], birthDate: "1976-07-01", nationality: "Netherlands", isRetired: true },
  { label: "Dennis Bergkamp", search: "Bergkamp", birthDate: "1969-05-10", nationality: "Netherlands", isRetired: true },
  { label: "Arjen Robben", search: "Robben", birthDate: "1984-01-23", nationality: "Netherlands", isRetired: true },
  { label: "Robin van Persie", search: "Van Persie", searches: ["Van Persie", "Persie"], birthDate: "1983-08-06", nationality: "Netherlands", isRetired: true },
  { label: "Didier Drogba", search: "Drogba", birthDate: "1978-03-11", nationality: "Ivory Coast", isRetired: true },
  { label: "Frank Lampard", search: "Lampard", birthDate: "1978-06-20", nationality: "England", isRetired: true },
  { label: "Steven Gerrard", search: "Gerrard", birthDate: "1980-05-30", nationality: "England", isRetired: true },
  { label: "John Terry", search: "Terry", birthDate: "1980-12-07", nationality: "England", isRetired: true },
  { label: "Rio Ferdinand", search: "Ferdinand", birthDate: "1978-11-07", nationality: "England", isRetired: true },
  { label: "Paul Scholes", search: "Scholes", birthDate: "1974-11-16", nationality: "England", isRetired: true },
  { label: "Ryan Giggs", search: "Giggs", birthDate: "1973-11-29", nationality: "Wales", isRetired: true },
  { label: "Petr Čech", search: "Cech", birthDate: "1982-05-20", nationality: "Czech Republic", isRetired: true },
  { label: "Carles Puyol", search: "Puyol", birthDate: "1978-04-13", nationality: "Spain", isRetired: true },
  { label: "David Villa", search: "Villa", birthDate: "1981-12-03", nationality: "Spain", isRetired: true },
  { label: "Fernando Torres", search: "Torres", birthDate: "1984-03-20", nationality: "Spain", isRetired: true },
  { label: "Xabi Alonso", search: "Xabi Alonso", searches: ["Xabi Alonso", "Alonso"], birthDate: "1981-11-25", nationality: "Spain", isRetired: true },
  { label: "Cesc Fàbregas", search: "Fabregas", birthDate: "1987-05-04", nationality: "Spain", isRetired: true },
  { label: "Javier Mascherano", search: "Mascherano", birthDate: "1984-06-08", nationality: "Argentina", isRetired: true },
  { label: "Diego Forlán", search: "Forlan", birthDate: "1979-05-19", nationality: "Uruguay", isRetired: true },
  { label: "Juan Román Riquelme", search: "Riquelme", birthDate: "1978-06-24", nationality: "Argentina", isRetired: true },
  { label: "Carlos Tévez", search: "Tevez", birthDate: "1984-02-05", nationality: "Argentina", isRetired: true },
  { label: "Miroslav Klose", search: "Klose", birthDate: "1978-06-09", nationality: "Germany", isRetired: true },
  { label: "Philipp Lahm", search: "Lahm", birthDate: "1983-11-11", nationality: "Germany", isRetired: true },
  { label: "Bastian Schweinsteiger", search: "Schweinsteiger", birthDate: "1984-08-01", nationality: "Germany", isRetired: true },
  { label: "Franck Ribéry", search: "Ribery", birthDate: "1983-04-07", nationality: "France", isRetired: true },
];

if (RETIRED_PLAYERS.length !== RETIRED_TARGET) {
  throw new Error(`Configuración inválida: esperaba ${RETIRED_TARGET} retirados y hay ${RETIRED_PLAYERS.length}`);
}
if (LEAGUES.reduce((sum, league) => sum + league.quota, 0) !== ACTIVE_TARGET) {
  throw new Error(`Configuración inválida: las cuotas activas no suman ${ACTIVE_TARGET}`);
}

function num(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function candidateScore(entry) {
  const stats = entry?.statistics ?? [];
  let appearances = 0;
  let starts = 0;
  let minutes = 0;
  let goals = 0;
  let assists = 0;
  let ratingTotal = 0;
  let ratingCount = 0;

  for (const stat of stats) {
    appearances += num(stat?.games?.appearences);
    starts += num(stat?.games?.lineups);
    minutes += num(stat?.games?.minutes);
    goals += num(stat?.goals?.total);
    assists += num(stat?.goals?.assists);
    const rating = num(stat?.games?.rating);
    if (rating > 0) {
      ratingTotal += rating;
      ratingCount += 1;
    }
  }

  const rating = ratingCount ? ratingTotal / ratingCount : 0;
  return appearances * 30 + starts * 8 + minutes / 10 + goals * 45 + assists * 30 + rating * 12;
}

async function loadExistingExternalIds() {
  const ids = new Set();
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const result = await supabase
      .from("player_external_ids")
      .select("external_id")
      .eq("provider", "api_football")
      .range(from, from + pageSize - 1);
    if (result.error) throw result.error;
    for (const row of result.data ?? []) ids.add(String(row.external_id));
    if ((result.data?.length ?? 0) < pageSize) break;
  }
  return ids;
}

async function fetchLeaguePool(league, season) {
  const pool = [];
  let page = 1;
  let totalPages = 1;

  do {
    const data = await apiGet(`/players?league=${league.apiLeagueId}&season=${season}&page=${page}`);
    for (const entry of data.response ?? []) {
      if (entry?.player?.id) pool.push(entry);
    }
    totalPages = Number(data?.paging?.total ?? 1) || 1;
    console.log(`   ${league.name}: página ${page}/${totalPages} · ${pool.length} perfiles acumulados`);
    page += 1;
  } while (page <= totalPages);

  return pool;
}

function minimalManifestEntry(entry, league, season) {
  const player = entry.player;
  return {
    league: league.name,
    leagueCountry: league.country,
    sourceSeason: season,
    apiPlayer: {
      id: player.id,
      name: player.name ?? null,
      firstname: player.firstname ?? null,
      lastname: player.lastname ?? null,
      age: player.age ?? null,
      birth: player.birth ?? null,
      nationality: player.nationality ?? null,
      height: player.height ?? null,
      weight: player.weight ?? null,
      injured: player.injured ?? null,
      photo: player.photo ?? null,
    },
    discoveryScore: candidateScore(entry),
  };
}

async function discoverActiveManifest() {
  const existingIds = await loadExistingExternalIds();
  const seen = new Set(existingIds);
  const selected = [];

  console.log(`\n🔎 Descubriendo ${ACTIVE_TARGET} jugadores activos de las cuatro grandes ligas...`);
  console.log(`Temporada de referencia: ${ACTIVE_SEASON}/${String(ACTIVE_SEASON + 1).slice(-2)}`);
  console.log(`IDs ya existentes en 10TG que se excluirán: ${existingIds.size}\n`);

  for (const league of LEAGUES) {
    console.log(`→ ${league.name} (${league.country}) · objetivo ${league.quota}`);
    let season = ACTIVE_SEASON;
    let pool = await fetchLeaguePool(league, season);

    // Si la temporada recién iniciada todavía no tiene suficiente cobertura, usamos
    // la temporada anterior únicamente como fallback de descubrimiento.
    let available = pool.filter((entry) => !seen.has(String(entry.player.id)));
    if (available.length < league.quota) {
      console.log(`   ⚠️ Cobertura insuficiente en ${season}. Fallback a ${season - 1}.`);
      season -= 1;
      pool = await fetchLeaguePool(league, season);
      available = pool.filter((entry) => !seen.has(String(entry.player.id)));
    }

    available.sort((a, b) => candidateScore(b) - candidateScore(a));
    const leagueSelection = available.slice(0, league.quota);
    if (leagueSelection.length < league.quota) {
      throw new Error(`${league.name}: solo pude seleccionar ${leagueSelection.length}/${league.quota} jugadores no duplicados`);
    }

    for (const entry of leagueSelection) {
      seen.add(String(entry.player.id));
      selected.push(minimalManifestEntry(entry, league, season));
    }
    console.log(`   ✅ ${leagueSelection.length} seleccionados\n`);
  }

  if (selected.length !== ACTIVE_TARGET) {
    throw new Error(`Manifest activo incompleto: ${selected.length}/${ACTIVE_TARGET}`);
  }

  await fs.mkdir(path.dirname(MANIFEST_PATH), { recursive: true });
  await fs.writeFile(MANIFEST_PATH, JSON.stringify({ createdAt: new Date().toISOString(), activeSeason: ACTIVE_SEASON, players: selected }, null, 2));
  console.log(`💾 Manifest estable guardado en ${MANIFEST_PATH}`);
  return selected;
}

async function loadOrCreateActiveManifest() {
  try {
    const raw = await fs.readFile(MANIFEST_PATH, "utf8");
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed.players) && parsed.players.length === ACTIVE_TARGET) {
      console.log(`📌 Reutilizando manifest existente con ${parsed.players.length} jugadores activos.`);
      return parsed.players;
    }
    console.log("⚠️ Manifest existente inválido; se regenerará.");
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  return discoverActiveManifest();
}

async function importResolvedPlayer(apiPlayer, target, displayIndex, total, groupLabel) {
  console.log(`\n══════════════════════════════════════════════════`);
  console.log(`${displayIndex}/${total} · ${target.label} · ${groupLabel}`);
  console.log(`══════════════════════════════════════════════════`);

  console.log("1/3 Perfil...");
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
    for (const warning of result.warnings ?? []) console.log(`      ⚠️ ${warning}`);
  });

  console.log(`✅ ${totals.saved} bloques estadísticos guardados en ${totals.seasons} temporadas consultadas.`);
  if (totals.failedSeasons) console.log(`ℹ️ ${totals.failedSeasons} temporadas dieron error y se continuó.`);
  if (totals.skippedBlocks) console.log(`⚠️ ${totals.skippedBlocks} bloques individuales omitidos.`);
  if (career.warnings?.length) console.log(`⚠️ ${career.warnings.length} relaciones de trayectoria omitidas.`);

  return {
    careerTeams: career.length,
    seasons: totals.seasons,
    statBlocks: totals.saved,
    failedSeasons: totals.failedSeasons,
    skippedBlocks: totals.skippedBlocks,
    careerWarnings: career.warnings?.length ?? 0,
  };
}

function addResult(grand, result) {
  grand.ok += 1;
  grand.careerTeams += result.careerTeams;
  grand.seasons += result.seasons;
  grand.statBlocks += result.statBlocks;
  grand.failedSeasons += result.failedSeasons;
  grand.skippedBlocks += result.skippedBlocks;
  grand.careerWarnings += result.careerWarnings;
}

async function main() {
  console.log("🐐 10 The GOAT · Población BBDD · Lote 02");
  console.log(`${TOTAL_TARGET} jugadores: ${RETIRED_TARGET} retirados + ${ACTIVE_TARGET} activos de España/Inglaterra/Alemania/Italia.`);
  console.log("Incluye throttle y reintentos automáticos ante rate limit.");
  console.log("El proceso es idempotente y guarda un manifest estable para poder reanudarlo.\n");

  const activeManifest = await loadOrCreateActiveManifest();
  const grand = {
    ok: 0,
    failed: 0,
    retiredOk: 0,
    activeOk: 0,
    careerTeams: 0,
    seasons: 0,
    statBlocks: 0,
    failedSeasons: 0,
    skippedBlocks: 0,
    careerWarnings: 0,
    failures: [],
  };

  let displayIndex = 0;

  console.log("\n\n██████████████████████████████████████████████████");
  console.log(`RETIRADOS · ${RETIRED_TARGET}`);
  console.log("██████████████████████████████████████████████████");
  for (const target of RETIRED_PLAYERS) {
    displayIndex += 1;
    try {
      const apiPlayer = await findExactPlayer(target);
      const result = await importResolvedPlayer(apiPlayer, target, displayIndex, TOTAL_TARGET, "RETIRADO");
      addResult(grand, result);
      grand.retiredOk += 1;
    } catch (error) {
      grand.failed += 1;
      grand.failures.push({ player: target.label, group: "retirado", error: error?.message ?? String(error) });
      console.error(`❌ ${target.label}: ${error?.message ?? error}`);
      console.error("   Se continúa con el siguiente jugador.");
    }
  }

  console.log("\n\n██████████████████████████████████████████████████");
  console.log(`ACTIVOS · ${ACTIVE_TARGET}`);
  console.log("██████████████████████████████████████████████████");
  for (const item of activeManifest) {
    displayIndex += 1;
    const apiPlayer = item.apiPlayer;
    const target = {
      label: apiPlayer.name || [apiPlayer.firstname, apiPlayer.lastname].filter(Boolean).join(" ") || `API ${apiPlayer.id}`,
      birthDate: apiPlayer.birth?.date ?? null,
      nationality: apiPlayer.nationality ?? null,
      isRetired: false,
      apiFootballId: apiPlayer.id,
    };
    try {
      const result = await importResolvedPlayer(apiPlayer, target, displayIndex, TOTAL_TARGET, `${item.league} · ${item.leagueCountry}`);
      addResult(grand, result);
      grand.activeOk += 1;
    } catch (error) {
      grand.failed += 1;
      grand.failures.push({ player: target.label, group: item.league, error: error?.message ?? String(error) });
      console.error(`❌ ${target.label}: ${error?.message ?? error}`);
      console.error("   Se continúa con el siguiente jugador.");
    }
  }

  console.log("\n══════════════════════════════════════════════════");
  console.log("RESUMEN · LOTE 02");
  console.log("══════════════════════════════════════════════════");
  console.log(`✅ Jugadores completados: ${grand.ok}/${TOTAL_TARGET}`);
  console.log(`   ↳ Retirados: ${grand.retiredOk}/${RETIRED_TARGET}`);
  console.log(`   ↳ Activos grandes ligas: ${grand.activeOk}/${ACTIVE_TARGET}`);
  console.log(`❌ Jugadores con error: ${grand.failed}`);
  console.log(`✅ Relaciones de equipos procesadas: ${grand.careerTeams}`);
  console.log(`✅ Temporadas consultadas: ${grand.seasons}`);
  console.log(`✅ Bloques estadísticos guardados: ${grand.statBlocks}`);
  if (grand.failedSeasons) console.log(`ℹ️ Temporadas individuales con error: ${grand.failedSeasons}`);
  if (grand.skippedBlocks) console.log(`⚠️ Bloques individuales omitidos: ${grand.skippedBlocks}`);
  if (grand.careerWarnings) console.log(`⚠️ Relaciones de trayectoria omitidas: ${grand.careerWarnings}`);

  if (grand.failures.length) {
    console.log("\nJugadores a revisar:");
    for (const failure of grand.failures) console.log(`- [${failure.group}] ${failure.player}: ${failure.error}`);
  }

  console.log(`\n📌 Manifest de activos: ${MANIFEST_PATH}`);
  console.log("🎉 Lote terminado. Transferencias y palmarés siguen fuera de este importador.");
}

main().catch((error) => {
  console.error("\n❌ Error fatal de importación:");
  console.error(error?.message ?? error);
  process.exit(1);
});
