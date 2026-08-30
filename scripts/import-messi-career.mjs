import { createClient } from "@supabase/supabase-js";

const API_BASE = "https://v3.football.api-sports.io";
const apiKey = process.env.API_FOOTBALL_KEY;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

const MESSI_API_ID = 154;

if (!apiKey) {
  console.error("❌ Falta API_FOOTBALL_KEY en .env.local");
  process.exit(1);
}
if (!supabaseUrl) {
  console.error("❌ Falta NEXT_PUBLIC_SUPABASE_URL en .env.local");
  process.exit(1);
}
if (!supabaseSecretKey) {
  console.error("❌ Falta SUPABASE_SECRET_KEY en .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseSecretKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function apiGet(path) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { "x-apisports-key": apiKey },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(`API-Football respondió ${response.status}`);
  }
  if (data?.errors && Object.keys(data.errors).length > 0) {
    throw new Error(`API-Football devolvió errores: ${JSON.stringify(data.errors)}`);
  }

  return data;
}

async function getMessi10TGId() {
  const mapping = await supabase
    .from("player_external_ids")
    .select("player_id")
    .eq("provider", "api_football")
    .eq("external_id", String(MESSI_API_ID))
    .maybeSingle();

  if (mapping.error) throw mapping.error;
  if (!mapping.data) {
    throw new Error("Messi no está importado todavía. Ejecuta primero npm run import:messi");
  }

  return mapping.data.player_id;
}

async function ensureCountry(name) {
  if (!name) return null;

  const existing = await supabase
    .from("countries")
    .select("id,name")
    .eq("name", name)
    .maybeSingle();

  if (existing.error) throw existing.error;
  if (existing.data) return existing.data;

  const inserted = await supabase
    .from("countries")
    .insert({ name })
    .select("id,name")
    .single();

  if (inserted.error) throw inserted.error;
  return inserted.data;
}

async function findClubByExternalId(externalId) {
  const mapping = await supabase
    .from("club_external_ids")
    .select("club_id")
    .eq("provider", "api_football")
    .eq("external_id", String(externalId))
    .maybeSingle();

  if (mapping.error) throw mapping.error;
  return mapping.data?.club_id ?? null;
}

async function saveClub(team) {
  const country = await ensureCountry(team.country ?? null);
  const payload = {
    name: team.name,
    country_id: country?.id ?? null,
    founded_year: Number.isInteger(team.founded) ? team.founded : null,
    is_national_team: Boolean(team.national),
    badge_url: team.logo ?? null,
    is_active: true,
    updated_at: new Date().toISOString(),
  };

  const existingClubId = await findClubByExternalId(team.id);

  if (existingClubId) {
    const updated = await supabase
      .from("clubs")
      .update(payload)
      .eq("id", existingClubId)
      .select("*")
      .single();

    if (updated.error) throw updated.error;
    return { club: updated.data, created: false, country };
  }

  const inserted = await supabase
    .from("clubs")
    .insert(payload)
    .select("*")
    .single();

  if (inserted.error) throw inserted.error;

  const mapping = await supabase.from("club_external_ids").insert({
    club_id: inserted.data.id,
    provider: "api_football",
    external_id: String(team.id),
  });

  if (mapping.error) {
    await supabase.from("clubs").delete().eq("id", inserted.data.id);
    throw mapping.error;
  }

  return { club: inserted.data, created: true, country };
}

async function saveSeason(playerId, clubId, season) {
  const payload = {
    player_id: playerId,
    club_id: clubId,
    season_start_year: Number(season),
    is_current: false,
    source_provider: "api_football",
    last_synced_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const existing = await supabase
    .from("player_club_seasons")
    .select("id")
    .eq("player_id", playerId)
    .eq("club_id", clubId)
    .eq("season_start_year", Number(season))
    .maybeSingle();

  if (existing.error) throw existing.error;

  if (existing.data) {
    const updated = await supabase
      .from("player_club_seasons")
      .update(payload)
      .eq("id", existing.data.id);
    if (updated.error) throw updated.error;
    return false;
  }

  const inserted = await supabase.from("player_club_seasons").insert(payload);
  if (inserted.error) throw inserted.error;
  return true;
}

async function getTeamDetails(apiTeamId) {
  const data = await apiGet(`/teams?id=${apiTeamId}`);
  const item = data.response?.[0];

  if (!item?.team) {
    throw new Error(`No pude obtener los datos completos del equipo API-Football ${apiTeamId}`);
  }

  return item.team;
}

async function main() {
  console.log("🐐 10 The GOAT · Equipos y trayectoria de Messi\n");

  console.log("1/4 Localizando a Messi en Supabase...");
  const playerId = await getMessi10TGId();
  console.log(`✅ Messi · 10TG player_id ${playerId}`);

  console.log("\n2/4 Consultando sus equipos y temporadas en API-Football...");
  const teamsData = await apiGet(`/players/teams?player=${MESSI_API_ID}`);
  const careerEntries = teamsData.response ?? [];

  if (!careerEntries.length) {
    throw new Error("API-Football no devolvió clubes/temporadas para Messi.");
  }

  console.log(`✅ API-Football devolvió ${careerEntries.length} equipos.`);

  console.log("\n3/4 Guardando clubes, países y escudos...");
  const imported = [];

  for (const entry of careerEntries) {
    const apiTeam = entry.team;
    if (!apiTeam?.id) continue;

    const detailedTeam = await getTeamDetails(apiTeam.id);
    const saved = await saveClub(detailedTeam);
    const seasons = Array.isArray(entry.seasons)
      ? [...new Set(entry.seasons.map(Number).filter(Number.isInteger))].sort((a, b) => a - b)
      : [];

    imported.push({
      apiId: apiTeam.id,
      club: saved.club,
      country: saved.country,
      seasons,
      created: saved.created,
      isNationalTeam: Boolean(saved.club.is_national_team),
    });

    const action = saved.created ? "creado" : "actualizado";
    const kind = saved.club.is_national_team ? "selección" : "club";
    console.log(
      `✅ ${saved.club.name} · ${kind} · ${saved.country?.name ?? "sin país"} · ${action} · ${seasons.length} temporadas`,
    );
  }

  console.log("\n4/4 Guardando trayectoria por temporada...");
  let createdRows = 0;
  let updatedRows = 0;

  for (const item of imported) {
    for (const season of item.seasons) {
      const created = await saveSeason(playerId, item.club.id, season);
      if (created) createdRows += 1;
      else updatedRows += 1;
    }
  }

  console.log(`✅ Temporadas creadas: ${createdRows}`);
  console.log(`✅ Temporadas ya existentes/actualizadas: ${updatedRows}`);

  const clubCareer = imported.filter((item) => !item.isNationalTeam);
  const internationalCareer = imported.filter((item) => item.isNationalTeam);

  function printGroup(title, items) {
    console.log(`\n${title}`);
    for (const item of items) {
      const span = item.seasons.length
        ? `${item.seasons[0]} → ${item.seasons[item.seasons.length - 1]}`
        : "sin temporadas";
      console.log(`   • ${item.club.name} · ${span}`);
      console.log(`     10TG team_id: ${item.club.id} · API-Football ID: ${item.apiId}`);
      console.log(`     Escudo: ${item.club.badge_url ?? "-"}`);
    }
  }

  printGroup("Trayectoria de clubes:", clubCareer);
  printGroup("Trayectoria internacional:", internationalCareer);

  console.log("\n🎉 Trayectoria de Messi clasificada correctamente en 10 The GOAT.");
  console.log("ℹ️ Clubes y selecciones comparten la tabla normalizada, pero quedan separados por is_national_team y por vistas SQL.");
  console.log("ℹ️ Aún NO hemos importado estadísticas, transferencias ni títulos.");
}

main().catch((error) => {
  console.error("\n❌ Importación detenida:");
  console.error(error?.message ?? error);
  process.exit(1);
});
