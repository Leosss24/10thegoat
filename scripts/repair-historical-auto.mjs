import fs from "node:fs/promises";
import path from "node:path";
import {
  apiGet,
  findExactPlayer,
  savePlayer,
  importCareer,
  importAllAvailableStats,
} from "./lib/core-importer.mjs";
import { HISTORICAL_REPAIR_PLAYERS } from "../data/historical-repair-players.mjs";

const STATE_PATH = path.resolve(".import-state/historical-api-ids.json");

const DISCOVERY = {
  ronaldo_nazario: { league: 135, season: 2007, team: "AC Milan", aliases: ["ronaldo", "nazario"] },
  luis_figo: { league: 135, season: 2008, team: "Inter", aliases: ["figo"] },
  cafu: { league: 135, season: 2007, team: "AC Milan", aliases: ["cafu"] },
  paolo_maldini: { league: 135, season: 2008, team: "AC Milan", aliases: ["maldini"] },
  gennaro_gattuso: { league: 135, season: 2008, team: "AC Milan", aliases: ["gattuso"] },
  ruud_van_nistelrooy: { league: 140, season: 2008, team: "Real Madrid", aliases: ["nistelrooy", "van nistelrooy"] },
  dennis_bergkamp: { league: 39, season: 2005, team: "Arsenal", aliases: ["bergkamp"] },
  didier_drogba: { league: 39, season: 2014, team: "Chelsea", aliases: ["drogba"] },
};

function normalize(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function identityMatches(player, target) {
  return player?.birth?.date === target.birthDate && normalize(player?.nationality) === normalize(target.nationality);
}

async function validateId(id, target) {
  try {
    const data = await apiGet(`/players/profiles?player=${encodeURIComponent(id)}`);
    const entry = data.response?.[0];
    const player = entry?.player ?? entry;
    return player?.id && identityMatches(player, target) ? player : null;
  } catch {
    return null;
  }
}

async function scanLeague(target, cfg) {
  let page = 1;
  let total = 1;
  let seen = 0;
  do {
    const data = await apiGet(`/players?league=${cfg.league}&season=${cfg.season}&page=${page}`);
    total = Number(data?.paging?.total ?? 1) || 1;
    for (const entry of data.response ?? []) {
      seen += 1;
      const player = entry?.player ?? entry;
      if (player?.id && identityMatches(player, target)) return { id: player.id, via: `liga ${cfg.league} · ${cfg.season}`, seen };
    }
    page += 1;
  } while (page <= total);
  return { id: null, seen };
}

async function resolveTeamId(name) {
  const data = await apiGet(`/teams?search=${encodeURIComponent(name)}`);
  const entries = data.response ?? [];
  const exact = entries.find((entry) => normalize(entry?.team?.name) === normalize(name));
  return (exact ?? entries[0])?.team?.id ?? null;
}

function lineupPlayers(lineup) {
  const rows = [...(lineup?.startXI ?? []), ...(lineup?.substitutes ?? [])];
  return rows.map((row) => row?.player).filter(Boolean);
}

function aliasHit(name, aliases) {
  const n = normalize(name);
  return aliases.some((alias) => {
    const a = normalize(alias);
    return n === a || n.includes(a) || a.includes(n);
  });
}

async function scanLineups(target, cfg) {
  const teamId = await resolveTeamId(cfg.team);
  if (!teamId) return { id: null, reason: `no pude resolver ${cfg.team}` };

  const fixtures = await apiGet(`/fixtures?team=${teamId}&season=${cfg.season}`);
  const ids = (fixtures.response ?? []).map((entry) => entry?.fixture?.id).filter(Boolean);
  const candidateIds = new Set();
  let checked = 0;

  // Muestreamos hasta 45 partidos: suficiente para liga/copas y limita peticiones.
  for (const fixtureId of ids.slice(0, 45)) {
    const data = await apiGet(`/fixtures/lineups?fixture=${fixtureId}`);
    checked += 1;
    for (const lineup of data.response ?? []) {
      for (const player of lineupPlayers(lineup)) {
        if (player?.id && aliasHit(player?.name, cfg.aliases)) candidateIds.add(player.id);
      }
    }
  }

  for (const id of candidateIds) {
    const player = await validateId(id, target);
    if (player) return { id, via: `${cfg.team} ${cfg.season} · alineaciones`, checked, candidates: candidateIds.size };
  }
  return { id: null, checked, candidates: candidateIds.size };
}

async function loadState() {
  try { return JSON.parse(await fs.readFile(STATE_PATH, "utf8")); } catch { return {}; }
}
async function saveState(state) {
  await fs.mkdir(path.dirname(STATE_PATH), { recursive: true });
  await fs.writeFile(STATE_PATH, JSON.stringify(state, null, 2) + "\n", "utf8");
}

async function detectId(target) {
  const cfg = DISCOVERY[target.key];
  if (!cfg) return { id: null, notes: ["sin estrategia configurada"] };
  const notes = [];

  console.log(`   🔎 Ruta A: liga ${cfg.league}, temporada ${cfg.season}...`);
  try {
    const league = await scanLeague(target, cfg);
    if (league.id) return { id: league.id, via: league.via, notes };
    notes.push(`liga: sin coincidencia tras ${league.seen} perfiles`);
  } catch (error) {
    notes.push(`liga: ${error?.message ?? error}`);
  }

  console.log(`   🔎 Ruta B: ${cfg.team} ${cfg.season}, alineaciones históricas...`);
  try {
    const lineups = await scanLineups(target, cfg);
    if (lineups.id) return { id: lineups.id, via: lineups.via, notes };
    notes.push(`alineaciones: ${lineups.reason ?? `sin coincidencia (${lineups.checked ?? 0} partidos, ${lineups.candidates ?? 0} candidatos)`}`);
  } catch (error) {
    notes.push(`alineaciones: ${error?.message ?? error}`);
  }

  return { id: null, notes };
}

console.log("🐐 10 The GOAT · Reparación histórica automática v0.7.2");
console.log("Detecta IDs por liga/temporada y, si hace falta, por alineaciones históricas.\n");

const state = await loadState();
let discovered = 0, completed = 0, failed = 0;
const pending = [];

for (let index = 0; index < HISTORICAL_REPAIR_PLAYERS.length; index += 1) {
  const base = HISTORICAL_REPAIR_PLAYERS[index];
  console.log("\n══════════════════════════════════════════════════");
  console.log(`${index + 1}/${HISTORICAL_REPAIR_PLAYERS.length} · ${base.label}`);
  console.log("══════════════════════════════════════════════════");

  try {
    let id = base.apiFootballId || state[base.key]?.apiFootballId || null;
    let via = base.apiFootballId ? ".env.local" : state[base.key]?.via || null;

    if (id) {
      const valid = await validateId(id, base);
      if (!valid) {
        console.log(`   ⚠️ ID guardado ${id} no valida; se redetectará.`);
        id = null;
      }
    }

    if (!id) {
      const result = await detectId(base);
      if (!result.id) {
        console.log(`❌ No se pudo detectar ID.`);
        for (const note of result.notes) console.log(`   · ${note}`);
        pending.push(base.label);
        failed += 1;
        continue;
      }
      id = result.id;
      via = result.via;
      state[base.key] = { label: base.label, apiFootballId: id, via, detectedAt: new Date().toISOString() };
      await saveState(state);
      discovered += 1;
      console.log(`✅ ID detectado: ${id} · ${via}`);
    } else {
      console.log(`✅ ID reutilizado: ${id} · ${via}`);
    }

    const target = { ...base, apiFootballId: id };
    const apiPlayer = await findExactPlayer(target);
    const saved = await savePlayer(apiPlayer, target);
    console.log(`✅ Perfil: API ${apiPlayer.id} · 10TG ${saved.player.id} · ${saved.created ? "creado" : "actualizado"}`);

    const career = await importCareer(apiPlayer.id, saved.player.id);
    console.log(`✅ Trayectoria: ${career.length} equipos.`);

    const totals = await importAllAvailableStats(apiPlayer.id, saved.player.id, career, (season, result, error) => {
      if (error) return console.log(`   ⚠️ ${season}: ${error?.message ?? error}`);
      if (result.received > 0) console.log(`   ✅ ${season}: ${result.saved}/${result.received} bloques guardados${result.skippedBlocks ? ` · ${result.skippedBlocks} omitidos` : ""}`);
    });
    console.log(`✅ Estadísticas: ${totals.saved} bloques · ${totals.seasons} temporadas consultadas.`);
    completed += 1;
  } catch (error) {
    failed += 1;
    pending.push(base.label);
    console.log(`❌ ${base.label}: ${error?.message ?? error}`);
  }
}

console.log("\n══════════════════════════════════════════════════");
console.log("RESUMEN · HISTÓRICOS AUTOMÁTICOS");
console.log("══════════════════════════════════════════════════");
console.log(`✅ IDs nuevos detectados: ${discovered}`);
console.log(`✅ Jugadores completados: ${completed}/${HISTORICAL_REPAIR_PLAYERS.length}`);
console.log(`❌ Pendientes/error: ${failed}`);
console.log(`📌 IDs persistidos en: ${STATE_PATH}`);
if (pending.length) {
  console.log("\nPendientes:");
  for (const name of [...new Set(pending)]) console.log(`- ${name}`);
}
