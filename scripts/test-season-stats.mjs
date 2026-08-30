import { readFile, mkdir, writeFile } from "node:fs/promises";

const API_BASE = "https://v3.football.api-sports.io";
const apiKey = process.env.API_FOOTBALL_KEY;
const MIN_REQUEST_INTERVAL_MS = 6500;
const MAX_RETRIES_429 = 3;
const LAB_PATH = "tmp/api-football-lab.json";

const TEST_CASES = [
  { label: "Lionel Messi", season: 2018, expectedTeam: "Barcelona" },
  { label: "Cristiano Ronaldo", season: 2017, expectedTeam: "Real Madrid" },
  { label: "Ronaldinho", season: 2005, expectedTeam: "Barcelona" },
  { label: "Zinedine Zidane", season: 2002, expectedTeam: "Real Madrid" },
  { label: "Erling Haaland", season: 2024, expectedTeam: "Manchester City" },
];

if (!apiKey) {
  console.error("❌ Falta API_FOOTBALL_KEY en .env.local");
  process.exit(1);
}

let requestCount = 0;
let lastRequestAt = 0;
let latestQuota = {};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForRequestSlot() {
  const elapsed = Date.now() - lastRequestAt;
  const waitMs = Math.max(0, MIN_REQUEST_INTERVAL_MS - elapsed);
  if (waitMs > 0) {
    process.stdout.write(`   ⏳ Esperando ${(waitMs / 1000).toFixed(1)} s...\r`);
    await sleep(waitMs);
    process.stdout.write(" ".repeat(70) + "\r");
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
  const parts = [];
  if (latestQuota.dailyRemaining != null && latestQuota.dailyLimit != null) {
    parts.push(`día ${latestQuota.dailyRemaining}/${latestQuota.dailyLimit}`);
  }
  if (latestQuota.minuteRemaining != null && latestQuota.minuteLimit != null) {
    parts.push(`minuto ${latestQuota.minuteRemaining}/${latestQuota.minuteLimit}`);
  }
  return parts.length ? parts.join(" · ") : "cuota no informada";
}

async function apiGet(path, attempt = 0) {
  await waitForRequestSlot();
  requestCount += 1;
  lastRequestAt = Date.now();

  const response = await fetch(`${API_BASE}${path}`, {
    headers: { "x-apisports-key": apiKey },
  });
  readQuotaHeaders(response);

  let data;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  const hasRateLimitError =
    response.status === 429 || Boolean(data?.errors?.rateLimit) || Boolean(data?.errors?.requests);

  if (hasRateLimitError && attempt < MAX_RETRIES_429) {
    const retryAfterHeader = Number(response.headers.get("retry-after"));
    const retryAfterMs = Number.isFinite(retryAfterHeader) && retryAfterHeader > 0
      ? retryAfterHeader * 1000
      : 15000;
    console.log(`   ⚠️ Rate limit. Reintento ${attempt + 1}/${MAX_RETRIES_429} en ${Math.ceil(retryAfterMs / 1000)} s...`);
    await sleep(retryAfterMs);
    lastRequestAt = 0;
    return apiGet(path, attempt + 1);
  }

  // En esta prueba nos interesa conservar los errores del proveedor, por ejemplo
  // una temporada histórica no disponible en el plan Free.
  if (!response.ok || (data?.errors && Object.keys(data.errors).length > 0)) {
    return {
      ok: false,
      status: response.status,
      errors: data?.errors ?? { http: response.statusText },
      raw: data,
    };
  }

  console.log(`   📡 Petición OK · ${quotaText()}`);
  return { ok: true, status: response.status, data };
}

async function loadPlayerIds() {
  try {
    const raw = await readFile(LAB_PATH, "utf8");
    const lab = JSON.parse(raw);
    const ids = new Map();
    for (const result of lab.results ?? []) {
      if (result?.found && result?.player?.id && result?.target?.label) {
        ids.set(result.target.label, result.player.id);
      }
    }
    return ids;
  } catch {
    return new Map();
  }
}

function num(value) {
  return typeof value === "number" ? value : value ?? null;
}

function summarizeStat(stat) {
  return {
    team: stat.team?.name ?? null,
    teamId: stat.team?.id ?? null,
    league: stat.league?.name ?? null,
    leagueId: stat.league?.id ?? null,
    country: stat.league?.country ?? null,
    season: stat.league?.season ?? null,
    appearances: num(stat.games?.appearences),
    lineups: num(stat.games?.lineups),
    minutes: num(stat.games?.minutes),
    position: stat.games?.position ?? null,
    rating: stat.games?.rating ?? null,
    captain: stat.games?.captain ?? null,
    goals: num(stat.goals?.total),
    assists: num(stat.goals?.assists),
    conceded: num(stat.goals?.conceded),
    saves: num(stat.goals?.saves),
    shots: num(stat.shots?.total),
    shotsOn: num(stat.shots?.on),
    passes: num(stat.passes?.total),
    keyPasses: num(stat.passes?.key),
    passAccuracy: stat.passes?.accuracy ?? null,
    tackles: num(stat.tackles?.total),
    interceptions: num(stat.tackles?.interceptions),
    duels: num(stat.duels?.total),
    duelsWon: num(stat.duels?.won),
    dribbles: num(stat.dribbles?.attempts),
    dribblesSuccess: num(stat.dribbles?.success),
    foulsDrawn: num(stat.fouls?.drawn),
    foulsCommitted: num(stat.fouls?.committed),
    yellow: num(stat.cards?.yellow),
    red: num(stat.cards?.red),
    penaltiesScored: num(stat.penalty?.scored),
    penaltiesMissed: num(stat.penalty?.missed),
  };
}

function printCompetition(stat) {
  console.log(`   • ${stat.team ?? "?"} · ${stat.league ?? "?"} (${stat.country ?? "?"})`);
  console.log(
    `     PJ ${stat.appearances ?? "-"} · Tit ${stat.lineups ?? "-"} · Min ${stat.minutes ?? "-"} · G ${stat.goals ?? "-"} · A ${stat.assists ?? "-"} · Nota ${stat.rating ?? "-"}`,
  );
}

function sumKnown(stats, key) {
  const values = stats.map((s) => s[key]).filter((v) => typeof v === "number");
  return values.length ? values.reduce((a, b) => a + b, 0) : null;
}

async function main() {
  console.log("⚽ 10 The GOAT · Laboratorio de estadísticas por temporada v0.2.3");
  console.log("Objetivo: comprobar hasta dónde llega el histórico de /players.\n");

  const ids = await loadPlayerIds();
  if (ids.size) {
    console.log(`✅ IDs reutilizados desde ${LAB_PATH}: ${ids.size}`);
  } else {
    console.log(`⚠️ No encontré ${LAB_PATH}. Ejecuta primero npm run test:football para obtener los IDs.`);
    process.exit(1);
  }

  const results = [];

  for (const test of TEST_CASES) {
    console.log("\n" + "═".repeat(72));
    console.log(`⚽ ${test.label} · temporada ${test.season}`);
    console.log("═".repeat(72));

    const playerId = ids.get(test.label);
    if (!playerId) {
      console.log("❌ No hay ID guardado para este jugador.");
      results.push({ ...test, ok: false, error: "missing_player_id" });
      continue;
    }

    console.log(`   ID API-Football: ${playerId}`);
    const response = await apiGet(`/players?id=${playerId}&season=${test.season}`);

    if (!response.ok) {
      console.log(`   ❌ API-Football no devolvió estadísticas.`);
      console.log(`   Estado HTTP: ${response.status}`);
      console.log(`   Error: ${JSON.stringify(response.errors)}`);
      results.push({
        ...test,
        playerId,
        ok: false,
        status: response.status,
        errors: response.errors,
      });
      continue;
    }

    const entry = response.data?.response?.[0];
    const stats = (entry?.statistics ?? []).map(summarizeStat);

    if (!entry || stats.length === 0) {
      console.log("   ⚠️ La petición fue válida, pero la API devolvió 0 bloques estadísticos.");
      results.push({ ...test, playerId, ok: true, empty: true, stats: [] });
      continue;
    }

    console.log(`   Perfil: ${entry.player?.name ?? test.label}`);
    console.log(`   Bloques por competición: ${stats.length}\n`);
    stats.forEach(printCompetition);

    const expected = stats.filter((s) =>
      (s.team ?? "").toLowerCase().includes(test.expectedTeam.toLowerCase()),
    );
    const base = expected.length ? expected : stats;

    const totals = {
      appearances: sumKnown(base, "appearances"),
      lineups: sumKnown(base, "lineups"),
      minutes: sumKnown(base, "minutes"),
      goals: sumKnown(base, "goals"),
      assists: sumKnown(base, "assists"),
    };

    console.log(`\n   📊 Total ${expected.length ? test.expectedTeam : "devuelto"}: PJ ${totals.appearances ?? "-"} · Min ${totals.minutes ?? "-"} · G ${totals.goals ?? "-"} · A ${totals.assists ?? "-"}`);

    results.push({
      ...test,
      playerId,
      ok: true,
      empty: false,
      player: entry.player ?? null,
      stats,
      expectedTeamMatched: expected.length > 0,
      totals,
    });
  }

  await mkdir("tmp", { recursive: true });
  await writeFile(
    "tmp/api-football-season-stats.json",
    JSON.stringify({
      generatedAt: new Date().toISOString(),
      requestCount,
      latestQuota,
      results,
    }, null, 2),
    "utf8",
  );

  console.log("\n" + "═".repeat(72));
  console.log("📊 RESUMEN HISTÓRICO");
  console.log("═".repeat(72));
  for (const r of results) {
    if (!r.ok) {
      console.log(`❌ ${r.label} ${r.season}: ERROR / temporada no accesible`);
    } else if (r.empty) {
      console.log(`⚠️ ${r.label} ${r.season}: petición válida, sin estadísticas`);
    } else {
      console.log(`✅ ${r.label} ${r.season}: ${r.stats.length} bloques · PJ ${r.totals.appearances ?? "-"} · G ${r.totals.goals ?? "-"} · A ${r.totals.assists ?? "-"}`);
    }
  }

  console.log(`\nPeticiones realizadas: ${requestCount}`);
  console.log(`Cuota final: ${quotaText()}`);
  console.log("Resultado completo: tmp/api-football-season-stats.json");
  console.log("🔐 La API key no se guarda ni se muestra.");
}

main().catch((error) => {
  console.error("\n❌ Error fatal:", error.message);
  process.exit(1);
});
