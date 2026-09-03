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
import { decisionFor, targetNationalityFor } from "./decisions.ts";
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
export function domesticLeagueName(club:CareerClub){
  if(club.domesticDivision===2)return ({España:"LaLiga Hypermotion",Inglaterra:"Championship",Alemania:"2. Bundesliga",Italia:"Serie B",Francia:"Ligue 2",Portugal:"Liga Portugal 2",Argentina:"Primera Nacional",Brasil:"Série B"} as Record<string,string>)[club.country]??club.leagueName??"Segunda División";
  return ({España:"LaLiga",Inglaterra:"Premier League",Alemania:"Bundesliga",Italia:"Serie A",Francia:"Ligue 1",Portugal:"Liga Portugal",Países_Bajos:"Eredivisie",Bélgica:"Pro League",Argentina:"Liga Profesional Argentina",Brasil:"Brasileirão",Uruguay:"Primera División de Uruguay",Chile:"Primera División de Chile",Colombia:"Categoría Primera A",Ecuador:"LigaPro",Paraguay:"Primera División de Paraguay",Dinamarca:"Superliga danesa"} as Record<string,string>)[club.country.replaceAll(" ","_")]??club.leagueName??"Liga nacional";
}
const nationalTeamStrength:Record<string,number>={
  Argentina:94,Brasil:94,Francia:93,España:92,Inglaterra:91,Alemania:91,Italia:89,Portugal:88,
  "Países Bajos":88,Uruguay:87,Bélgica:84,Colombia:83,Chile:79,Ecuador:78,Paraguay:77,Dinamarca:82,
};
function competitionResults(state:CareerState,club:CareerClub,selected:boolean,year:number,overall:number,rating:number,minutes:number,rand:()=>number){
  const strength=club.level+Math.max(-4,Math.min(6,(overall-club.level)/2));
  const champion=(difficulty:number)=>rand()<Math.max(.015,(strength-difficulty)/85+.08);
  const leagueChampion=champion(76),cupChampion=champion(73);
  const results:CompetitionResult[]=[{name:domesticLeagueName(club),stage:leagueChampion?"Campeón":`Posición ${Math.max(1,Math.round(13-(strength-65)/3+rand()*6))}`,champion:leagueChampion,kind:"domestic"},{name:"Copa nacional",stage:cupChampion?"Campeón":rand()<.5?"Semifinales":"Cuartos de final",champion:cupChampion,kind:"cup"}];
  const previous=state.seasons.at(-1),position=Number(previous?.competitions?.find(x=>x.kind==="domestic")?.stage.match(/\d+/)?.[0]??99);
  const established=["premium_international","elite_international"].includes(club.careerCategory??"");
  const qualified=club.domesticDivision!==2&&(previous?.club.id===club.id?previous.trophies.includes("league")||position<=({europe_1:6,europe_2:5,europe_3:4,europe_4:3,south_america_a:6,south_america_b:4}[club.leagueBand]):established||club.level>=84);
  if(qualified){
    const categoryBonus=club.careerCategory==="premium_international"?.09:club.careerCategory==="elite_international"?.055:club.careerCategory==="elite_national"?.025:0;
    const playerBonus=Math.max(0,overall-76)*.004+Math.max(0,rating-7)*.035+Math.min(.025,minutes/100000);
    const recentMisses=state.seasons.slice(-3).filter(s=>s.competitions?.some(c=>c.kind==="continental"&&!c.champion)).length;
    const winChance=Math.min(.38,Math.max(.025,.035+(strength-72)*.006+categoryBonus+playerBonus+recentMisses*.012));
    const won=rand()<winChance,european=club.leagueBand.startsWith("europe");
    const name=european?(club.level>=88||club.careerCategory==="premium_international"?"Champions League":club.level>=82?"Europa League":"Conference League"):"Copa Libertadores";
    const stageRoll=rand();
    results.push({name,stage:won?"Campeón":stageRoll<.2?"Final":stageRoll<.48?"Semifinales":stageRoll<.75?"Cuartos de final":"Octavos de final",champion:won,kind:"continental" as const});
  }
  if(selected&&(year%4===2||year%4===0)){
    const european=["España","Inglaterra","Francia","Alemania","Italia","Portugal","Países Bajos","Bélgica","Dinamarca"].includes(state.player.nationality);
    const southAmerican=["Argentina","Brasil","Uruguay","Chile","Colombia","Ecuador","Paraguay"].includes(state.player.nationality);
    const name=year%4===2?"Copa Mundial":european?"Eurocopa":southAmerican?"Copa América":"Copa Mundial";
    const teamStrength=nationalTeamStrength[state.player.nationality]??73;
    const playerImpact=Math.max(0,overall-70)*.004+Math.max(0,rating-6.8)*.035+Math.min(.025,minutes/100000);
    const previousEliminations=state.seasons.filter(s=>s.competitions?.some(c=>c.kind==="international"&&!c.champion)).length;
    const winChance=Math.min(.36,Math.max(.025,.035+(teamStrength-72)*.006+playerImpact+Math.min(.045,previousEliminations*.012)));
    const won=rand()<winChance,stageRoll=rand();
    results.push({name,stage:won?"Campeón":stageRoll<.16?"Final":stageRoll<.45?"Semifinales":stageRoll<.76?"Cuartos de final":"Fase de grupos",champion:won,kind:"international" as const});
  }
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
  const competitions=competitionResults(state,club,selected,state.year,p.overall,rating,minutes,rand);
  const trophies=competitions.filter(x=>x.champion).map(x=>x.kind==="domestic"?"league":x.kind);
  const individualAwards:string[]=[];
  if(p.age<=21&&minutes>=1500&&rating>=7.25)individualAwards.push("Mejor jugador joven");
  if(goals>=({striker:24,second_striker:21,right_winger:18,left_winger:18} as Partial<Record<CareerPosition,number>>)[p.position]!)individualAwards.push("Bota de Oro");
  if(minutes>=2200&&rating>=7.55&&rand()<Math.min(.55,.08+(rating-7.3)*.55+Math.max(0,p.overall-82)*.018))individualAwards.push("Jugador del Año");
  const majorTitles=competitions.filter(x=>x.champion&&(x.kind==="continental"||x.kind==="international")).length;
  const positionOutput=attack[p.position]<=.12?cleanSheets:goals+assists;
  const ballonScore=(p.overall-80)*.02+(rating-7)*.24+Math.min(.18,positionOutput*.006)+majorTitles*.15+(trophies.includes("league")?.05:0)+(club.careerCategory==="premium_international"?.035:0);
  const ballonChance=Math.min(.75,Math.max(0,ballonScore-.08));
  if(p.overall>=81&&minutes>=1800&&positionOutput>=(attack[p.position]<=.12?9:12)&&rand()<ballonChance)individualAwards.push("Balón de Oro");
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
  const nationalityTarget=dilemma.id==="nationality"&&choice.id==="yes"?targetNationalityFor(state):null;
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
    individualAwards,
    selected,
    event,
    growth,
    contribution:Math.round(Math.min(1,minutes/2100)*Math.max(.15,Math.min(1.15,(rating-5.5)/1.8))*100)/100,
    blocks: nextBlocks,
    blockChanges,
    training,
    focus,
    competitions,
    decision:{decisionId:dilemma.id,choiceId:choice.id,title:dilemma.title,choice:choice.label,outcome:nationalityTarget?`Ahora representas a ${nationalityTarget}`:choice.chance===undefined?"Decisión aplicada":decisionSuccess?"El riesgo salió a tu favor":"Las consecuencias negativas se hicieron realidad",success:decisionSuccess,chance:choice.chance,nationalityChange:nationalityTarget?{from:p.nationality,to:nationalityTarget}:undefined},
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
      nationality:nationalityTarget??p.nationality,
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
