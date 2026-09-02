import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const API_BASE = "https://v3.football.api-sports.io";
const PROVIDER = "api_football";
const PAGE_SIZE = 1000;

const apiKey = process.env.API_FOOTBALL_KEY;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

if (!apiKey) {
  throw new Error("Falta API_FOOTBALL_KEY en .env.local");
}

if (!supabaseUrl) {
  throw new Error("Falta NEXT_PUBLIC_SUPABASE_URL en .env.local");
}

if (!supabaseSecretKey) {
  throw new Error("Falta SUPABASE_SECRET_KEY en .env.local");
}

const supabase = createClient(
  supabaseUrl,
  supabaseSecretKey,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
);

/* =========================================================
   LIGAS JUGABLES
   ========================================================= */

const LEAGUES_BY_COUNTRY = {
  Spain: [
    { id: 140, name: "LaLiga", tier: 1 },
    { id: 141, name: "Segunda División", tier: 2 },
  ],

  England: [
    { id: 39, name: "Premier League", tier: 1 },
    { id: 40, name: "Championship", tier: 2 },
  ],

  Germany: [
    { id: 78, name: "Bundesliga", tier: 1 },
    { id: 79, name: "2. Bundesliga", tier: 2 },
  ],

  Italy: [
    { id: 135, name: "Serie A", tier: 1 },
    { id: 136, name: "Serie B", tier: 2 },
  ],

  France: [
    { id: 61, name: "Ligue 1", tier: 1 },
    { id: 62, name: "Ligue 2", tier: 2 },
  ],

  Portugal: [
    { id: 94, name: "Primeira Liga", tier: 1 },
    { id: 95, name: "Liga Portugal 2", tier: 2 },
  ],

  Netherlands: [
    { id: 88, name: "Eredivisie", tier: 1 },
    { id: 89, name: "Eerste Divisie", tier: 2 },
  ],

  Belgium: [
    { id: 144, name: "Pro League", tier: 1 },
    { id: 145, name: "Challenger Pro League", tier: 2 },
  ],

  Scotland: [
    { id: 179, name: "Premiership", tier: 1 },
    { id: 180, name: "Championship", tier: 2 },
  ],

  Turkey: [
    { id: 203, name: "Süper Lig", tier: 1 },
    { id: 204, name: "1. Lig", tier: 2 },
  ],

  Brazil: [
    { id: 71, name: "Série A", tier: 1 },
    { id: 72, name: "Série B", tier: 2 },
  ],

  Argentina: [
    { id: 128, name: "Liga Profesional Argentina", tier: 1 },
    { id: 129, name: "Primera Nacional", tier: 2 },
  ],

  Uruguay: [
    { id: 268, name: "Primera División", tier: 1 },
  ],

  Chile: [
    { id: 265, name: "Primera División", tier: 1 },
  ],

  Poland: [
    { id: 106, name: "Ekstraklasa", tier: 1 },
  ],
};

const DEFAULT_COUNTRIES = Object.keys(LEAGUES_BY_COUNTRY);
const HARD_POOL_COUNTRIES = new Set([
  "Spain",
  "England",
  "Germany",
  "Italy",
  "France",
  "Argentina",
]);
const PREMIUM_CLUBS=new Set(["real madrid","barcelona","manchester city","manchester united","liverpool","arsenal","chelsea","bayern munchen","borussia dortmund","juventus","inter","ac milan","paris saint germain","river plate","boca juniors","flamengo","palmeiras","corinthians","sao paulo","santos","gremio","penarol","nacional"]);
const ELITE_INTERNATIONAL_CLUBS=new Set(["atletico de madrid","tottenham","napoli","roma","marseille","lyon","benfica","sporting cp","porto","ajax","psv","psv eindhoven","feyenoord","independiente","racing club","san lorenzo"]);
const ELITE_NATIONAL_CLUBS=new Set(["athletic club","real sociedad","valencia","west ham","rennes","freiburg","az alkmaar","genk","argentinos juniors","velez sarsfield","newells old boys","rosario central"]);
function careerCategory(name,tier){const key=normalize(name);return PREMIUM_CLUBS.has(key)?"premium_international":ELITE_INTERNATIONAL_CLUBS.has(key)?"elite_international":ELITE_NATIONAL_CLUBS.has(key)?"elite_national":tier===2?"national_b":"national"}

/* =========================================================
   TEMPORADA
   ========================================================= */

function currentFootballSeasonStartYear(now = new Date()) {
  const year = now.getUTCFullYear();

  return now.getUTCMonth() >= 6
    ? year
    : year - 1;
}

/* =========================================================
   NORMALIZACIÓN
   ========================================================= */

function normalize(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/* =========================================================
   ARGUMENTOS
   ========================================================= */

function parseArgs() {
  const args = process.argv.slice(2);

  const getValue = (name) => {
    const prefix = `--${name}=`;

    return (
      args.find((arg) => arg.startsWith(prefix))
        ?.slice(prefix.length) ?? null
    );
  };

  const countryValue = getValue("countries");
  const planPath = getValue("plan");

  const countries = countryValue
    ? countryValue
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean)
    : DEFAULT_COUNTRIES;

  const seasonRaw = getValue("season");

  const season = seasonRaw
    ? Number(seasonRaw)
    : currentFootballSeasonStartYear();

  if (
    !Number.isInteger(season) ||
    season < 2000 ||
    season > 2200
  ) {
    throw new Error(
      `Temporada inválida: ${seasonRaw}`
    );
  }

  for (const country of planPath ? [] : countries) {
    if (!LEAGUES_BY_COUNTRY[country]) {
      throw new Error(
        `País no configurado: ${country}`
      );
    }
  }

  return {
    countries,
    season,
    dryRun: args.includes("--dry-run"),
    preserveEligible:
      args.includes("--preserve-eligible"),
    planPath,
  };
}

/* =========================================================
   UTILS
   ========================================================= */

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/* =========================================================
   SUPABASE: CARGA PAGINADA
   ========================================================= */

async function fetchAll(
  table,
  columns,
  configure = (query) => query
) {
  const rows = [];
  let from = 0;

  while (true) {
    let query = supabase
      .from(table)
      .select(columns)
      .range(
        from,
        from + PAGE_SIZE - 1
      );

    query = configure(query);

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    rows.push(...(data ?? []));

    if (
      !data ||
      data.length < PAGE_SIZE
    ) {
      break;
    }

    from += PAGE_SIZE;
  }

  return rows;
}

/* =========================================================
   API-FOOTBALL + RATE LIMIT
   ========================================================= */

let apiRequests = 0;
let lastRemaining = null;
let lastRequestAt = 0;

const API_REQUEST_INTERVAL_MS = 1500;
const RATE_LIMIT_WAIT_MS = 65000;
const MAX_RETRIES = 5;

async function apiGet(path, attempt = 1) {
  const elapsed =
    Date.now() - lastRequestAt;

  if (
    elapsed <
    API_REQUEST_INTERVAL_MS
  ) {
    await sleep(
      API_REQUEST_INTERVAL_MS -
        elapsed
    );
  }

  lastRequestAt = Date.now();

  const response = await fetch(
    `${API_BASE}${path}`,
    {
      headers: {
        "x-apisports-key":
          apiKey,
      },
    }
  );

  apiRequests += 1;

  const remainingHeader =
    response.headers.get(
      "x-ratelimit-requests-remaining"
    );

  if (
    remainingHeader !==
    null
  ) {
    lastRemaining =
      remainingHeader;
  }

  let data;

  try {
    data =
      await response.json();
  } catch {
    throw new Error(
      `API-Football devolvió una respuesta no JSON. HTTP ${response.status}`
    );
  }

  const apiErrors =
    data?.errors &&
    typeof data.errors ===
      "object"
      ? data.errors
      : {};

  const rateLimitError =
    apiErrors.rateLimit ||
    response.status === 429;

  if (rateLimitError) {
    if (
      attempt >= MAX_RETRIES
    ) {
      throw new Error(
        `API-Football sigue limitado tras ${MAX_RETRIES} intentos: ${JSON.stringify(
          apiErrors
        )}`
      );
    }

    console.log("");
    console.log(
      "⏳ Rate limit alcanzado."
    );

    console.log(
      "   Esperando 65 segundos antes de reintentar..."
    );

    console.log(
      `   Reintento ${
        attempt + 1
      }/${MAX_RETRIES}`
    );

    await sleep(
      RATE_LIMIT_WAIT_MS
    );

    return apiGet(
      path,
      attempt + 1
    );
  }

  if (!response.ok) {
    throw new Error(
      `API-Football HTTP ${response.status}: ${JSON.stringify(
        data
      )}`
    );
  }

  if (
    Object.keys(
      apiErrors
    ).length > 0
  ) {
    throw new Error(
      `API-Football: ${JSON.stringify(
        apiErrors
      )}`
    );
  }

  return data;
}

/* =========================================================
   COUNTRY
   ========================================================= */

async function ensureCountry(
  countryName,
  countryByName
) {
  const key =
    normalize(countryName);

  const existing =
    countryByName.get(key);

  if (existing) {
    return existing;
  }

  const { data, error } =
    await supabase
      .from("countries")
      .insert({
        name: countryName,
      })
      .select("id,name")
      .single();

  if (error) {
    throw error;
  }

  countryByName.set(
    key,
    data
  );

  return data;
}

function teamKey(
  countryId,
  name
) {
  return `${
    countryId ?? "null"
  }:${normalize(name)}`;
}

/* =========================================================
   MAIN
   ========================================================= */

async function main() {
  const options =
    parseArgs();

  const selectedLeagues = options.planPath
    ? JSON.parse(readFileSync(options.planPath,"utf8")).leagues.filter((league)=>league.selected&&(league.tier===1||league.tier===2))
    : options.countries.flatMap(
      (country) =>
        LEAGUES_BY_COUNTRY[
          country
        ].map((league) => ({
          ...league,
          country,
        }))
    );
  const selectedCountries=[...new Set(selectedLeagues.map((league)=>league.country))];

  console.log(
    "============================================================"
  );

  console.log(
    "  10theGOAT · CLUBES JUGABLES (LIGA + TEMPORADA)"
  );

  console.log(
    "============================================================"
  );

  console.log(
    `Países: ${selectedCountries.join(
      ", "
    )}`
  );

  console.log(
    `Temporada API-Football: ${
      options.season
    }/${String(
      options.season + 1
    ).slice(-2)}`
  );

  console.log(
    `Ligas: ${selectedLeagues.length}`
  );

  console.log(
    `Peticiones API previstas: ${selectedLeagues.length}`
  );

  console.log(
    `Modo: ${
      options.dryRun
        ? "DRY RUN"
        : "IMPORTACIÓN REAL"
    }`
  );

  console.log("");

  /* =======================================================
     PRECARGA SUPABASE
     ======================================================= */

  console.log(
    "Precargando Supabase para evitar consultas por equipo..."
  );

  const [
    countries,
    clubs,
    mappings,
  ] = await Promise.all([
    fetchAll(
      "countries",
      "id,name"
    ),

    fetchAll(
      "clubs",
      "id,name,country_id,badge_url,is_national_team,is_active,is_game_eligible"
    ),

    fetchAll(
      "club_external_ids",
      "club_id,provider,external_id",
      (query) =>
        query.eq(
          "provider",
          PROVIDER
        )
    ),
  ]);

  console.log(
    `✓ ${countries.length} países cargados`
  );

  console.log(
    `✓ ${clubs.length} clubes cargados`
  );

  console.log(
    `✓ ${mappings.length} mappings API cargados`
  );

  console.log("");

  const countryByName =
    new Map(
      countries.map(
        (country) => [
          normalize(
            country.name
          ),
          country,
        ]
      )
    );

  const clubById =
    new Map(
      clubs.map(
        (club) => [
          Number(club.id),
          club,
        ]
      )
    );

  const clubByExternal =
    new Map(
      mappings.map(
        (mapping) => [
          String(
            mapping.external_id
          ),
          Number(
            mapping.club_id
          ),
        ]
      )
    );

  const clubByNameCountry =
    new Map(
      clubs.map(
        (club) => [
          teamKey(
            club.country_id,
            club.name
          ),
          club,
        ]
      )
    );

  /* =======================================================
     DESCARGAR LIGAS
     ======================================================= */

  const leagueResults = [];

  for (
    const league
    of selectedLeagues
  ) {
    process.stdout.write(
      `API → ${league.country} · ${league.name} (ID ${league.id})... `
    );

    const data =
      await apiGet(
        `/teams?league=${league.id}&season=${league.season??options.season}`
      );

    const teams =
      (data.response ?? [])
        .map(
          (entry) =>
            entry.team
        )
        .filter(
          (team) =>
            team?.id &&
            team?.name &&
            !team.national
        );

    leagueResults.push({
      league,
      teams,
    });

    console.log(
      `${teams.length} equipos`
    );
  }

  console.log("");

  console.log(
    `API usada: ${apiRequests} peticiones${
      lastRemaining
        ? ` · restantes según API: ${lastRemaining}`
        : ""
    }`
  );

  console.log("");

  /* =======================================================
     RESET ELEGIBILIDAD
     ======================================================= */

  if (!options.dryRun) {
    for (const countryName of selectedCountries) {
      if (!HARD_POOL_COUNTRIES.has(countryName)) continue;

      const country = countryByName.get(normalize(countryName));
      if (!country) continue;

      const { error } = await supabase
        .from("clubs")
        .update({ is_hard_player_pool: false })
        .eq("country_id", country.id)
        .eq("is_national_team", false);

      if (error) throw error;

      console.log(`♻️  ${countryName}: dificultad Difícil anterior → false`);
    }

    console.log("");
  }

  if (
    !options.dryRun &&
    !options.preserveEligible
  ) {
    for (
      const countryName
      of selectedCountries
    ) {
      const country =
        countryByName.get(
          normalize(
            countryName
          )
        );

      if (!country) {
        continue;
      }

      const { error } =
        await supabase
          .from("clubs")
          .update({
            is_game_eligible:
              false,
          })
          .eq(
            "country_id",
            country.id
          )
          .eq(
            "is_national_team",
            false
          );

      if (error) {
        throw error;
      }

      console.log(
        `♻️  ${countryName}: elegibilidad anterior → false`
      );
    }

    console.log("");
  }

  /* =======================================================
     IMPORTACIÓN
     ======================================================= */

  const totals = {
    apiTeams: 0,
    existingByApi: 0,
    existingByName: 0,
    created: 0,
    updated: 0,
    mappingsCreated: 0,
    errors: 0,
  };

  const processedApiIds =
    new Set();

  for (
    const {
      league,
      teams,
    }
    of leagueResults
  ) {
    console.log(
      `--- ${league.country} · ${league.name} ---`
    );

    let position = 0;

    let country =
      countryByName.get(
        normalize(
          league.country
        )
      );

    if (!country) {
      if (
        options.dryRun
      ) {
        console.log(
          `⚠️ ${league.country} no existe en Supabase; se crearía en import real.`
        );

        country = {
          id: null,
          name:
            league.country,
        };
      } else {
        country =
          await ensureCountry(
            league.country,
            countryByName
          );
      }
    }

    for (
      const team
      of teams
    ) {
      const apiId =
        String(team.id);

      if (
        processedApiIds.has(
          apiId
        )
      ) {
        continue;
      }

      processedApiIds.add(
        apiId
      );

      totals.apiTeams += 1;
      position += 1;

      try {
        /* ================================================
           MATCH POR API-ID
           ================================================ */

        const mappedClubId =
          clubByExternal.get(
            apiId
          );

        let club =
          mappedClubId
            ? clubById.get(
                mappedClubId
              )
            : null;

        let matchType =
          "api";

        /* ================================================
           FALLBACK NOMBRE + PAÍS
           ================================================ */

        if (
          !club &&
          country.id !== null
        ) {
          club =
            clubByNameCountry.get(
              teamKey(
                country.id,
                team.name
              )
            ) ?? null;

          matchType =
            "name";
        }

        const payload = {
          name: team.name,

          country_id:
            country.id,

          founded_year:
            Number.isInteger(
              team.founded
            )
              ? team.founded
              : null,

          is_national_team:
            false,

          badge_url:
            team.logo ?? null,

          is_active:
            true,

          is_game_eligible:
            true,

          is_hard_player_pool:
            HARD_POOL_COUNTRIES.has(league.country) && league.tier === 1,

          career_category:careerCategory(team.name,league.tier),
          domestic_division:league.tier,
          domestic_league_name:league.name,
          domestic_league_external_id:String(league.id),
          domestic_season_start_year:league.season??options.season,

          updated_at:
            new Date()
              .toISOString(),
        };

        /* ================================================
           EXISTENTE
           ================================================ */

        if (club) {
          if (
            matchType ===
            "api"
          ) {
            totals.existingByApi += 1;
          } else {
            totals.existingByName += 1;
          }

          if (
            !options.dryRun
          ) {
            const {
              error,
            } = await supabase
              .from("clubs")
              .update(
                payload
              )
              .eq(
                "id",
                club.id
              );

            if (error) {
              throw error;
            }

            if (
              matchType ===
              "name"
            ) {
              const {
                error:
                  mappingError,
              } =
                await supabase
                  .from(
                    "club_external_ids"
                  )
                  .insert({
                    club_id:
                      club.id,

                    provider:
                      PROVIDER,

                    external_id:
                      apiId,
                  });

              if (
                mappingError
              ) {
                throw mappingError;
              }

              clubByExternal.set(
                apiId,
                Number(
                  club.id
                )
              );

              totals.mappingsCreated +=
                1;
            }
          }

          totals.updated += 1;

          console.log(
            `[${position}/${teams.length}] ✓ EXISTE/${
              matchType ===
              "api"
                ? "API-ID"
                : "NOMBRE"
            } · ${team.name}`
          );

          continue;
        }

        /* ================================================
           NUEVO CLUB
           ================================================ */

        if (
          options.dryRun
        ) {
          totals.created += 1;

          console.log(
            `[${position}/${teams.length}] + NUEVO · ${team.name}`
          );

          continue;
        }

        const {
          data: newClub,
          error:
            clubError,
        } =
          await supabase
            .from("clubs")
            .insert(payload)
            .select(
              "id,name,country_id,badge_url,is_national_team,is_active,is_game_eligible"
            )
            .single();

        if (
          clubError
        ) {
          throw clubError;
        }

        const {
          error:
            mappingError,
        } =
          await supabase
            .from(
              "club_external_ids"
            )
            .insert({
              club_id:
                newClub.id,

              provider:
                PROVIDER,

              external_id:
                apiId,
            });

        if (
          mappingError
        ) {
          await supabase
            .from("clubs")
            .delete()
            .eq(
              "id",
              newClub.id
            );

          throw mappingError;
        }

        clubById.set(
          Number(
            newClub.id
          ),
          newClub
        );

        clubByExternal.set(
          apiId,
          Number(
            newClub.id
          )
        );

        clubByNameCountry.set(
          teamKey(
            country.id,
            team.name
          ),
          newClub
        );

        totals.created += 1;
        totals.mappingsCreated += 1;

        console.log(
          `[${position}/${teams.length}] + NUEVO · ${team.name}`
        );
      } catch (error) {
        totals.errors += 1;

        console.error(
          `[${position}/${teams.length}] ✗ ERROR · ${team.name}: ${error.message}`
        );
      }
    }

    console.log("");
  }

  /* =======================================================
     RESULTADO
     ======================================================= */

  console.log(
    "============================================================"
  );

  console.log(
    "RESULTADO"
  );

  console.log(
    "============================================================"
  );

  console.log(
    `Equipos únicos devueltos:     ${totals.apiTeams}`
  );

  console.log(
    `Ya existentes por API-ID:     ${totals.existingByApi}`
  );

  console.log(
    `Ya existentes por nombre:     ${totals.existingByName}`
  );

  console.log(
    `Clubes nuevos:                ${totals.created}`
  );

  console.log(
    `Clubes actualizados/jugables: ${totals.updated}`
  );

  console.log(
    `Mappings nuevos:              ${totals.mappingsCreated}`
  );

  console.log(
    `Errores:                      ${totals.errors}`
  );

  console.log(
    `Peticiones API usadas:        ${apiRequests}`
  );

  if (
    lastRemaining
  ) {
    console.log(
      `Peticiones API restantes:     ${lastRemaining}`
    );
  }

  console.log("");

  if (
    options.dryRun
  ) {
    console.log(
      "DRY RUN: no se ha modificado Supabase."
    );
  } else {
    console.log(
      "✅ Sincronización terminada."
    );

    console.log(
      "✅ Adivina el Escudo puede usar is_game_eligible=true."
    );
  }
}

/* =========================================================
   EJECUCIÓN
   ========================================================= */

main().catch(
  (error) => {
    console.error("");

    console.error(
      "❌ IMPORTACIÓN ABORTADA"
    );

    console.error(
      error
    );

    process.exitCode = 1;
  }
);
