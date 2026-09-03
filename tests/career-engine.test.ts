import assert from "node:assert/strict";
import test from "node:test";
import { evaluateCareerAchievements } from "../lib/achievements.ts";
import { calculateOverall, createCareer, resolveOffer, simulateSeason } from "../lib/career/engine.ts";
import { parseCareer } from "../lib/career/storage.ts";
import { CAREER_DECISIONS } from "../lib/career/decisions.ts";
import type { PlayerAttributes } from "../lib/career/types.ts";
import { starterClubsFor } from "../lib/career/clubs.ts";

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

test("career world includes 50 decisions, competitions and veteran decline",()=>{
  assert.equal(CAREER_DECISIONS.length,50);
  const young=simulateSeason(createCareer(input),"team",FALLBACK_CLUBS,"balanced","yes");
  assert.ok(young.seasons[0].competitions?.some(x=>x.kind==="domestic"));
  assert.ok(young.seasons[0].decision);
  const base=createCareer(input);
  const veteran={...base,player:{...base.player,age:34,overall:93,potential:97,blocks:{technical:99,physical:99,mentality:99,form:90},attributes:Object.fromEntries(Object.keys(base.player.attributes).map(k=>[k,99])) as PlayerAttributes}};
  const next=simulateSeason(veteran,"recovery",FALLBACK_CLUBS,"recovery","no");
  assert.ok(next.player.overall<=93);
});

test("a new career offers at most three home-country academies",()=>{
  const options=starterClubsFor("España",[...FALLBACK_CLUBS,club("third","España",60),club("fourth","España",63)]);
  assert.equal(options.length,3);
  assert.ok(options.every(x=>x.country==="España"));
});

test("talent distribution remains close to the designed probabilities",()=>{
  const counts={normal:0,high:0,crack:0,generational:0};
  for(let seed=1;seed<=10000;seed++)counts[createCareer({...input,seed}).player.talentBand]++;
  assert.ok(counts.generational>=180&&counts.generational<=320,JSON.stringify(counts));
  assert.ok(counts.crack>=750&&counts.crack<=1150,JSON.stringify(counts));
  assert.ok(counts.high>=2100&&counts.high<=2700,JSON.stringify(counts));
  assert.ok(counts.normal>=6000&&counts.normal<=6800,JSON.stringify(counts));
});

test("contracts prevent an offer carousel and second division blocks continental play",()=>{
  const second={...club("second","España",70),careerCategory:"national_b" as const,domesticDivision:2 as const};
  let state=createCareer({...input,club:second});
  state=simulateSeason(state,"development",[second,...FALLBACK_CLUBS]);
  assert.equal(state.offers.length,0);
  assert.equal(state.seasons[0].competitions?.some(x=>x.kind==="continental"),false);
  assert.equal(state.contractUntil,2029);
});

test("prohibited supplements preserve the declared 25 percent favorable outcome",()=>{
  let favorable=0,total=0;
  for(let seed=1;seed<=5000&&total<300;seed++){
    const state=createCareer({...input,seed});
    const next=simulateSeason(state,"development",FALLBACK_CLUBS,"balanced","yes");
    if(next.seasons[0].decision?.title.includes("suplementos")){total++;if(next.seasons[0].decision?.success)favorable++;}
  }
  assert.ok(total>80);
  assert.ok(favorable/total>.15&&favorable/total<.35,`${favorable}/${total}`);
});
