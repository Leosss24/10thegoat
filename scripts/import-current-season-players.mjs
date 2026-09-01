import { createClient } from "@supabase/supabase-js";

const API_BASE = "https://v3.football.api-sports.io";
const PROVIDER = "api_football";
const SEASON = Number(process.env.API_FOOTBALL_SEASON || "2026");
const MIN_DELAY_MS = Number(process.env.API_FOOTBALL_MIN_DELAY_MS || "1500");
const MAX_RETRIES = 5;

const LEAGUES = [
  { id: 140, name: "LaLiga", country: "Spain" },
  { id: 39, name: "Premier League", country: "England" },
  { id: 135, name: "Serie A", country: "Italy" },
  { id: 78, name: "Bundesliga", country: "Germany" },
  { id: 61, name: "Ligue 1", country: "France" },
  { id: 128, name: "Liga Profesional Argentina", country: "Argentina" },
];

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;
const API_KEY = process.env.API_FOOTBALL_KEY;

if (!SUPABASE_URL || !SUPABASE_SECRET_KEY || !API_KEY) {
  console.error("Faltan variables de entorno.");
  console.error("Necesarias: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY, API_FOOTBALL_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const args = new Set(process.argv.slice(2));
const DRY_RUN = args.has("--dry-run");

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

let lastApiCallAt = 0;
let apiRequests = 0;

function parseIntNullable(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number.parseInt(String(value).replace(/[^\d]/g, ""), 10);
  return Number.isFinite(n) ? n : null;
}

function cleanText(value) {
  if (typeof value !== "string") return null;
  const v = value.trim();
  return v || null;
}

async function apiGet(path, attempt = 1) {
  const sinceLast = Date.now() - lastApiCallAt;
  if (sinceLast < MIN_DELAY_MS) {
    await sleep(MIN_DELAY_MS - sinceLast);
  }

  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      "x-apisports-key": API_KEY,
    },
  });

  lastApiCallAt = Date.now();
  apiRequests += 1;

  let body;
  try {
    body = await response.json();
  } catch {
    body = null;
  }

  const rateLimitError =
    body?.errors?.rateLimit ||
    body?.errors?.rate_limit ||
    body?.errors?.requests;

  if (response.status === 429 || rateLimitError) {
    if (attempt >= MAX_RETRIES) {
      throw new Error(`Rate limit tras ${MAX_RETRIES} intentos en ${path}`);
    }

    console.warn(`⚠️ Rate limit. Esperando 65 s (intento ${attempt}/${MAX_RETRIES})...`);
    await sleep(65_000);
    return apiGet(path, attempt + 1);
  }

  if (!response.ok) {
    throw new Error(`API-Football HTTP ${response.status}: ${JSON.stringify(body?.errors ?? body)}`);
  }

  if (body?.errors && Object.keys(body.errors).length > 0) {
    throw new Error(`API-Football error: ${JSON.stringify(body.errors)}`);
  }

  return body;
}

async function loadAllRows(table, columns) {
  const PAGE_SIZE = 1000;
  const rows = [];
  let from = 0;

  while (true) {
    const to = from + PAGE_SIZE - 1;

    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .eq("provider", PROVIDER)
      .range(from, to);

    if (error) throw error;

    const page = data ?? [];
    rows.push(...page);

    if (page.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return rows;
}

async function loadClubMap() {
  const data = await loadAllRows("club_external_ids", "club_id,external_id");

  console.log(`Mappings de clubes cargados: ${data.length}`);

  return new Map(
    data.map((row) => [String(row.external_id), Number(row.club_id)])
  );
}

async function loadPlayerExternalMap() {
  const data = await loadAllRows("player_external_ids", "player_id,external_id");

  console.log(`Mappings de jugadores cargados: ${data.length}`);

  return new Map(
    data.map((row) => [String(row.external_id), Number(row.player_id)])
  );
}

async function updatePlayer(playerId, payload) {
  if (DRY_RUN) return;

  const { error } = await supabase
    .from("players")
    .update(payload)
    .eq("id", playerId);

  if (error) throw error;
}

async function insertPlayer(payload, externalId) {
  if (DRY_RUN) {
    return -Number(externalId);
  }

  const { data, error } = await supabase
    .from("players")
    .insert(payload)
    .select("id")
    .single();

  if (error) throw error;

  const playerId = Number(data.id);

  const { error: mappingError } = await supabase
    .from("player_external_ids")
    .insert({
      player_id: playerId,
      provider: PROVIDER,
      external_id: String(externalId),
    });

  if (mappingError) throw mappingError;

  return playerId;
}

async function markCurrentClub(playerId, clubId) {
  if (DRY_RUN || playerId < 0) return;

  // Only this player's previous "current" rows are changed.
  const { error: clearError } = await supabase
    .from("player_club_seasons")
    .update({ is_current: false })
    .eq("player_id", playerId)
    .eq("is_current", true);

  if (clearError) throw clearError;

  const { data: existing, error: existingError } = await supabase
    .from("player_club_seasons")
    .select("id")
    .eq("player_id", playerId)
    .eq("club_id", clubId)
    .eq("season_start_year", SEASON)
    .maybeSingle();

  if (existingError) throw existingError;

  if (existing?.id) {
    const { error } = await supabase
      .from("player_club_seasons")
      .update({
        is_current: true,
        source_provider: PROVIDER,
        last_synced_at: new Date().toISOString(),
      })
      .eq("id", existing.id);

    if (error) throw error;
  } else {
    const { error } = await supabase
      .from("player_club_seasons")
      .insert({
        player_id: playerId,
        club_id: clubId,
        season_start_year: SEASON,
        is_current: true,
        source_provider: PROVIDER,
        last_synced_at: new Date().toISOString(),
      });

    if (error) throw error;
  }
}

function normalizePrimaryPosition(value) {
  const raw = cleanText(value);
  if (!raw) return null;

  const normalized = raw.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  if (["gk", "goalkeeper", "keeper", "goalie", "portero"].includes(normalized)) return "Goalkeeper";
  if (["attacker", "forward", "striker"].includes(normalized)) return "Attacker";
  if (["midfielder", "midfield"].includes(normalized)) return "Midfielder";
  if (["defender", "defence", "defense"].includes(normalized)) return "Defender";
  return raw;
}

function buildPlayerPayload(apiPlayer, stat) {
  return {
    display_name:
      cleanText(apiPlayer.name) ||
      cleanText(`${apiPlayer.firstname ?? ""} ${apiPlayer.lastname ?? ""}`) ||
      `Jugador ${apiPlayer.id}`,
    full_name:
      cleanText(`${apiPlayer.firstname ?? ""} ${apiPlayer.lastname ?? ""}`) ||
      cleanText(apiPlayer.name),
    first_name: cleanText(apiPlayer.firstname),
    last_name: cleanText(apiPlayer.lastname),
    birth_date: cleanText(apiPlayer.birth?.date),
    height_cm: parseIntNullable(apiPlayer.height),
    weight_kg: parseIntNullable(apiPlayer.weight),
    primary_position: normalizePrimaryPosition(stat?.games?.position),
    photo_url: cleanText(apiPlayer.photo),
    is_active: true,
    is_retired: false,
    updated_at: new Date().toISOString(),
  };
}

async function importLeague(league, clubMap, playerExternalMap, counters) {
  console.log(`\n=== ${league.name} (${league.country}) · temporada ${SEASON} ===`);

  let page = 1;
  let totalPages = 1;

  do {
    const body = await apiGet(`/players?league=${league.id}&season=${SEASON}&page=${page}`);

    totalPages = Number(body?.paging?.total ?? 1);
    const rows = Array.isArray(body?.response) ? body.response : [];

    console.log(`Página ${page}/${totalPages} · ${rows.length} jugadores`);

    for (const row of rows) {
      const apiPlayer = row?.player;
      const stats = Array.isArray(row?.statistics) ? row.statistics : [];
      const stat =
        stats.find((s) => Number(s?.league?.id) === league.id) ||
        stats[0];

      if (!apiPlayer?.id || !stat?.team?.id) {
        counters.skipped += 1;
        continue;
      }

      const apiPlayerId = String(apiPlayer.id);
      const apiTeamId = String(stat.team.id);
      const clubId = clubMap.get(apiTeamId);

      if (!clubId) {
        console.warn(
          `  ⚠️ Club API ${apiTeamId} (${stat?.team?.name ?? "sin nombre"}) no está mapeado en club_external_ids. Jugador omitido: ${apiPlayer.name}`
        );
        counters.missingClub += 1;
        continue;
      }

      const payload = buildPlayerPayload(apiPlayer, stat);
      let playerId = playerExternalMap.get(apiPlayerId);

      try {
        if (playerId) {
          await updatePlayer(playerId, payload);
          counters.updated += 1;
        } else {
          playerId = await insertPlayer(payload, apiPlayerId);
          playerExternalMap.set(apiPlayerId, playerId);
          counters.inserted += 1;
        }

        await markCurrentClub(playerId, clubId);
        counters.clubLinks += 1;
      } catch (error) {
        counters.errors += 1;
        console.error(`  ❌ ${apiPlayer.name} (${apiPlayerId}): ${error.message}`);
      }
    }

    page += 1;
  } while (page <= totalPages);
}

async function main() {
  console.log("10theGOAT · importador de jugadores de temporada actual");
  console.log(`Temporada: ${SEASON}`);
  console.log(`Rate limit local: 1 petición cada ${MIN_DELAY_MS} ms (~${Math.floor(60000 / MIN_DELAY_MS)}/min)`);
  console.log(`Modo: ${DRY_RUN ? "DRY RUN" : "ESCRITURA REAL"}`);

  const [clubMap, playerExternalMap] = await Promise.all([
    loadClubMap(),
    loadPlayerExternalMap(),
  ]);

  const counters = {
    inserted: 0,
    updated: 0,
    clubLinks: 0,
    missingClub: 0,
    skipped: 0,
    errors: 0,
  };

  for (const league of LEAGUES) {
    await importLeague(league, clubMap, playerExternalMap, counters);
  }

  console.log("\n================ RESULTADO ================");
  console.log(`Temporada: ${SEASON}`);
  console.log(`Ligas: ${LEAGUES.length}`);
  console.log(`Jugadores nuevos: ${counters.inserted}`);
  console.log(`Jugadores actualizados: ${counters.updated}`);
  console.log(`Relaciones club actual: ${counters.clubLinks}`);
  console.log(`Omitidos por club sin mapping: ${counters.missingClub}`);
  console.log(`Omitidos por datos incompletos: ${counters.skipped}`);
  console.log(`Errores: ${counters.errors}`);
  console.log(`Peticiones API usadas: ${apiRequests}`);
  console.log("===========================================");

  if (DRY_RUN) {
    console.log("\nDRY RUN: no se ha escrito nada en Supabase.");
  }
}

main().catch((error) => {
  console.error("\nIMPORTACIÓN ABORTADA");
  console.error(error);
  process.exit(1);
});
