import assert from "node:assert/strict";
import test from "node:test";
import { evaluateCareerAchievements } from "../lib/achievements.ts";
import { calculateOverall, createCareer, resolveOffer, simulateSeason } from "../lib/career/engine.ts";
import { parseCareer } from "../lib/career/storage.ts";

const club = (id:string, country:string, level:number, academyQuality=80, youthOpportunity=80) => ({ id, name:id, country, level, academyQuality, youthOpportunity, squadCompetition:70, sellingProfile:80, prestige:"standard" as const, leagueBand:"europe_2" as const });
const FALLBACK_CLUBS = [club("academy","España",52,92,92),club("blue","Inglaterra",61),club("elite","Francia",73)];
const input = { name: "Alex", shirtNumber:10, nationality: "España", position: "attacking_midfielder" as const, seed: 42, club: FALLBACK_CLUBS[0], year: 2026 };

test("a season is deterministic and stays inside domain bounds", () => {
  const state = createCareer(input);
  const first = simulateSeason(state, "development", FALLBACK_CLUBS);
  const second = simulateSeason(state, "development", FALLBACK_CLUBS);
  assert.deepEqual(first, second);
  assert.equal(first.player.age, 16);
  assert.ok(first.player.overall >= 35 && first.player.overall <= 99);
  assert.ok(first.legacyScore >= 0);
  assert.ok(first.player.blocks.technical >= 1 && first.player.blocks.technical <= 99);
  assert.ok(first.player.blocks.form >= 1 && first.player.blocks.form <= 99);
  assert.ok(first.seasons[0].blockChanges);
  assert.equal(first.player.overall, calculateOverall(first.player.blocks, first.player.position));
});

test("training changes hidden attributes without exposing potential as a block", () => {
  const state = createCareer(input);
  const next = simulateSeason(state, "development", FALLBACK_CLUBS, "technical");
  assert.notDeepEqual(next.player.attributes, state.player.attributes);
  assert.deepEqual(Object.keys(next.player.blocks).sort(), ["form", "mentality", "physical", "technical"]);
  assert.equal("potential" in next.player.blocks, false);
});

test("career cannot continue beyond 40", () => {
  let state = createCareer(input);
  while (state.status === "active") {
    if (state.phase === "offers") state = resolveOffer(state, null);
    else state = simulateSeason(state, "recovery", FALLBACK_CLUBS);
  }
  assert.equal(state.player.age, 40);
  assert.equal(state.phase, "retired");
});

test("achievements are idempotent", () => {
  const played = simulateSeason(createCareer(input), "development", FALLBACK_CLUBS);
  const once = evaluateCareerAchievements(played);
  const twice = evaluateCareerAchievements({ ...played, unlockedAchievementIds: once });
  assert.deepEqual(twice, once);
});

test("corrupt and incompatible saves are rejected", () => {
  assert.equal(parseCareer("not-json"), null);
  assert.equal(parseCareer(JSON.stringify({ schemaVersion: 99, value: {} })), null);
});

test("every player starts at 15 and low minutes can stall progression", () => {
  const premium={...club("premium","España",94,98,10),squadCompetition:99,prestige:"premium_europe" as const,leagueBand:"europe_1" as const};
  const state=createCareer({...input,club:premium});
  const next=simulateSeason(state,"visibility",[premium,...FALLBACK_CLUBS]);
  assert.equal(state.player.age,15);
  assert.ok(next.seasons[0].minutes<1000);
  assert.equal(next.seasons[0].role,"academy");
});
