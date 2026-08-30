import { createClient } from "@supabase/supabase-js";

const API_BASE = "https://v3.football.api-sports.io";
const apiKey = process.env.API_FOOTBALL_KEY;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

const MESSI_API_ID = 154;
const SEASON = 2018;

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

  if (!response.ok) throw new Error(`API-Football respondió ${response.status}`);
  if (data?.errors && Object.keys(data.errors).length > 0) {
    throw new Error(`API-Football devolvió errores: ${JSON.stringify(data.errors)}`);
  }
  return data;
}

function numberOrNull(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function integerOrNull(value) {
  const n = numberOrNull(value);
  return n === null ? null : Math.trunc(n);
}

async function getMessi10TGId() {
  const result = await supabase
    .from("player_external_ids")
    .select("player_id")
    .eq("provider", "api_football")
    .eq("external_id", String(MESSI_API_ID))
    .maybeSingle();

  if (result.error) throw result.error;
  if (!result.data) throw new Error("Messi no está importado. Ejecuta primero npm run import:messi");
  return result.data.player_id;
}

async function ensureCountry(name) {
  if (!name || name === "World") return null;

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

async function getClubByApiId(apiId) {
  const result = await supabase
    .from("club_external_ids")
    .select("club_id, clubs!inner(id,name,is_national_team)")
    .eq("provider", "api_football")
    .eq("external_id", String(apiId))
    .maybeSingle();
  if (result.error) throw result.error;
  if (!result.data) return null;
  return {
    id: result.data.club_id,
    name: result.data.clubs?.name ?? null,
    isNationalTeam: result.data.clubs?.is_national_team === true,
  };
}

function inferCompetitionType(apiType, name) {
  const type = String(apiType ?? "").toLowerCase();
  const lowerName = String(name ?? "").toLowerCase();
  if (lowerName.includes("super cup") || lowerName.includes("supercopa")) return "super_cup";
  if (type === "cup") return "cup";
  if (type === "league") return "league";
  return "other";
}

function inferScope(countryName, competitionName) {
  const country = String(countryName ?? "").toLowerCase();
  const name = String(competitionName ?? "").toLowerCase();

  // Continental club competitions.
  if (
    name.includes("champions league") ||
    name.includes("europa league") ||
    name.includes("conference league") ||
    name.includes("libertadores") ||
    name.includes("sudamericana")
  ) return "continental";

  // Regional/continental national-team qualifiers and championships.
  if (
    name.includes("qualification") &&
    (name.includes("south america") || name.includes("europe") ||
     name.includes("africa") || name.includes("asia") ||
     name.includes("concacaf") || name.includes("oceania"))
  ) return "continental";

  // API-Football commonly uses country=World for global/cross-border events.
  if (country === "world") return "international";
  return "domestic";
}

async function findCompetitionWithoutExternalId({ name, countryId, participantType }) {
  let query = supabase
    .from("competitions")
    .select("*")
    .eq("name", name)
    .eq("participant_type", participantType);

  query = countryId === null
    ? query.is("country_id", null)
    : query.eq("country_id", countryId);

  const result = await query.maybeSingle();
  if (result.error) throw result.error;
  return result.data;
}

async function ensureCompetition(league, participantType) {
  const apiId = league?.id ?? null;
  const country = await ensureCountry(league.country ?? null);
  const payload = {
    name: league.name,
    country_id: country?.id ?? null,
    scope: inferScope(league.country, league.name),
    competition_type: inferCompetitionType(league.type, league.name),
    participant_type: participantType,
    is_active: true,
    updated_at: new Date().toISOString(),
  };

  // Normal path: API-Football supplied a stable competition ID.
  if (apiId !== null && apiId !== undefined && apiId !== "") {
    const mapping = await supabase
      .from("competition_external_ids")
      .select("competition_id")
      .eq("provider", "api_football")
      .eq("external_id", String(apiId))
      .maybeSingle();
    if (mapping.error) throw mapping.error;

    if (mapping.data?.competition_id) {
      const updated = await supabase
        .from("competitions")
        .update(payload)
        .eq("id", mapping.data.competition_id)
        .select("*")
        .single();
      if (updated.error) throw updated.error;
      return { competition: updated.data, created: false, hasExternalId: true };
    }

    const inserted = await supabase
      .from("competitions")
      .insert(payload)
      .select("*")
      .single();
    if (inserted.error) throw inserted.error;

    const createdMapping = await supabase.from("competition_external_ids").insert({
      competition_id: inserted.data.id,
      provider: "api_football",
      external_id: String(apiId),
    });
    if (createdMapping.error) throw createdMapping.error;

    return { competition: inserted.data, created: true, hasExternalId: true };
  }

  // Fallback path: some API-Football blocks (e.g. Club Friendlies) have no league.id.
  // We keep a 10TG-owned competition record and intentionally create no external-ID mapping.
  const existing = await findCompetitionWithoutExternalId({
    name: league.name,
    countryId: country?.id ?? null,
    participantType,
  });

  if (existing) {
    const updated = await supabase
      .from("competitions")
      .update(payload)
      .eq("id", existing.id)
      .select("*")
      .single();
    if (updated.error) throw updated.error;
    return { competition: updated.data, created: false, hasExternalId: false };
  }

  const inserted = await supabase
    .from("competitions")
    .insert(payload)
    .select("*")
    .single();
  if (inserted.error) throw inserted.error;

  return { competition: inserted.data, created: true, hasExternalId: false };
}

async function saveStats({ playerId, clubId, competitionId, stat }) {
  const now = new Date().toISOString();
  const payload = {
    player_id: playerId,
    club_id: clubId,
    competition_id: competitionId,
    season_start_year: SEASON,
    appearances: integerOrNull(stat.games?.appearences),
    starts: integerOrNull(stat.games?.lineups),
    minutes: integerOrNull(stat.games?.minutes),
    goals: integerOrNull(stat.goals?.total),
    assists: integerOrNull(stat.goals?.assists),
    yellow_cards: integerOrNull(stat.cards?.yellow),
    red_cards: integerOrNull(stat.cards?.red),
    shots: integerOrNull(stat.shots?.total),
    shots_on_target: integerOrNull(stat.shots?.on),
    passes: integerOrNull(stat.passes?.total),
    key_passes: integerOrNull(stat.passes?.key),
    pass_accuracy: numberOrNull(stat.passes?.accuracy),
    tackles: integerOrNull(stat.tackles?.total),
    interceptions: integerOrNull(stat.tackles?.interceptions),
    duels: integerOrNull(stat.duels?.total),
    duels_won: integerOrNull(stat.duels?.won),
    saves: integerOrNull(stat.goals?.saves),
    goals_conceded: integerOrNull(stat.goals?.conceded),
    rating: numberOrNull(stat.games?.rating),
    raw_stats: stat,
    source_provider: "api_football",
    season_status: "completed",
    last_synced_at: now,
    updated_at: now,
  };

  const result = await supabase
    .from("player_season_stats")
    .upsert(payload, {
      onConflict: "player_id,club_id,competition_id,season_start_year",
    });
  if (result.error) throw result.error;
}

async function main() {
  console.log(`🐐 10 The GOAT · Messi · temporada ${SEASON}\n`);

  console.log("1/4 Localizando a Messi en Supabase...");
  const playerId = await getMessi10TGId();
  console.log(`✅ Messi · 10TG player_id ${playerId}`);

  console.log(`\n2/4 Consultando API-Football /players?id=${MESSI_API_ID}&season=${SEASON}...`);
  const data = await apiGet(`/players?id=${MESSI_API_ID}&season=${SEASON}`);
  const entry = data.response?.[0];
  const stats = entry?.statistics ?? [];
  if (!stats.length) throw new Error("API-Football no devolvió bloques estadísticos para Messi 2018.");
  console.log(`✅ Recibidos ${stats.length} bloques de equipo/competición.`);

  console.log("\n3/4 Normalizando competiciones y guardando estadísticas...");
  const saved = [];

  for (const stat of stats) {
    const team = stat.team;
    const league = stat.league;
    if (!team?.id || !league?.name) continue;

    const club = await getClubByApiId(team.id);
    if (!club) {
      console.log(`⚠️ Omitido ${team.name} · ${league.name}: el equipo aún no existe en 10TG.`);
      continue;
    }

    const participantType = club.isNationalTeam ? "national_team" : "club";
    const competitionResult = await ensureCompetition(league, participantType);
    await saveStats({
      playerId,
      clubId: club.id,
      competitionId: competitionResult.competition.id,
      stat,
    });

    saved.push({
      team: team.name,
      league: league.name,
      country: league.country,
      scope: competitionResult.competition.scope,
      competitionType: competitionResult.competition.competition_type,
      participantType: competitionResult.competition.participant_type,
      competitionId: competitionResult.competition.id,
      apiCompetitionId: league.id ?? null,
      appearances: integerOrNull(stat.games?.appearences),
      starts: integerOrNull(stat.games?.lineups),
      minutes: integerOrNull(stat.games?.minutes),
      goals: integerOrNull(stat.goals?.total),
      assists: integerOrNull(stat.goals?.assists),
      rating: numberOrNull(stat.games?.rating),
    });

    const externalLabel = league.id == null ? "sin league.id" : `league.id=${league.id}`;
    console.log(`✅ ${team.name} · ${league.name} · ${league.country ?? "Internacional"} · ${participantType} · ${externalLabel}`);
  }

  console.log("\n4/4 Resultado guardado en Supabase:\n");
  for (const row of saved) {
    const visualCountry = row.scope === "domestic" ? (row.country ?? "-") : "🌍 Internacional";
    console.log(`• ${row.league} · ${visualCountry}`);
    console.log(`  Equipo: ${row.team}`);
    console.log(`  Tipo: ${row.participantType === "national_team" ? "selecciones" : "clubes"} · Ámbito: ${row.scope}`);
    console.log(`  10TG competition_id: ${row.competitionId} · API-Football ID: ${row.apiCompetitionId ?? "sin ID"}`);
    console.log(`  PJ ${row.appearances ?? "-"} · Tit ${row.starts ?? "-"} · Min ${row.minutes ?? "-"} · G ${row.goals ?? "-"} · A ${row.assists ?? "-"} · Nota ${row.rating ?? "-"}`);
  }

  console.log(`\nResumen: ${stats.length} bloques recibidos · ${saved.length} bloques guardados.`);
  console.log(`🎉 Messi ${SEASON}: competiciones y estadísticas guardadas.`);
  console.log("ℹ️ No hemos importado transferencias ni títulos.");
  console.log("ℹ️ Las competiciones se muestran por nombre + país, sin logos.");
  console.log("ℹ️ Un bloque con 0 PJ se conserva como dato de proveedor, pero no contará como participación jugada.");
}

main().catch((error) => {
  console.error("\n❌ Importación detenida:");
  console.error(error?.message ?? error);
  process.exit(1);
});
