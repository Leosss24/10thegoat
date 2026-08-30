import { createClient } from "@supabase/supabase-js";

const API_BASE = "https://v3.football.api-sports.io";
const PROVIDER = "api_football";

/* =========================================================
   VARIABLES DE ENTORNO
   ========================================================= */

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
   PAÍSES A IMPORTAR

   24 países = aproximadamente 24 peticiones API.
   API-Football devuelve todos los equipos registrados
   para ese país en una sola consulta.
   ========================================================= */

const DEFAULT_COUNTRIES = [
  "Spain",
  "England",
  "Germany",
  "Italy",
  "France",
  "Portugal",
  "Netherlands",
  "Belgium",
  "Scotland",
  "Turkey",
  "Greece",
  "Austria",
  "Switzerland",
  "Denmark",
  "Norway",
  "Sweden",
  "Poland",
  "Croatia",
  "Serbia",
  "Ukraine",
  "Brazil",
  "Argentina",
  "Uruguay",
  "Mexico",
];

/* =========================================================
   ARGUMENTOS
   ========================================================= */

const rawArgs = process.argv.slice(2);

const dryRun = rawArgs.includes("--dry-run");
const includeNational = rawArgs.includes("--include-national");

const countriesArgument = rawArgs.find((arg) =>
  arg.startsWith("--countries=")
);

const countries = countriesArgument
  ? countriesArgument
      .slice("--countries=".length)
      .split(",")
      .map((country) => country.trim())
      .filter(Boolean)
  : DEFAULT_COUNTRIES;

/* =========================================================
   CONTROL DE PETICIONES
   ========================================================= */

const REQUEST_INTERVAL_MS = Number(
  process.env.API_FOOTBALL_REQUEST_INTERVAL_MS ?? 350
);

let lastRequestAt = 0;
let apiRequestsUsed = 0;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function apiGet(path) {
  const elapsed = Date.now() - lastRequestAt;

  if (elapsed < REQUEST_INTERVAL_MS) {
    await sleep(REQUEST_INTERVAL_MS - elapsed);
  }

  lastRequestAt = Date.now();

  const url = `${API_BASE}${path}`;

  const response = await fetch(url, {
    headers: {
      "x-apisports-key": apiKey,
    },
  });

  apiRequestsUsed += 1;

  let data;

  try {
    data = await response.json();
  } catch {
    throw new Error(
      `API-Football devolvió una respuesta no JSON. HTTP ${response.status}`
    );
  }

  if (!response.ok) {
    throw new Error(
      `API-Football HTTP ${response.status}: ${JSON.stringify(data)}`
    );
  }

  if (
    data?.errors &&
    typeof data.errors === "object" &&
    Object.keys(data.errors).length > 0
  ) {
    throw new Error(
      `API-Football: ${JSON.stringify(data.errors)}`
    );
  }

  return data;
}

/* =========================================================
   COUNTRY
   ========================================================= */

async function ensureCountry(countryName) {
  if (!countryName) {
    return null;
  }

  if (countryName.toLowerCase() === "world") {
    return null;
  }

  const existing = await supabase
    .from("countries")
    .select("id, name")
    .eq("name", countryName)
    .maybeSingle();

  if (existing.error) {
    throw existing.error;
  }

  if (existing.data) {
    return existing.data;
  }

  if (dryRun) {
    return {
      id: null,
      name: countryName,
    };
  }

  const inserted = await supabase
    .from("countries")
    .insert({
      name: countryName,
    })
    .select("id, name")
    .single();

  if (inserted.error) {
    throw inserted.error;
  }

  console.log(`      🌍 País creado: ${countryName}`);

  return inserted.data;
}

/* =========================================================
   BUSCAR CLUB POR ID DE API-FOOTBALL
   ========================================================= */

async function findClubByExternalId(apiTeamId) {
  const result = await supabase
    .from("club_external_ids")
    .select("club_id")
    .eq("provider", PROVIDER)
    .eq("external_id", String(apiTeamId))
    .maybeSingle();

  if (result.error) {
    throw result.error;
  }

  return result.data?.club_id ?? null;
}

/* =========================================================
   FALLBACK: BUSCAR CLUB EXISTENTE POR NOMBRE + PAÍS

   Esto sirve para equipos que ya pudimos haber creado
   previamente mediante los imports de jugadores pero
   que todavía no tengan mapping en club_external_ids.
   ========================================================= */

async function findClubByNameAndCountry(name, countryId) {
  let query = supabase
    .from("clubs")
    .select("id, name, country_id")
    .ilike("name", name);

  if (countryId !== null && countryId !== undefined) {
    query = query.eq("country_id", countryId);
  }

  const result = await query.limit(5);

  if (result.error) {
    throw result.error;
  }

  if (!result.data?.length) {
    return null;
  }

  const exact = result.data.find(
    (club) =>
      String(club.name).toLowerCase() ===
      String(name).toLowerCase()
  );

  return exact?.id ?? null;
}

/* =========================================================
   CREAR MAPPING EXTERNO
   ========================================================= */

async function ensureExternalMapping(clubId, apiTeamId) {
  const existing = await supabase
    .from("club_external_ids")
    .select("club_id")
    .eq("provider", PROVIDER)
    .eq("external_id", String(apiTeamId))
    .maybeSingle();

  if (existing.error) {
    throw existing.error;
  }

  if (existing.data) {
    return;
  }

  if (dryRun) {
    return;
  }

  const inserted = await supabase
    .from("club_external_ids")
    .insert({
      club_id: clubId,
      provider: PROVIDER,
      external_id: String(apiTeamId),
    });

  if (inserted.error) {
    throw inserted.error;
  }
}

/* =========================================================
   GUARDAR / ACTUALIZAR EQUIPO
   ========================================================= */

async function saveTeam(entry) {
  const team = entry?.team;

  if (!team?.id || !team?.name) {
    return {
      status: "skipped",
      reason: "missing_data",
    };
  }

  /*
   API-Football identifica selecciones nacionales
   mediante team.national.
  */

  if (!includeNational && team.national === true) {
    return {
      status: "skipped",
      reason: "national_team",
    };
  }

  const country = await ensureCountry(team.country ?? null);

  const countryId = country?.id ?? null;

  const payload = {
    name: team.name,
    country_id: countryId,
    founded_year:
      Number.isInteger(team.founded)
        ? team.founded
        : null,
    is_national_team: Boolean(team.national),
    badge_url: team.logo ?? null,
    is_active: true,
    updated_at: new Date().toISOString(),
  };

  /*
   1. Intentamos identificar el club por API ID.
  */

  let existingClubId =
    await findClubByExternalId(team.id);

  /*
   2. Si no tiene mapping, buscamos por nombre + país.
      Esto evita duplicar clubes que ya existen
      debido a imports anteriores.
  */

  let foundByFallback = false;

  if (!existingClubId) {
    existingClubId =
      await findClubByNameAndCountry(
        team.name,
        countryId
      );

    if (existingClubId) {
      foundByFallback = true;
    }
  }

  /*
   DRY RUN
  */

  if (dryRun) {
    if (existingClubId) {
      return {
        status: "updated",
        foundByFallback,
      };
    }

    return {
      status: "created",
    };
  }

  /*
   ACTUALIZAR CLUB EXISTENTE
  */

  if (existingClubId) {
    const updated = await supabase
      .from("clubs")
      .update(payload)
      .eq("id", existingClubId);

    if (updated.error) {
      throw updated.error;
    }

    /*
     Si lo encontramos por nombre, añadimos ahora
     el mapping de API-Football.
    */

    if (foundByFallback) {
      await ensureExternalMapping(
        existingClubId,
        team.id
      );
    }

    return {
      status: "updated",
      foundByFallback,
    };
  }

  /*
   CREAR NUEVO CLUB
  */

  const inserted = await supabase
    .from("clubs")
    .insert(payload)
    .select("id")
    .single();

  if (inserted.error) {
    throw inserted.error;
  }

  const newClubId = inserted.data.id;

  /*
   Asociamos inmediatamente el ID interno
   con el ID de API-Football.
  */

  try {
    await ensureExternalMapping(
      newClubId,
      team.id
    );
  } catch (error) {
    /*
     Si por algún motivo falla el mapping,
     eliminamos SOLO el club que acabamos
     de crear para evitar registros huérfanos.
    */

    await supabase
      .from("clubs")
      .delete()
      .eq("id", newClubId);

    throw error;
  }

  return {
    status: "created",
  };
}

/* =========================================================
   IMPORTAR UN PAÍS
   ========================================================= */

async function importCountry(countryName) {
  const endpoint =
    `/teams?country=${encodeURIComponent(countryName)}`;

  const data = await apiGet(endpoint);

  const teams = Array.isArray(data?.response)
    ? data.response
    : [];

  const result = {
    received: teams.length,
    created: 0,
    updated: 0,
    skipped: 0,
    fallbackMapped: 0,
    errors: 0,
  };

  for (const entry of teams) {
    try {
      const saved = await saveTeam(entry);

      switch (saved.status) {
        case "created":
          result.created += 1;
          break;

        case "updated":
          result.updated += 1;

          if (saved.foundByFallback) {
            result.fallbackMapped += 1;
          }

          break;

        default:
          result.skipped += 1;
          break;
      }
    } catch (error) {
      result.errors += 1;

      console.error(
        `\n      ❌ ${entry?.team?.name ?? "Equipo desconocido"}`
      );

      console.error(
        `         ${error.message}`
      );
    }
  }

  return result;
}

/* =========================================================
   MAIN
   ========================================================= */

async function main() {
  console.log("");
  console.log(
    "============================================================"
  );
  console.log(
    "  10theGOAT · IMPORTADOR DE CLUBES + ESCUDOS"
  );
  console.log(
    "============================================================"
  );

  console.log("");
  console.log(`Países seleccionados: ${countries.length}`);

  console.log(
    `Peticiones API estimadas: ${countries.length}`
  );

  console.log(
    `Selecciones nacionales: ${
      includeNational
        ? "INCLUIDAS"
        : "EXCLUIDAS"
    }`
  );

  console.log(
    `Modo: ${
      dryRun
        ? "DRY RUN"
        : "IMPORTACIÓN REAL"
    }`
  );

  console.log("");

  const totals = {
    received: 0,
    created: 0,
    updated: 0,
    skipped: 0,
    fallbackMapped: 0,
    errors: 0,
  };

  const startTime = Date.now();

  for (
    let index = 0;
    index < countries.length;
    index += 1
  ) {
    const country = countries[index];

    console.log(
      `[${index + 1}/${countries.length}] ${country}`
    );

    try {
      const result =
        await importCountry(country);

      totals.received += result.received;
      totals.created += result.created;
      totals.updated += result.updated;
      totals.skipped += result.skipped;
      totals.fallbackMapped +=
        result.fallbackMapped;
      totals.errors += result.errors;

      console.log(
        `   📦 ${result.received} recibidos`
      );

      console.log(
        `   🆕 ${result.created} nuevos`
      );

      console.log(
        `   🔄 ${result.updated} actualizados`
      );

      if (result.fallbackMapped > 0) {
        console.log(
          `   🔗 ${result.fallbackMapped} mappings recuperados`
        );
      }

      if (result.skipped > 0) {
        console.log(
          `   ⏭️  ${result.skipped} omitidos`
        );
      }

      if (result.errors > 0) {
        console.log(
          `   ❌ ${result.errors} errores`
        );
      }

      console.log("");
    } catch (error) {
      totals.errors += 1;

      console.error(
        `   ❌ ERROR EN ${country}`
      );

      console.error(
        `      ${error.message}`
      );

      console.log("");
    }
  }

  const elapsedSeconds =
    ((Date.now() - startTime) / 1000).toFixed(1);

  console.log(
    "============================================================"
  );

  console.log(
    "  RESULTADO"
  );

  console.log(
    "============================================================"
  );

  console.log("");

  console.log(
    `Peticiones API usadas:      ${apiRequestsUsed}`
  );

  console.log(
    `Equipos recibidos:          ${totals.received}`
  );

  console.log(
    `Clubes nuevos:              ${totals.created}`
  );

  console.log(
    `Clubes actualizados:        ${totals.updated}`
  );

  console.log(
    `Mappings recuperados:       ${totals.fallbackMapped}`
  );

  console.log(
    `Equipos omitidos:           ${totals.skipped}`
  );

  console.log(
    `Errores:                    ${totals.errors}`
  );

  console.log(
    `Tiempo:                     ${elapsedSeconds}s`
  );

  console.log("");

  if (dryRun) {
    console.log(
      "⚠️ DRY RUN: no se ha escrito nada en Supabase."
    );
  } else {
    console.log(
      "✅ Importación terminada."
    );
  }

  console.log("");
}

/* =========================================================
   EJECUCIÓN
   ========================================================= */

main().catch((error) => {
  console.error("");
  console.error(
    "❌ IMPORTACIÓN ABORTADA"
  );

  console.error(
    error
  );

  process.exitCode = 1;
});