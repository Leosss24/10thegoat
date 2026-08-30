import { createClient } from "@supabase/supabase-js";

const API_BASE = "https://v3.football.api-sports.io";
const PROVIDER = "api_football";

const apiKey = process.env.API_FOOTBALL_KEY;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

if (!apiKey) throw new Error("Falta API_FOOTBALL_KEY en .env.local");
if (!supabaseUrl) throw new Error("Falta NEXT_PUBLIC_SUPABASE_URL en .env.local");
if (!supabaseSecretKey) throw new Error("Falta SUPABASE_SECRET_KEY en .env.local");

export const supabase = createClient(supabaseUrl, supabaseSecretKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const teamCache = new Map();
const countryCache = new Map();
const clubCache = new Map();
const competitionCache = new Map();

function normalize(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function sanitizeApiSearch(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseMeasure(value) {
  const match = String(value ?? "").match(/\d+/);
  return match ? Number(match[0]) : null;
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

const REQUEST_INTERVAL_MS = Number(process.env.API_FOOTBALL_REQUEST_INTERVAL_MS ?? 320);
const MAX_API_RETRIES = Number(process.env.API_FOOTBALL_MAX_RETRIES ?? 5);
let lastApiRequestAt = 0;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForApiSlot() {
  const elapsed = Date.now() - lastApiRequestAt;
  const waitMs = Math.max(0, REQUEST_INTERVAL_MS - elapsed);
  if (waitMs > 0) await sleep(waitMs);
  lastApiRequestAt = Date.now();
}

function isRateLimitError(response, data) {
  return response?.status === 429 || Boolean(data?.errors?.rateLimit);
}

export async function apiGet(path) {
  let lastError = null;

  for (let attempt = 0; attempt <= MAX_API_RETRIES; attempt += 1) {
    await waitForApiSlot();

    try {
      const response = await fetch(`${API_BASE}${path}`, {
        headers: { "x-apisports-key": apiKey },
      });
      const data = await response.json();

      if (isRateLimitError(response, data)) {
        if (attempt >= MAX_API_RETRIES) {
          throw new Error(`API-Football rate limit tras ${attempt + 1} intentos: ${JSON.stringify(data?.errors ?? {})}`);
        }
        const retryAfterHeader = Number(response.headers.get("retry-after"));
        const waitMs = Number.isFinite(retryAfterHeader) && retryAfterHeader > 0
          ? retryAfterHeader * 1000
          : Math.min(65000, 15000 * (attempt + 1));
        console.log(`   ⏳ Rate limit API-Football. Esperando ${Math.ceil(waitMs / 1000)} s y reintentando...`);
        await sleep(waitMs);
        continue;
      }

      if (!response.ok) {
        lastError = new Error(`API-Football respondió ${response.status}`);
      } else if (data?.errors && Object.keys(data.errors).length > 0) {
        lastError = new Error(`API-Football devolvió errores: ${JSON.stringify(data.errors)}`);
      } else {
        return data;
      }
    } catch (error) {
      lastError = error;
    }

    if (attempt < MAX_API_RETRIES) {
      const waitMs = Math.min(10000, 1000 * (2 ** attempt));
      console.log(`   ⏳ Error temporal API-Football. Reintento en ${Math.ceil(waitMs / 1000)} s...`);
      await sleep(waitMs);
    }
  }

  throw lastError ?? new Error("Error desconocido consultando API-Football");
}

async function ensureCountry(name) {
  if (!name || normalize(name) === "world") return null;
  const cacheKey = normalize(name);
  if (countryCache.has(cacheKey)) return countryCache.get(cacheKey);

  const existing = await supabase.from("countries").select("id,name").eq("name", name).maybeSingle();
  if (existing.error) throw existing.error;
  if (existing.data) {
    countryCache.set(cacheKey, existing.data);
    return existing.data;
  }

  const inserted = await supabase.from("countries").insert({ name }).select("id,name").single();
  if (inserted.error) throw inserted.error;
  countryCache.set(cacheKey, inserted.data);
  return inserted.data;
}

async function findPlayerByExternalId(externalId) {
  const result = await supabase
    .from("player_external_ids")
    .select("player_id")
    .eq("provider", PROVIDER)
    .eq("external_id", String(externalId))
    .maybeSingle();
  if (result.error) throw result.error;
  return result.data?.player_id ?? null;
}

export async function findExactPlayer(target) {
  if (target.apiFootballId) {
    const data = await apiGet(`/players/profiles?player=${encodeURIComponent(target.apiFootballId)}`);
    const entry = data.response?.[0];
    const player = entry?.player ?? entry;
    if (!player?.id) throw new Error(`No pude recuperar el API-Football ID ${target.apiFootballId} de ${target.label}`);
    if (target.birthDate && player?.birth?.date !== target.birthDate) {
      throw new Error(`El API-Football ID ${target.apiFootballId} no coincide con la fecha de nacimiento esperada de ${target.label}`);
    }
    if (target.nationality && normalize(player?.nationality) !== normalize(target.nationality)) {
      throw new Error(`El API-Football ID ${target.apiFootballId} no coincide con la nacionalidad esperada de ${target.label}`);
    }
    return player;
  }

  const rawSearches = [
    ...(target.searches ?? []),
    target.search,
    target.label,
  ].filter(Boolean);

  const searches = [...new Set(rawSearches.map(sanitizeApiSearch).filter(Boolean))];
  const tried = [];
  const searchErrors = [];

  for (const term of searches) {
    tried.push(term);
    let data;
    try {
      data = await apiGet(`/players/profiles?search=${encodeURIComponent(term)}`);
    } catch (error) {
      searchErrors.push(`${term}: ${error?.message ?? error}`);
      continue;
    }

    const entries = data.response ?? [];
    const exact = entries.find((entry) => {
      const player = entry?.player ?? entry;
      return (
        player?.birth?.date === target.birthDate &&
        normalize(player?.nationality) === normalize(target.nationality)
      );
    });
    if (exact) return exact?.player ?? exact;
  }

  // Algunos retirados históricos no aparecen de forma fiable en /players/profiles.
  // API-Football exige que `search` en /players vaya acompañado por un team o league
  // cuando consultamos una temporada. Por eso usamos un club histórico conocido como
  // ancla, resolvemos primero su ID y después buscamos al jugador dentro de ese equipo.
  const lookupTeams = target.lookupTeams ?? [];
  const historicalErrors = [];

  for (const lookup of lookupTeams) {
    try {
      const teamSearch = sanitizeApiSearch(lookup.team);
      const teamsData = await apiGet(`/teams?search=${encodeURIComponent(teamSearch)}`);
      const teams = teamsData.response ?? [];
      const teamEntry = teams.find((entry) => normalize(entry?.team?.name) === normalize(lookup.team)) ?? teams[0];
      const teamId = teamEntry?.team?.id;
      if (!teamId) {
        historicalErrors.push(`${lookup.team}/${lookup.season}: no pude resolver el equipo`);
        continue;
      }

      // Para históricos evitamos por completo `search`: algunos retirados no están
      // indexados de forma fiable por nombre. Pedimos la plantilla completa del club
      // y temporada, recorremos todas las páginas y validamos localmente por DOB + país.
      let page = 1;
      let totalPages = 1;
      let found = null;

      do {
        try {
          const data = await apiGet(`/players?team=${teamId}&season=${lookup.season}&page=${page}`);
          const entries = data.response ?? [];
          found = entries.find((entry) => {
            const player = entry?.player ?? entry;
            return (
              player?.birth?.date === target.birthDate &&
              normalize(player?.nationality) === normalize(target.nationality)
            );
          });
          totalPages = Number(data?.paging?.total ?? 1) || 1;
          if (found) return found?.player ?? found;
          page += 1;
        } catch (error) {
          historicalErrors.push(`${lookup.team}/${lookup.season}/página ${page}: ${error?.message ?? error}`);
          break;
        }
      } while (page <= totalPages);

      if (!found) {
        historicalErrors.push(`${lookup.team}/${lookup.season}: jugador no encontrado en ${totalPages} página(s) de plantilla`);
      }
    } catch (error) {
      historicalErrors.push(`${lookup.team}/${lookup.season}: ${error?.message ?? error}`);
    }
  }

  const detail = searchErrors.length ? ` Errores de perfiles: ${searchErrors.join(" | ")}.` : "";
  const historicalDetail = historicalErrors.length ? ` Errores históricos: ${historicalErrors.join(" | ")}.` : "";
  const lookupDetail = lookupTeams.length
    ? ` Anclas históricas probadas: ${lookupTeams.map((item) => `${item.team} ${item.season}`).join(", ")}.`
    : "";
  throw new Error(`No pude identificar exactamente a ${target.label}. Búsquedas probadas: ${tried.join(", ")}.${lookupDetail}${detail}${historicalDetail}`);
}

export async function savePlayer(apiPlayer, target) {
  const country = await ensureCountry(apiPlayer.nationality || target.nationality);
  const payload = {
    display_name: target.label,
    full_name: [apiPlayer.firstname, apiPlayer.lastname].filter(Boolean).join(" ") || apiPlayer.name || target.label,
    first_name: apiPlayer.firstname ?? null,
    last_name: apiPlayer.lastname ?? null,
    birth_date: apiPlayer.birth?.date ?? null,
    nationality_country_id: country?.id ?? null,
    height_cm: parseMeasure(apiPlayer.height),
    weight_kg: parseMeasure(apiPlayer.weight),
    photo_url: apiPlayer.photo ?? null,
    is_active: !target.isRetired,
    is_retired: Boolean(target.isRetired),
    updated_at: new Date().toISOString(),
  };

  const existingPlayerId = await findPlayerByExternalId(apiPlayer.id);
  if (existingPlayerId) {
    const updated = await supabase.from("players").update(payload).eq("id", existingPlayerId).select("*").single();
    if (updated.error) throw updated.error;
    return { player: updated.data, created: false };
  }

  const inserted = await supabase.from("players").insert(payload).select("*").single();
  if (inserted.error) throw inserted.error;

  const mapping = await supabase.from("player_external_ids").insert({
    player_id: inserted.data.id,
    provider: PROVIDER,
    external_id: String(apiPlayer.id),
  });
  if (mapping.error) throw mapping.error;
  return { player: inserted.data, created: true };
}

async function getTeamDetails(apiTeamId) {
  const key = String(apiTeamId);
  if (teamCache.has(key)) return teamCache.get(key);
  const data = await apiGet(`/teams?id=${apiTeamId}`);
  const team = data.response?.[0]?.team;
  if (!team) throw new Error(`No pude obtener el equipo API-Football ${apiTeamId}`);
  teamCache.set(key, team);
  return team;
}

async function findClubByExternalId(externalId) {
  const key = String(externalId);
  if (clubCache.has(key)) return clubCache.get(key);
  const mapping = await supabase
    .from("club_external_ids")
    .select("club_id, clubs!inner(*)")
    .eq("provider", PROVIDER)
    .eq("external_id", key)
    .maybeSingle();
  if (mapping.error) throw mapping.error;
  const club = mapping.data?.clubs ?? null;
  if (club) clubCache.set(key, club);
  return club;
}

async function saveClub(apiTeam) {
  const country = await ensureCountry(apiTeam.country ?? null);
  const payload = {
    name: apiTeam.name,
    country_id: country?.id ?? null,
    founded_year: Number.isInteger(apiTeam.founded) ? apiTeam.founded : null,
    is_national_team: Boolean(apiTeam.national),
    badge_url: apiTeam.logo ?? null,
    is_active: true,
    updated_at: new Date().toISOString(),
  };

  const existing = await findClubByExternalId(apiTeam.id);
  if (existing) {
    const updated = await supabase.from("clubs").update(payload).eq("id", existing.id).select("*").single();
    if (updated.error) throw updated.error;
    clubCache.set(String(apiTeam.id), updated.data);
    return updated.data;
  }

  const inserted = await supabase.from("clubs").insert(payload).select("*").single();
  if (inserted.error) throw inserted.error;
  const mapping = await supabase.from("club_external_ids").insert({
    club_id: inserted.data.id,
    provider: PROVIDER,
    external_id: String(apiTeam.id),
  });
  if (mapping.error) throw mapping.error;
  clubCache.set(String(apiTeam.id), inserted.data);
  return inserted.data;
}

function isValidSeasonYear(value) {
  const year = Number(value);
  return Number.isInteger(year) && year >= 1800 && year <= 2200;
}

async function saveCareerSeason(playerId, clubId, season) {
  const year = Number(season);
  if (!isValidSeasonYear(year)) {
    return { saved: false, reason: `año fuera de rango: ${String(season)}` };
  }

  const now = new Date().toISOString();
  const payload = {
    player_id: playerId,
    club_id: clubId,
    season_start_year: year,
    is_current: false,
    source_provider: PROVIDER,
    last_synced_at: now,
    updated_at: now,
  };
  const result = await supabase.from("player_club_seasons").upsert(payload, {
    onConflict: "player_id,club_id,season_start_year",
  });
  if (result.error) return { saved: false, reason: result.error.message };
  return { saved: true, year };
}

export async function importCareer(apiPlayerId, playerId) {
  const data = await apiGet(`/players/teams?player=${apiPlayerId}`);
  const entries = data.response ?? [];
  const imported = [];
  const warnings = [];

  for (const entry of entries) {
    if (!entry?.team?.id) continue;

    let detailed;
    let club;
    try {
      detailed = await getTeamDetails(entry.team.id);
      club = await saveClub(detailed);
    } catch (error) {
      warnings.push({ team: entry?.team?.name ?? entry.team.id, season: null, reason: `equipo no resoluble: ${error?.message ?? error}` });
      continue;
    }

    const rawSeasons = [...new Set(entry.seasons ?? [])]
      .filter((season) => season !== null && season !== undefined && String(season).trim() !== "");
    const seasons = [];
    for (const rawSeason of rawSeasons) {
      const result = await saveCareerSeason(playerId, club.id, rawSeason);
      if (result.saved) seasons.push(result.year);
      else warnings.push({ team: club.name, season: rawSeason, reason: result.reason });
    }

    seasons.sort((a, b) => a - b);
    imported.push({ apiTeamId: entry.team.id, club, seasons });
  }

  imported.warnings = warnings;
  return imported;
}

function inferCompetitionType(apiType, name) {
  const type = normalize(apiType);
  const lowerName = normalize(name);
  if (lowerName.includes("super cup") || lowerName.includes("supercopa")) return "super_cup";
  if (type === "cup") return "cup";
  if (type === "league") return "league";
  return "other";
}

function inferScope(countryName, competitionName) {
  const country = normalize(countryName);
  const name = normalize(competitionName);

  // Friendly matches are cross-border/international in our taxonomy, for both clubs and national teams.
  if (name.includes("friendly") || name.includes("friendlies")) return "international";

  if (
    name.includes("champions league") ||
    name.includes("europa league") ||
    name.includes("conference league") ||
    name.includes("libertadores") ||
    name.includes("sudamericana") ||
    name.includes("afc champions") ||
    name.includes("caf champions") ||
    name.includes("concacaf champions")
  ) return "continental";

  if (
    name.includes("qualification") &&
    (name.includes("south america") || name.includes("europe") || name.includes("africa") ||
      name.includes("asia") || name.includes("concacaf") || name.includes("oceania"))
  ) return "continental";

  if (country === "world") return "international";
  return "domestic";
}

async function findCompetitionWithoutExternalId({ name, countryId, participantType }) {
  let query = supabase
    .from("competitions")
    .select("*")
    .eq("name", name)
    .eq("participant_type", participantType)
    .order("id", { ascending: true })
    .limit(10);

  query = countryId === null ? query.is("country_id", null) : query.eq("country_id", countryId);
  const result = await query;
  if (result.error) throw result.error;

  // Puede haber duplicados históricos creados antes de endurecer el importador.
  // Elegimos de forma determinista el ID interno más antiguo y dejamos de usar maybeSingle().
  return result.data?.[0] ?? null;
}

async function ensureCompetition(league, participantType) {
  const apiId = league?.id ?? null;
  const cacheKey = `${apiId ?? "none"}|${league?.name ?? ""}|${league?.country ?? ""}|${participantType}`;
  if (competitionCache.has(cacheKey)) return competitionCache.get(cacheKey);

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

  if (apiId !== null && apiId !== undefined && apiId !== "") {
    const mapping = await supabase
      .from("competition_external_ids")
      .select("competition_id")
      .eq("provider", PROVIDER)
      .eq("external_id", String(apiId))
      .maybeSingle();
    if (mapping.error) throw mapping.error;

    if (mapping.data?.competition_id) {
      const updated = await supabase.from("competitions").update(payload).eq("id", mapping.data.competition_id).select("*").single();
      if (updated.error) throw updated.error;
      competitionCache.set(cacheKey, updated.data);
      return updated.data;
    }

    const inserted = await supabase.from("competitions").insert(payload).select("*").single();
    if (inserted.error) throw inserted.error;
    const createdMapping = await supabase.from("competition_external_ids").insert({
      competition_id: inserted.data.id,
      provider: PROVIDER,
      external_id: String(apiId),
    });
    if (createdMapping.error) throw createdMapping.error;
    competitionCache.set(cacheKey, inserted.data);
    return inserted.data;
  }

  const existing = await findCompetitionWithoutExternalId({
    name: league.name,
    countryId: country?.id ?? null,
    participantType,
  });
  if (existing) {
    const updated = await supabase.from("competitions").update(payload).eq("id", existing.id).select("*").single();
    if (updated.error) throw updated.error;
    competitionCache.set(cacheKey, updated.data);
    return updated.data;
  }

  const inserted = await supabase.from("competitions").insert(payload).select("*").single();
  if (inserted.error) throw inserted.error;
  competitionCache.set(cacheKey, inserted.data);
  return inserted.data;
}

async function saveStats({ playerId, clubId, competitionId, season, stat }) {
  const now = new Date().toISOString();
  const currentYear = new Date().getUTCFullYear();
  const payload = {
    player_id: playerId,
    club_id: clubId,
    competition_id: competitionId,
    season_start_year: season,
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
    source_provider: PROVIDER,
    season_status: season >= currentYear ? "current" : "completed",
    last_synced_at: now,
    updated_at: now,
  };
  const result = await supabase.from("player_season_stats").upsert(payload, {
    onConflict: "player_id,club_id,competition_id,season_start_year",
  });
  if (result.error) throw result.error;
}

export async function importSeasonStats(apiPlayerId, playerId, season) {
  if (!isValidSeasonYear(season)) {
    return { received: 0, saved: 0, skippedMissingTeam: 0, skippedBlocks: 0, warnings: [`temporada fuera de rango: ${season}`] };
  }

  const data = await apiGet(`/players?id=${apiPlayerId}&season=${season}`);
  const entry = data.response?.[0];
  const stats = entry?.statistics ?? [];
  let saved = 0;
  let skippedMissingTeam = 0;
  let skippedBlocks = 0;
  const warnings = [];

  for (let index = 0; index < stats.length; index += 1) {
    const stat = stats[index];
    const team = stat.team;
    const league = stat.league;
    if (!team?.id || !league?.name) {
      skippedBlocks += 1;
      warnings.push(`bloque #${index + 1}: falta team.id o league.name`);
      continue;
    }

    try {
      let club = await findClubByExternalId(team.id);
      if (!club) {
        try {
          const detailed = await getTeamDetails(team.id);
          club = await saveClub(detailed);
        } catch (error) {
          skippedMissingTeam += 1;
          warnings.push(`bloque #${index + 1} (${team.name ?? team.id}): equipo no resoluble: ${error?.message ?? error}`);
          continue;
        }
      }

      const participantType = club.is_national_team ? "national_team" : "club";
      const competition = await ensureCompetition(league, participantType);
      await saveStats({ playerId, clubId: club.id, competitionId: competition.id, season, stat });
      saved += 1;
    } catch (error) {
      skippedBlocks += 1;
      warnings.push(`bloque #${index + 1} (${team.name ?? team.id} / ${league.name}): ${error?.message ?? error}`);
    }
  }

  return { received: stats.length, saved, skippedMissingTeam, skippedBlocks, warnings };
}

export async function importAllAvailableStats(apiPlayerId, playerId, careerEntries, onSeason) {
  const seasons = [...new Set(careerEntries.flatMap((entry) => entry.seasons ?? []).map(Number).filter(Number.isInteger))]
    .sort((a, b) => a - b);

  const totals = {
    seasons: seasons.length,
    received: 0,
    saved: 0,
    skippedMissingTeam: 0,
    skippedBlocks: 0,
    warnings: [],
    emptySeasons: 0,
    failedSeasons: 0,
  };

  for (const season of seasons) {
    try {
      const result = await importSeasonStats(apiPlayerId, playerId, season);
      totals.received += result.received;
      totals.saved += result.saved;
      totals.skippedMissingTeam += result.skippedMissingTeam;
      totals.skippedBlocks += result.skippedBlocks ?? 0;
      if (result.warnings?.length) totals.warnings.push(...result.warnings.map((warning) => `${season}: ${warning}`));
      if (result.received === 0) totals.emptySeasons += 1;
      if (onSeason) onSeason(season, result, null);
    } catch (error) {
      totals.failedSeasons += 1;
      if (onSeason) onSeason(season, null, error);
    }
  }
  return totals;
}
