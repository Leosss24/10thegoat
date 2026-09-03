import assert from "node:assert/strict";
import test from "node:test";
import { evaluateCareerAchievements } from "../lib/achievements.ts";
import { calculateOverall, createCareer, domesticLeagueName, resolveOffer, simulateSeason, talentBandForSeed } from "../lib/career/engine.ts";
import { parseCareer } from "../lib/career/storage.ts";
import { CAREER_DECISIONS, decisionFor, targetNationalityFor } from "../lib/career/decisions.ts";
import { localizeDecision } from "../lib/career/decision-i18n.ts";
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

test("overall includes form without letting reputation or family dominate it",()=>{
  const base={technical:69,physical:59,mentality:64,form:50};
  const inForm=calculateOverall({...base,form:89},"attacking_midfielder");
  const outOfForm=calculateOverall(base,"attacking_midfielder");
  assert.ok(inForm>outOfForm);
  assert.ok(inForm-outOfForm<=6);
  assert.equal(inForm,68);
});

test("a 65-rated first-division striker does not score or win the golden boot unrealistically",()=>{
  let maxGoals=0,goldenBoots=0;
  const firstDivision={...club("mallorca","España",75),domesticDivision:1 as const,leagueBand:"europe_1" as const};
  for(let seed=1;seed<=250;seed++){
    const created=createCareer({...input,seed,club:firstDivision,position:"striker"});
    const state={...created,player:{...created.player,age:24,overall:65,potential:78,reputation:55},year:2035};
    const season=simulateSeason(state,"team",[firstDivision]).seasons[0];
    maxGoals=Math.max(maxGoals,season.goals);
    if(season.individualAwards?.includes("Bota de Oro"))goldenBoots++;
  }
  assert.ok(maxGoals<=25,`máximo: ${maxGoals}`);
  assert.equal(goldenBoots,0);
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

test("career world includes 100 decisions, competitions and veteran decline",()=>{
  assert.equal(CAREER_DECISIONS.length,100);
  const young=simulateSeason(createCareer(input),"team",FALLBACK_CLUBS,"balanced","yes");
  assert.ok(young.seasons[0].competitions?.some(x=>x.kind==="domestic"));
  assert.ok(young.seasons[0].decision);
  const base=createCareer(input);
  const veteran={...base,player:{...base.player,age:34,overall:93,potential:97,blocks:{technical:99,physical:99,mentality:99,form:90},attributes:Object.fromEntries(Object.keys(base.player.attributes).map(k=>[k,99])) as PlayerAttributes}};
  const next=simulateSeason(veteran,"recovery",FALLBACK_CLUBS,"recovery","no");
  assert.ok(next.player.overall<=93);
});

test("all career decisions are localized in English and French",()=>{
  for(const decision of CAREER_DECISIONS)for(const locale of ["en","fr"] as const){
    const translated=localizeDecision(decision,locale);
    assert.notEqual(translated.title,decision.title,`${locale}:${decision.id}`);
    assert.notEqual(translated.description,decision.description,`${locale}:${decision.id}`);
    assert.ok(translated.choices.every((x,i)=>x.label&&x.label!==decision.choices[i].label),`${locale}:${decision.id}`);
  }
});

test("both choices in every decision have consequences",()=>{
  for(const decision of CAREER_DECISIONS)for(const choice of decision.choices){
    assert.ok(Object.values(choice.effects).some(value=>value!==0),`${decision.id}:${choice.id}`);
  }
});

test("sporting nationality changes only before an international debut",()=>{
  const italian=club("italian","Italia",70);
  let eligible=createCareer({...input,club:italian});
  assert.equal(targetNationalityFor(eligible),"Italia");
  for(let seed=1;decisionFor(eligible).id!=="nationality"&&seed<1000;seed++) eligible={...eligible,seed};
  assert.equal(decisionFor(eligible).id,"nationality");
  const changed=simulateSeason(eligible,"development",[italian,...FALLBACK_CLUBS],"balanced","yes");
  assert.equal(changed.player.nationality,"Italia");
  const capped={...eligible,totals:{...eligible.totals,internationalCaps:1}};
  assert.equal(targetNationalityFor(capped),null);
  assert.notEqual(decisionFor(capped).id,"nationality");
});

test("a new career offers at most three home-country academies",()=>{
  const options=starterClubsFor("España",[...FALLBACK_CLUBS,club("third","España",60),club("fourth","España",63)],42,talentBandForSeed(42));
  assert.equal(options.length,3);
  assert.ok(options.every(x=>x.country==="España"));
});

test("starter offers are deterministic and fall back to one major league",()=>{
  const pool=[club("england-a","Inglaterra",70),club("england-b","Inglaterra",71),club("england-c","Inglaterra",72),club("spain-a","España",70),club("spain-b","España",71),club("spain-c","España",72),club("italy-a","Italia",70),club("italy-b","Italia",71),club("italy-c","Italia",72)];
  const first=starterClubsFor("Canadá",pool,77,"crack"),second=starterClubsFor("Canadá",pool,77,"crack");
  assert.deepEqual(first,second);
  assert.equal(first.length,3);
  assert.equal(new Set(first.map(x=>x.country)).size,1);
  assert.ok(["Inglaterra","España","Italia"].includes(first[0].country));
});

test("career contracts accrue salary and transfer offers contain financial terms",()=>{
  let state=createCareer(input);
  assert.ok(state.currentAnnualSalary>=12000);
  const salary=state.currentAnnualSalary;
  state=simulateSeason(state,"development",FALLBACK_CLUBS);
  assert.equal(state.careerEarnings,salary);
  for(const offer of state.offers){assert.ok(offer.annualSalary>=12000);assert.ok(offer.signingBonus>=12000);assert.ok(offer.contractYears>=2);}
});

test("an expired contract is renewed with a salary review",()=>{
  const created=createCareer(input),expired={...created,year:2030,contractUntil:2030,phase:"offers" as const,offers:[]};
  const renewed=resolveOffer(expired,null);
  assert.equal(renewed.contractUntil,2032);
  assert.ok(renewed.currentAnnualSalary>=created.currentAnnualSalary);
});

test("the trophy cabinet can distinguish domestic championships",()=>{
  assert.equal(domesticLeagueName(club("spain","España",80)),"LaLiga");
  assert.equal(domesticLeagueName(club("germany","Alemania",80)),"Bundesliga");
  assert.equal(domesticLeagueName({...club("england","Inglaterra",70),domesticDivision:2}),"Championship");
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
  for(let seed=1;seed<=30000&&total<300;seed++){
    const state=createCareer({...input,seed});
    const next=simulateSeason(state,"development",FALLBACK_CLUBS,"balanced","yes");
    if(next.seasons[0].decision?.title.includes("suplementos")){total++;if(next.seasons[0].decision?.success)favorable++;}
  }
  assert.ok(total>150);
  assert.ok(favorable/total>.15&&favorable/total<.35,`${favorable}/${total}`);
});
