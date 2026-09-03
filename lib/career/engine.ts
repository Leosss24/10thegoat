import type {
  CareerClub,
  CompetitionResult,
  CareerPosition,
  CareerRole,
  CareerSeason,
  CareerState,
  CareerTotals,
  CreateCareerInput,
  PlayerAttributes,
  PlayerBlocks,
  SeasonFocus,
  TalentBand,
  TrainingFocus,
  TransferOffer,
} from "./types.ts";
import { decisionFor } from "./decisions.ts";
const EMPTY: CareerTotals = {
  appearances: 0,
  goals: 0,
  assists: 0,
  cleanSheets: 0,
  titles: 0,
  internationalCaps: 0,
  internationalGoals: 0,
};
const clamp = (v: number, min: number, max: number) =>
  Math.min(max, Math.max(min, Math.round(v)));
const mean = (...values: number[]) =>
  values.reduce((sum, value) => sum + value, 0) / values.length;
function random(seed: number) {
  let v = (seed ^ 0x9e3779b9) >>> 0;
  return () => {
    v = (v + 0x6d2b79f5) >>> 0;
    let t = v;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const attack: Record<CareerPosition, number> = {
  centre_back: 0.07,
  right_back: 0.1,
  left_back: 0.1,
  holding_midfielder: 0.12,
  central_midfielder: 0.25,
  attacking_midfielder: 0.5,
  right_winger: 0.62,
  left_winger: 0.62,
  second_striker: 0.78,
  striker: 1,
};
const creative: Record<CareerPosition, number> = {
  centre_back: 0.04,
  right_back: 0.18,
  left_back: 0.18,
  holding_midfielder: 0.18,
  central_midfielder: 0.38,
  attacking_midfielder: 0.52,
  right_winger: 0.4,
  left_winger: 0.4,
  second_striker: 0.27,
  striker: 0.13,
};
const leagueWeight = {
  europe_1: 1.3,
  europe_2: 1.18,
  europe_3: 1.05,
  europe_4: 0.88,
  south_america_a: 1,
  south_america_b: 0.82,
};
const talentBoost: Record<TalentBand, number> = {
  generational: 9,
  crack: 6,
  high: 3,
  normal: 0,
};
function drawTalent(seed: number): TalentBand {
  const roll = random(seed)();
  return roll < 0.025
    ? "generational"
    : roll < 0.12
      ? "crack"
      : roll < 0.36
        ? "high"
        : "normal";
}
function initialAttributes(overall: number, seed: number): PlayerAttributes {
  const rand = random(seed + 41);
  const value = (bias = 0) => clamp(overall + bias + (rand() - 0.5) * 10, 35, 99);
  return {
    finishing: value(), passing: value(1), dribbling: value(), control: value(1),
    tackling: value(), marking: value(), pace: value(2), strength: value(-2),
    stamina: value(), agility: value(2), vision: value(1), concentration: value(-1),
    determination: value(), tactics: value(-2), professionalism: value(),
  };
}
export function calculateBlocks(
  attributes: PlayerAttributes,
  fitness: number,
  morale: number,
  familyBond: number,
  reputation: number,
  rating = 6.2,
): PlayerBlocks {
  return {
    technical: clamp(mean(attributes.finishing, attributes.passing, attributes.dribbling, attributes.control, attributes.tackling, attributes.marking), 1, 99),
    physical: clamp(mean(attributes.pace, attributes.strength, attributes.stamina, attributes.agility), 1, 99),
    mentality: clamp(mean(attributes.vision, attributes.concentration, attributes.determination, attributes.tactics, attributes.professionalism), 1, 99),
    form: clamp(fitness * .34 + morale * .31 + familyBond * .14 + Math.min(100, reputation + 25) * .08 + rating * 2.1, 1, 99),
  };
}
export function calculateOverall(blocks: PlayerBlocks, position: CareerPosition) {
  const weights: Record<CareerPosition, [number, number, number]> = {
    centre_back: [.25, .32, .43], right_back: [.32, .36, .32], left_back: [.32, .36, .32],
    holding_midfielder: [.3, .25, .45], central_midfielder: [.4, .18, .42], attacking_midfielder: [.44, .16, .4],
    right_winger: [.48, .3, .22], left_winger: [.48, .3, .22], second_striker: [.5, .22, .28], striker: [.45, .32, .23],
  };
  const [technical, physical, mentality] = weights[position];
  return clamp(blocks.technical * technical + blocks.physical * physical + blocks.mentality * mentality, 35, 99);
}
export function hydrateCareer(state: CareerState): CareerState {
  const legacyPlayer = state.player as CareerState["player"] & { attributes?: PlayerAttributes; blocks?: PlayerBlocks };
  const looksLikeCappedLegacyMigration = legacyPlayer.attributes && legacyPlayer.blocks && state.seasons.length > 0 && legacyPlayer.overall > 70 && Math.max(legacyPlayer.blocks.technical, legacyPlayer.blocks.physical, legacyPlayer.blocks.mentality) <= 65;
  if (legacyPlayer.attributes && legacyPlayer.blocks && !looksLikeCappedLegacyMigration) {
    const overall = calculateOverall(legacyPlayer.blocks, legacyPlayer.position);
    return { ...state, contractUntil:state.contractUntil??state.year+2,seasonsAtClub:state.seasonsAtClub??0, player: { ...legacyPlayer, overall, potential: Math.max(legacyPlayer.potential, overall) } };
  }
  const attributes = looksLikeCappedLegacyMigration
    ? Object.fromEntries(Object.entries(legacyPlayer.attributes!).map(([key, value]) => [key, clamp(value + legacyPlayer.overall - 64, 25, 99)])) as PlayerAttributes
    : legacyPlayer.attributes ?? initialAttributes(legacyPlayer.overall, state.seed);
  const blocks = calculateBlocks(attributes, legacyPlayer.fitness, legacyPlayer.morale, legacyPlayer.familyBond, legacyPlayer.reputation);
  const overall = calculateOverall(blocks, legacyPlayer.position);
  return {
    ...state,
    contractUntil:state.contractUntil??state.year+2,
    seasonsAtClub:state.seasonsAtClub??0,
    player: {
      ...legacyPlayer,
      attributes,
      blocks,
      overall,
      potential: Math.max(legacyPlayer.potential, overall),
    },
  };
}
function evolveAttributes(attributes: PlayerAttributes, growth: number, training: TrainingFocus, age: number, minutes: number, selected: boolean, familyBond: number, club: CareerClub, rand: () => number): PlayerAttributes {
  const technical = new Set(["finishing", "passing", "dribbling", "control", "tackling", "marking"]);
  const physical = new Set(["pace", "strength", "stamina", "agility"]);
  const mental = new Set(["vision", "concentration", "determination", "tactics", "professionalism"]);
  return Object.fromEntries(Object.entries(attributes).map(([key, value]) => {
    const groupBoost = training === "balanced" ? .35 : training === "technical" && technical.has(key) ? 1.25 : training === "physical" && physical.has(key) ? 1.25 : training === "mental" && mental.has(key) ? 1.25 : training === "recovery" && mental.has(key) ? .25 : .08;
    const experience = mental.has(key) ? minutes / 2600 + (selected ? .45 : 0) + club.level / 240 : technical.has(key) ? club.academyQuality / 115 : .35;
    const ageEffect = physical.has(key) && age > 29 ? -(age - 29) * .82 : mental.has(key) && age >= 24 && age<34 ? .22 : mental.has(key)&&age>=34?-.18:0;
    const stability = mental.has(key) ? (familyBond - 50) / 180 : 0;
    const delta = growth * .28 + groupBoost + experience + ageEffect + stability + (rand() - .5) * .8;
    return [key, clamp(value + delta, 25, 99)];
  })) as PlayerAttributes;
}
function roleFor(
  overall: number,
  club: CareerClub,
  talent: TalentBand,
  age: number,
): CareerRole {
  const exceptional = age <= 19 ? talentBoost[talent] : 0;
  const gap =
    overall + exceptional - club.level - (club.squadCompetition - 70) / 12;
  if (age <= 16 && gap < 0) return "academy";
  if (gap < -8) return "prospect";
  if (gap < -2) return "rotation";
  if (gap < 7) return "starter";
  return "star";
}
const roleMinutes: Record<CareerRole, number> = {
  academy: 0,
  prospect: 430,
  rotation: 1200,
  starter: 2450,
  star: 3050,
};
export function createCareer(input: CreateCareerInput): CareerState {
  const talentBand = drawTalent(input.seed);
  const initialOverall = clamp(46 + talentBoost[talentBand] / 3, 44, 51);
  const attributes = initialAttributes(initialOverall, input.seed);
  const blocks = calculateBlocks(attributes, 92, 75, 80, 3);
  const overall = calculateOverall(blocks, input.position);
  return {
    schemaVersion: 2,
    id: `${input.seed}-${Date.now()}`,
    seed: input.seed,
    revision: 0,
    status: "active",
    phase: "season",
    player: {
      name: input.name.trim().slice(0, 40),
      shirtNumber: clamp(input.shirtNumber, 1, 99),
      nationality: input.nationality,
      position: input.position,
      age: 15,
      overall,
      potential: clamp(
        72 + talentBoost[talentBand] * 2 + random(input.seed + 5)() * 8,
        70,
        97,
      ),
      talentBand,
      fitness: 92,
      morale: 75,
      reputation: 3,
      familyBond: 80,
      attributes,
      blocks,
    },
    year: input.year ?? new Date().getFullYear(),
    club: input.club,
    contractUntil:(input.year??new Date().getFullYear())+3,
    seasonsAtClub:0,
    seasons: [],
    offers: [],
    totals: { ...EMPTY },
    legacyScore: 0,
    unlockedAchievementIds: [],
  };
}
function makeOffers(
  state: CareerState,
  clubs: CareerClub[],
  rand: () => number,
): TransferOffer[] {
  const p = state.player;
  const wantsHome = p.familyBond < 42;
  const last=state.seasons.at(-1);
  const contractWindow=state.contractUntil-state.year<=1;
  const marketChance=Math.min(.72,.12+p.reputation/240+(last?.rating??6)/30+(focusValue(last?.focus)==="visibility"?.12:0)-(p.age>=34?.12:0));
  if(!wantsHome&&!contractWindow&&state.seasonsAtClub<3)return [];
  if(!wantsHome&&rand()>marketChance)return [];
  const prestigeBonus=(c:CareerClub)=>c.careerCategory==="premium_international"?30:c.careerCategory==="elite_international"?22:c.careerCategory==="elite_national"?14:c.careerCategory==="national_b"?-6:c.prestige.includes("premium")?30:c.prestige.includes("elite")?22:4;
  return clubs
    .filter((c) => c.id !== state.club.id)
    .filter((c) => (!wantsHome||c.country===p.nationality)&&c.level>=p.overall-(p.age>=33?10:15)&&c.level<=p.overall+(p.age<=21?10:7))
    .filter((c) => p.overall>=90&&c.careerCategory==="premium_international" ? true : rand() < Math.min(.72,.12+p.reputation/220+(last?.rating??6)/28-(p.age>=36?.16:0)))
    .sort((a, b) => {
      const score=(c:CareerClub)=>prestigeBonus(c)+leagueWeight[c.leagueBand]*8+c.level*1.4+Math.max(0,8-Math.abs(c.level-p.overall))*2+(c.country===p.nationality?5:0)+(last?.trophies.includes("continental")?8:0)+rand()*8;
      return score(b)-score(a);
    })
    .slice(0, 3)
    .map((club, i) => ({
      id: `${state.year}-${club.id}-${i}`,
      club,
      role: roleFor(p.overall, club, p.talentBand, p.age),
      kind: p.age <= 21 && club.level > p.overall + 9 ? "loan" : "transfer",
      familyReturn:
        club.country === p.nationality && state.club.country !== p.nationality,
    }));
}
const focusValue=(focus:SeasonFocus|undefined)=>focus??"team";
function competitionResults(state:CareerState,club:CareerClub,selected:boolean,year:number,overall:number,rand:()=>number){
  const strength=club.level+Math.max(-4,Math.min(6,(overall-club.level)/2));
  const champion=(difficulty:number)=>rand()<Math.max(.015,(strength-difficulty)/85+.08);
  const leagueChampion=champion(76),cupChampion=champion(73);
  const results:CompetitionResult[]=[{name:"Liga nacional",stage:leagueChampion?"Campeón":`Posición ${Math.max(1,Math.round(13-(strength-65)/3+rand()*6))}`,champion:leagueChampion,kind:"domestic"},{name:"Copa nacional",stage:cupChampion?"Campeón":rand()<.5?"Semifinales":"Cuartos de final",champion:cupChampion,kind:"cup"}];
  const previous=state.seasons.at(-1),position=Number(previous?.competitions?.find(x=>x.kind==="domestic")?.stage.match(/\d+/)?.[0]??99);
  const established=["premium_international","elite_international"].includes(club.careerCategory??"");
  const qualified=club.domesticDivision!==2&&(previous?.club.id===club.id?previous.trophies.includes("league")||position<=({europe_1:6,europe_2:5,europe_3:4,europe_4:3,south_america_a:6,south_america_b:4}[club.leagueBand]):established||club.level>=84);
  if(qualified){const won=champion(89);const european=club.leagueBand.startsWith("europe");const name=european?(club.level>=88||club.careerCategory==="premium_international"?"Champions League":club.level>=82?"Europa League":"Conference League"):"Copa Libertadores";results.push({name,stage:won?"Campeón":rand()<.38?"Semifinales":"Octavos de final",champion:won,kind:"continental" as const})}
  if(selected&&year%4===2){const won=rand()<.13;results.push({name:"Torneo internacional de selecciones",stage:won?"Campeón":rand()<.5?"Semifinales":"Cuartos de final",champion:won,kind:"international" as const})}
  return results;
}
export function simulateSeason(
  state: CareerState,
  focus: SeasonFocus,
  clubs: CareerClub[],
  training: TrainingFocus = "balanced",
  decisionChoiceId = "no",
): CareerState {
  if (state.status !== "active" || state.phase !== "season") return state;
  const rand = random(state.seed + state.year * 97 + state.revision * 7919),
    p = state.player,
    club = state.club;
  const role = roleFor(p.overall, club, p.talentBand, p.age);
  const injuryRisk = Math.max(
    0.025,
    0.13 - p.fitness / 1200 - (focus === "recovery" ? 0.045 : 0),
  );
  const injuredGames =
    rand() < injuryRisk ? clamp(2 + rand() * (p.age > 33 ? 13 : 8), 2, 16) : 0;
  const familyRisk =
    club.country !== p.nationality && p.familyBond < 58 && rand() < 0.2;
  const event: CareerSeason["event"] = familyRisk
    ? "family"
    : injuredGames
      ? "injury"
      : rand() < 0.1
        ? "breakthrough"
        : rand() < 0.17
          ? "mentor"
          : rand() < 0.24
            ? "competition"
            : "none";
  const opportunity =
    (club.youthOpportunity - 50) * 7 +
    (focus === "team" ? 240 : 0) +
    (p.talentBand === "generational"
      ? 400
      : p.talentBand === "crack"
        ? 250
        : 0);
  const minutes = clamp(
    roleMinutes[role] + opportunity - injuredGames * 75 + (rand() - 0.5) * 350,
    0,
    3420,
  );
  const appearances = clamp(minutes / 82, 0, 38);
  const performanceBase = 0.72 + rand() * 0.42 + (p.overall - club.level) / 100;
  const goals = clamp(
    appearances * attack[p.position] * performanceBase,
    0,
    50,
  );
  const assists = clamp(
    appearances * creative[p.position] * performanceBase,
    0,
    30,
  );
  const cleanSheets =
    attack[p.position] <= 0.12
      ? clamp(
          appearances * (0.18 + club.level / 300) * (0.7 + rand() * 0.3),
          0,
          24,
        )
      : 0;
  const rating =
    Math.round((5.7 + (p.overall - 48) / 35 + rand() * 0.6) * 10) / 10;
  const selected =
    p.reputation > 34 &&
    p.overall > 69 &&
    rand() < Math.min(0.88, 0.2 + p.reputation / 130);
  const internationalCaps = selected ? clamp(2 + rand() * 9, 1, 12) : 0,
    internationalGoals = selected
      ? clamp(internationalCaps * attack[p.position] * rand(), 0, 10)
      : 0;
  const competitions=competitionResults(state,club,selected,state.year,p.overall,rand);
  const trophies=competitions.filter(x=>x.champion).map(x=>x.kind==="domestic"?"league":x.kind);
  const minutesFactor = Math.min(1.25, minutes / 1800);
  const ageCurve =
    p.age <= 18
      ? 3
      : p.age <= 22
        ? 2
      : p.age <= 27
          ? .7
          : p.age <= 29
            ? .15
            : p.age <= 31
              ? -.65
              : p.age<=33
                ? -1.35
                : p.age<=35
                  ? -2.15
                  : -3;
  const formation = (club.academyQuality - 60) / 22;
  const focusGrowth =
    focus === "development"
      ? .85
      : focus === "recovery" && p.age > 30
        ? 0.7
        : 0;
  const trainingGrowth = training === "balanced" ? .25 : training === "recovery" ? .08 : .5;
  const contextGrowth =
    (p.morale - 65) / 120 +
    (p.familyBond - 50) / 220 +
    Math.min(80, p.reputation) / 320 +
    (selected ? .35 : 0);
  const stalled =
    minutes < 500 && p.age >= 17
      ? -2.2
      : minutes < 1000 && p.age >= 18
        ? -1
        : 0;
  const rawGrowth =
    ageCurve +
    formation * minutesFactor +
    focusGrowth +
    trainingGrowth +
    contextGrowth +
    talentBoost[p.talentBand] / 6 +
    stalled +
    (event === "breakthrough" ? 1.5 : 0) -
    (injuredGames > 9 ? 1 : 0);
  const growth = clamp(
    p.overall >= p.potential ? Math.min(0, rawGrowth) : rawGrowth,
    -3,
    8,
  );
  const previousBlocks = p.blocks;
  const attributes = evolveAttributes(p.attributes, growth, training, p.age, minutes, selected, p.familyBond, club, rand);
  const dilemma=decisionFor(state),choice=dilemma.choices.find(x=>x.id===decisionChoiceId)??dilemma.choices[1];
  const decisionSuccess=choice.chance===undefined||rand()<choice.chance/100,factor=decisionSuccess?1:-.75;
  const effects=dilemma.id==="doping"&&choice.id==="yes"?(decisionSuccess?{physical:4}:{physical:2,form:-12,reputation:-35}):choice.effects;
  const nextFitness = clamp(84 - injuredGames + (focus === "recovery" || training === "recovery" ? 12 : 0)+(effects.form??0)*factor, 35, 100);
  const nextMorale = clamp(65 + trophies.length * 12 + rating * 2 + (focus === "family" ? 8 : 0) - (event === "family" ? 10 : 0)+(effects.form??0)*factor, 30, 100);
  const nextFamilyBond = clamp(p.familyBond + (club.country === p.nationality ? 8 : focus === "family" ? 10 : -4) - (event === "family" ? 10 : 0)+(effects.family??0)*factor, 0, 100);
  const calculatedBlocks=calculateBlocks(attributes,nextFitness,nextMorale,nextFamilyBond,p.reputation,rating);
  let nextBlocks=Object.fromEntries(Object.entries(calculatedBlocks).map(([key,value])=>[key,clamp(value+((effects as Partial<PlayerBlocks>)[key as keyof PlayerBlocks]??0)*factor,1,99)])) as PlayerBlocks;
  const veteranBonus=p.talentBand==="generational"?2:p.talentBand==="crack"?1:0;
  const ageCap=p.age<30?99:Math.max(72,93-(p.age-30)*1.65+veteranBonus);
  const ratingCap=Math.min(p.potential,ageCap),rawOverall=calculateOverall(nextBlocks,p.position);
  if(rawOverall>ratingCap){const reduction=rawOverall-ratingCap;nextBlocks={...nextBlocks,technical:clamp(nextBlocks.technical-reduction,1,99),physical:clamp(nextBlocks.physical-reduction,1,99),mentality:clamp(nextBlocks.mentality-reduction,1,99)};}
  const blockChanges = Object.fromEntries(Object.keys(nextBlocks).map(key => [key, nextBlocks[key as keyof PlayerBlocks] - previousBlocks[key as keyof PlayerBlocks]])) as PlayerBlocks;
  const season: CareerSeason = {
    year: state.year,
    age: p.age,
    club,
    overall: p.overall,
    role,
    minutes,
    appearances,
    goals,
    assists,
    cleanSheets,
    titles: trophies.length,
    internationalCaps,
    internationalGoals,
    rating,
    injuredGames,
    trophies,
    selected,
    event,
    growth,
    contribution:Math.round(Math.min(1,minutes/2100)*Math.max(.15,Math.min(1.15,(rating-5.5)/1.8))*100)/100,
    blocks: nextBlocks,
    blockChanges,
    training,
    focus,
    competitions,
    decision:{title:dilemma.title,choice:choice.label,outcome:choice.chance===undefined?"Decisión aplicada":decisionSuccess?"El riesgo salió a tu favor":"Las consecuencias negativas se hicieron realidad",success:decisionSuccess,chance:choice.chance},
  };
  const totals = Object.fromEntries(
    Object.keys(EMPTY).map((k) => [
      k,
      state.totals[k as keyof CareerTotals] + season[k as keyof CareerTotals],
    ]),
  ) as unknown as CareerTotals;
  const overall = clamp(calculateOverall(nextBlocks, p.position),35,ageCap),
    reputation = clamp(
      p.reputation +
        (minutes / 650 + goals * 1.1 + assists*.85 + trophies.length * 7*(season.contribution??0)) *
          leagueWeight[club.leagueBand] +
        (focus === "visibility" ? 6 : 0)+(effects.reputation??0)*factor,
      0,
      100,
    );
  const legacyScore = Math.max(
    0,
    Math.round(
      (totals.appearances +
        totals.goals * 3 +
        totals.assists * 2 +
        totals.cleanSheets * 2 +
        state.seasons.reduce((sum,x)=>sum+x.titles*120*(x.contribution??Math.min(1,x.minutes/2100)),0)+season.titles*120*(season.contribution??0) +
        totals.internationalCaps * 4 +
        totals.internationalGoals * 5 +
        Math.max(0, overall - 50) * 10) *
        leagueWeight[club.leagueBand],
    ),
  );
  const age = p.age + 1, familyBond = nextFamilyBond;
  const base: CareerState = {
    ...state,
    revision: state.revision + 1,
    year: state.year + 1,
    seasonsAtClub:state.seasonsAtClub+1,
    seasons: [...state.seasons, season],
    totals,
    legacyScore,
    player: {
      ...p,
      age,
      overall,
      reputation,
      familyBond,
      fitness: nextFitness,
      morale: nextMorale,
      attributes,
      blocks: nextBlocks,
    },
  };
  if (age >= 40) return retireCareer(base);
  const offers = makeOffers(base, clubs, rand);
  return { ...base, offers, phase: offers.length ? "offers" : "season" };
}
export function resolveOffer(
  state: CareerState,
  offerId: string | null,
): CareerState {
  if (state.phase !== "offers") return state;
  const offer = state.offers.find((x) => x.id === offerId);
  return {
    ...state,
    revision: state.revision + 1,
    club: offer?.club ?? state.club,
    contractUntil:offer?state.year+(offer.kind==="loan"?1:3+((state.seed+state.year)%2)):state.contractUntil<=state.year?state.year+2:state.contractUntil,
    seasonsAtClub:offer?0:state.seasonsAtClub,
    offers: [],
    phase: "season",
    player: {
      ...state.player,
      morale: clamp(state.player.morale + (offer ? 5 : 1), 0, 100),
      familyBond: clamp(
        state.player.familyBond + (offer?.familyReturn ? 25 : 0),
        0,
        100,
      ),
    },
  };
}
export function retireCareer(state: CareerState): CareerState {
  return state.status === "retired"
    ? state
    : {
        ...state,
        revision: state.revision + 1,
        status: "retired",
        phase: "retired",
        offers: [],
      };
}
