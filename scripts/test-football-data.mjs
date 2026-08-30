import { mkdir, writeFile } from "node:fs/promises";

const API_BASE = "https://v3.football.api-sports.io";
const apiKey = process.env.API_FOOTBALL_KEY;

// Plan gratuito API-Football: 10 peticiones/minuto.
// Dejamos margen para evitar chocar con una ventana móvil de 60 segundos.
const MIN_REQUEST_INTERVAL_MS = 6500;
const MAX_RETRIES_429 = 3;

const TEST_PLAYERS = [
  {
    label: "Lionel Messi",
    search: "Messi",
    birthDate: "1987-06-24",
    nationality: "Argentina",
  },
  {
    label: "Cristiano Ronaldo",
    search: "Ronaldo",
    birthDate: "1985-02-05",
    nationality: "Portugal",
  },
  {
    label: "Ronaldinho",
    search: "Ronaldinho",
    birthDate: "1980-03-21",
    nationality: "Brazil",
  },
  {
    label: "Zinedine Zidane",
    search: "Zidane",
    birthDate: "1972-06-23",
    nationality: "France",
  },
  {
    label: "Erling Haaland",
    search: "Haaland",
    birthDate: "2000-07-21",
    nationality: "Norway",
  },
];

if (!apiKey) {
  console.error("❌ Falta API_FOOTBALL_KEY en .env.local");
  process.exit(1);
}

let requestCount = 0;
let lastRequestAt = 0;
let latestQuota = {
  dailyLimit: null,
  dailyRemaining: null,
  minuteLimit: null,
  minuteRemaining: null,
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForRequestSlot() {
  const elapsed = Date.now() - lastRequestAt;
  const waitMs = Math.max(0, MIN_REQUEST_INTERVAL_MS - elapsed);

  if (waitMs > 0) {
    process.stdout.write(`   ⏳ Esperando ${(waitMs / 1000).toFixed(1)} s para respetar el rate limit...\r`);
    await sleep(waitMs);
    process.stdout.write(" ".repeat(90) + "\r");
  }
}

function readQuotaHeaders(response) {
  latestQuota = {
    dailyLimit: response.headers.get("x-ratelimit-requests-limit"),
    dailyRemaining: response.headers.get("x-ratelimit-requests-remaining"),
    minuteLimit: response.headers.get("x-ratelimit-limit"),
    minuteRemaining: response.headers.get("x-ratelimit-remaining"),
  };
}

function quotaText() {
  const { dailyRemaining, dailyLimit, minuteRemaining, minuteLimit } = latestQuota;
  const parts = [];

  if (dailyRemaining != null && dailyLimit != null) {
    parts.push(`día ${dailyRemaining}/${dailyLimit}`);
  }

  if (minuteRemaining != null && minuteLimit != null) {
    parts.push(`minuto ${minuteRemaining}/${minuteLimit}`);
  }

  return parts.length ? parts.join(" · ") : "cuota no informada";
}

async function apiGet(path, attempt = 0) {
  await waitForRequestSlot();

  requestCount += 1;
  lastRequestAt = Date.now();

  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      "x-apisports-key": apiKey,
    },
  });

  readQuotaHeaders(response);

  let data;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  const hasRateLimitError =
    response.status === 429 ||
    Boolean(data?.errors?.rateLimit) ||
    Boolean(data?.errors?.requests);

  if (hasRateLimitError && attempt < MAX_RETRIES_429) {
    const retryAfterHeader = Number(response.headers.get("retry-after"));
    const retryAfterMs = Number.isFinite(retryAfterHeader) && retryAfterHeader > 0
      ? retryAfterHeader * 1000
      : 15000;

    console.log(
      `   ⚠️ Rate limit alcanzado. Reintento ${attempt + 1}/${MAX_RETRIES_429} en ${Math.ceil(retryAfterMs / 1000)} s...`,
    );

    await sleep(retryAfterMs);
    // Forzamos de nuevo el espaciado normal después de la espera.
    lastRequestAt = 0;
    return apiGet(path, attempt + 1);
  }

  if (!response.ok) {
    throw new Error(
      `API-Football respondió ${response.status}: ${JSON.stringify(data)}`,
    );
  }

  if (data?.errors && Object.keys(data.errors).length > 0) {
    throw new Error(`API-Football devolvió errores: ${JSON.stringify(data.errors)}`);
  }

  console.log(`   📡 Petición OK · ${quotaText()}`);
  return data;
}

function normalize(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function playerFromEntry(entry) {
  return entry?.player ?? entry;
}

function selectExactPlayer(entries, target) {
  const exact = entries.find((entry) => {
    const player = playerFromEntry(entry);
    return (
      player?.birth?.date === target.birthDate &&
      normalize(player?.nationality) === normalize(target.nationality)
    );
  });

  return exact ? playerFromEntry(exact) : null;
}

function printCandidates(entries) {
  console.log("   Candidatos recibidos:");
  for (const entry of entries.slice(0, 10)) {
    const player = playerFromEntry(entry);
    console.log(
      `   - ${player?.name ?? "?"} | ${player?.birth?.date ?? "sin fecha"} | ${player?.nationality ?? "sin nacionalidad"} | ID ${player?.id ?? "?"}`,
    );
  }
}

function uniqueSorted(values) {
  return [...new Set(values.filter(Boolean))].sort();
}

function summarizeTeams(response) {
  return (response ?? []).map((item) => ({
    id: item.team?.id ?? null,
    name: item.team?.name ?? "Equipo desconocido",
    logo: item.team?.logo ?? null,
    seasons: Array.isArray(item.seasons) ? item.seasons : [],
  }));
}

function summarizeTransfers(response) {
  const transfers = [];

  for (const playerBlock of response ?? []) {
    for (const transfer of playerBlock.transfers ?? []) {
      transfers.push({
        date: transfer.date ?? null,
        type: transfer.type ?? null,
        from: transfer.teams?.out?.name ?? null,
        fromId: transfer.teams?.out?.id ?? null,
        to: transfer.teams?.in?.name ?? null,
        toId: transfer.teams?.in?.id ?? null,
      });
    }
  }

  return transfers;
}

function summarizeTrophies(response) {
  return (response ?? []).map((trophy) => ({
    league: trophy.league ?? null,
    country: trophy.country ?? null,
    season: trophy.season ?? null,
    place: trophy.place ?? null,
  }));
}

function printProfile(player) {
  console.log(`   ID:           ${player.id}`);
  console.log(`   Nombre API:   ${player.name ?? "-"}`);
  console.log(
    `   Nombre real:  ${[player.firstname, player.lastname].filter(Boolean).join(" ") || "-"}`,
  );
  console.log(`   Nacimiento:   ${player.birth?.date ?? "-"}`);
  console.log(`   Nacionalidad: ${player.nationality ?? "-"}`);
  console.log(`   Altura:       ${player.height ?? "-"}`);
  console.log(`   Peso:         ${player.weight ?? "-"}`);
  console.log(`   Foto:         ${player.photo ?? "-"}`);
}

function printTeams(teams) {
  if (!teams.length) {
    console.log("   Equipos:      ⚠️ sin datos");
    return;
  }

  console.log(`   Equipos:      ${teams.length}`);
  for (const team of teams) {
    const seasons = team.seasons.length ? team.seasons.join(", ") : "sin temporadas";
    console.log(`      • ${team.name}: ${seasons}`);
  }
}

function printTransfers(transfers) {
  console.log(`   Transferencias: ${transfers.length}`);

  if (!transfers.length) {
    console.log("      ⚠️ sin datos");
    return;
  }

  for (const transfer of transfers.slice(0, 12)) {
    console.log(
      `      • ${transfer.date ?? "?"}: ${transfer.from ?? "?"} → ${transfer.to ?? "?"} (${transfer.type ?? "N/A"})`,
    );
  }

  if (transfers.length > 12) {
    console.log(`      … y ${transfers.length - 12} más`);
  }
}

function printTrophies(trophies) {
  console.log(`   Trofeos/honores: ${trophies.length}`);

  if (!trophies.length) {
    console.log("      ⚠️ sin datos");
    return;
  }

  for (const trophy of trophies.slice(0, 12)) {
    console.log(
      `      • ${trophy.season ?? "?"} · ${trophy.league ?? "?"} · ${trophy.place ?? "?"}`,
    );
  }

  if (trophies.length > 12) {
    console.log(`      … y ${trophies.length - 12} más`);
  }
}

async function inspectPlayer(target) {
  console.log("\n" + "═".repeat(72));
  console.log(`⚽ ${target.label}`);
  console.log("═".repeat(72));

  const profiles = await apiGet(
    `/players/profiles?search=${encodeURIComponent(target.search)}`,
  );

  const entries = profiles.response ?? [];
  const player = selectExactPlayer(entries, target);

  if (!player) {
    console.log(
      `❌ No pude identificar exactamente a ${target.label} (${target.birthDate}, ${target.nationality}).`,
    );
    printCandidates(entries);
    return {
      target,
      found: false,
      candidates: entries.slice(0, 10).map((entry) => playerFromEntry(entry)),
    };
  }

  console.log("\n🐐 PERFIL");
  printProfile(player);

  // En v2 se hacían estas tres llamadas en paralelo. En el plan Free eso
  // acelera demasiado. Ahora son secuenciales y pasan por el mismo throttle.
  const teamsData = await apiGet(`/players/teams?player=${player.id}`);
  const transfersData = await apiGet(`/transfers?player=${player.id}`);
  const trophiesData = await apiGet(`/trophies?player=${player.id}`);

  const teams = summarizeTeams(teamsData.response);
  const transfers = summarizeTransfers(transfersData.response);
  const trophies = summarizeTrophies(trophiesData.response);

  console.log("\n📚 TRAYECTORIA");
  printTeams(teams);

  console.log("\n🔁 MERCADO");
  printTransfers(transfers);

  console.log("\n🏆 PALMARÉS");
  printTrophies(trophies);

  return {
    target,
    found: true,
    player: {
      id: player.id,
      name: player.name ?? null,
      firstname: player.firstname ?? null,
      lastname: player.lastname ?? null,
      birth: player.birth ?? null,
      nationality: player.nationality ?? null,
      height: player.height ?? null,
      weight: player.weight ?? null,
      photo: player.photo ?? null,
    },
    teams,
    transfers,
    trophies,
    summary: {
      teamCount: teams.length,
      seasons: uniqueSorted(teams.flatMap((team) => team.seasons)),
      transferCount: transfers.length,
      trophyCount: trophies.length,
    },
  };
}

async function main() {
  console.log("⚽ 10 The GOAT · Laboratorio API-Football v2.2");
  console.log("Identificación segura: fecha de nacimiento + nacionalidad.");
  console.log("Prueba: perfil + trayectoria + transferencias + trofeos.");
  console.log(
    `Throttle: una petición cada ${(MIN_REQUEST_INTERVAL_MS / 1000).toFixed(1)} s + reintentos automáticos ante 429.\n`,
  );

  const results = [];

  for (const target of TEST_PLAYERS) {
    try {
      results.push(await inspectPlayer(target));
    } catch (error) {
      console.log(`\n❌ Error procesando ${target.label}: ${error.message}`);
      results.push({
        target,
        found: false,
        error: error.message,
      });
    }
  }

  await mkdir("tmp", { recursive: true });
  await writeFile(
    "tmp/api-football-lab.json",
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        requestCount,
        rateLimit: {
          minRequestIntervalMs: MIN_REQUEST_INTERVAL_MS,
          latestQuota,
        },
        results,
      },
      null,
      2,
    ),
    "utf8",
  );

  console.log("\n" + "═".repeat(72));
  console.log("📊 RESUMEN DEL LABORATORIO");
  console.log("═".repeat(72));

  for (const result of results) {
    if (!result.found) {
      console.log(`❌ ${result.target.label}: no identificado / error`);
      continue;
    }

    console.log(
      `✅ ${result.target.label}: ${result.summary.teamCount} equipos · ${result.summary.seasons.length} temporadas distintas · ${result.summary.transferCount} transferencias · ${result.summary.trophyCount} honores`,
    );
  }

  console.log(`\nPeticiones realizadas: ${requestCount}`);
  console.log(`Cuota final informada: ${quotaText()}`);
  console.log("Resultado completo: tmp/api-football-lab.json");
  console.log("🔐 La API key no se guarda ni se muestra.");
}

main().catch((error) => {
  console.error("\n❌ Error fatal en la prueba:");
  console.error(error.message);
  process.exit(1);
});
