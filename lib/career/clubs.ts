import { supabase } from "../supabase.ts";
import type { CareerCategory, CareerClub, LeagueBand, Prestige } from "./types.ts";
type Profile = Omit<CareerClub, "id" | "badgeUrl">;
const p = (
  name: string,
  country: string,
  level: number,
  prestige: Prestige,
  leagueBand: LeagueBand,
  academyQuality: number,
  youthOpportunity: number,
  squadCompetition: number,
  sellingProfile: number,
): Profile => ({
  name,
  country,
  level,
  prestige,
  leagueBand,
  academyQuality,
  youthOpportunity,
  squadCompetition,
  sellingProfile,
});
// Curated Career-only snapshot: prestige and academy quality are deliberately independent.
const PROFILES: Profile[] = [
  p("Real Madrid", "España", 94, "premium_europe", "europe_1", 95, 22, 99, 30),
  p("Barcelona", "España", 91, "premium_europe", "europe_1", 98, 58, 94, 38),
  p(
    "Manchester City",
    "Inglaterra",
    94,
    "premium_europe",
    "europe_1",
    94,
    24,
    99,
    28,
  ),
  p(
    "Manchester United",
    "Inglaterra",
    86,
    "premium_europe",
    "europe_1",
    91,
    45,
    92,
    38,
  ),
  p(
    "Liverpool",
    "Inglaterra",
    91,
    "premium_europe",
    "europe_1",
    90,
    35,
    96,
    30,
  ),
  p("Arsenal", "Inglaterra", 91, "premium_europe", "europe_1", 91, 48, 94, 30),
  p("Chelsea", "Inglaterra", 88, "premium_europe", "europe_1", 93, 32, 98, 65),
  p(
    "Bayern München",
    "Alemania",
    93,
    "premium_europe",
    "europe_2",
    92,
    30,
    97,
    25,
  ),
  p(
    "Borussia Dortmund",
    "Alemania",
    88,
    "premium_europe",
    "europe_2",
    94,
    70,
    88,
    78,
  ),
  p("Juventus", "Italia", 88, "premium_europe", "europe_2", 87, 42, 91, 35),
  p("Inter", "Italia", 91, "premium_europe", "europe_2", 86, 30, 95, 25),
  p("AC Milan", "Italia", 88, "premium_europe", "europe_2", 89, 45, 91, 32),
  p(
    "Paris Saint-Germain",
    "Francia",
    92,
    "premium_europe",
    "europe_2",
    91,
    30,
    98,
    28,
  ),
  p(
    "Atlético de Madrid",
    "España",
    88,
    "elite_europe",
    "europe_1",
    86,
    35,
    93,
    30,
  ),
  p("Tottenham", "Inglaterra", 87, "elite_europe", "europe_1", 87, 42, 92, 35),
  p("Napoli", "Italia", 87, "elite_europe", "europe_2", 82, 38, 90, 34),
  p("Roma", "Italia", 84, "elite_europe", "europe_2", 88, 50, 86, 38),
  p("Marseille", "Francia", 83, "elite_europe", "europe_2", 86, 55, 84, 45),
  p("Lyon", "Francia", 81, "elite_europe", "europe_2", 94, 72, 79, 75),
  p("Benfica", "Portugal", 85, "elite_europe", "europe_3", 98, 72, 85, 94),
  p("Sporting CP", "Portugal", 84, "elite_europe", "europe_3", 97, 76, 82, 92),
  p("Porto", "Portugal", 85, "elite_europe", "europe_3", 92, 62, 86, 90),
  p("Ajax", "Países Bajos", 82, "elite_europe", "europe_3", 98, 82, 80, 95),
  p("PSV", "Países Bajos", 83, "elite_europe", "europe_3", 94, 75, 82, 90),
  p(
    "Feyenoord",
    "Países Bajos",
    82,
    "elite_europe",
    "europe_3",
    91,
    72,
    82,
    85,
  ),
  p(
    "River Plate",
    "Argentina",
    85,
    "premium_south_america",
    "south_america_a",
    96,
    72,
    88,
    90,
  ),
  p(
    "Boca Juniors",
    "Argentina",
    84,
    "premium_south_america",
    "south_america_a",
    93,
    66,
    90,
    84,
  ),
  p(
    "Flamengo",
    "Brasil",
    86,
    "premium_south_america",
    "south_america_a",
    93,
    55,
    94,
    72,
  ),
  p(
    "Palmeiras",
    "Brasil",
    87,
    "premium_south_america",
    "south_america_a",
    95,
    62,
    94,
    78,
  ),
  p(
    "Corinthians",
    "Brasil",
    82,
    "premium_south_america",
    "south_america_a",
    91,
    62,
    87,
    72,
  ),
  p(
    "São Paulo",
    "Brasil",
    82,
    "premium_south_america",
    "south_america_a",
    96,
    70,
    85,
    84,
  ),
  p(
    "Santos",
    "Brasil",
    78,
    "premium_south_america",
    "south_america_a",
    98,
    85,
    76,
    96,
  ),
  p(
    "Grêmio",
    "Brasil",
    81,
    "premium_south_america",
    "south_america_a",
    92,
    72,
    83,
    84,
  ),
  p(
    "Peñarol",
    "Uruguay",
    76,
    "premium_south_america",
    "south_america_b",
    91,
    85,
    72,
    95,
  ),
  p(
    "Nacional",
    "Uruguay",
    76,
    "premium_south_america",
    "south_america_b",
    90,
    84,
    72,
    94,
  ),
  p(
    "Independiente",
    "Argentina",
    78,
    "elite_south_america",
    "south_america_a",
    88,
    72,
    79,
    78,
  ),
  p(
    "Racing Club",
    "Argentina",
    81,
    "elite_south_america",
    "south_america_a",
    88,
    68,
    84,
    75,
  ),
  p(
    "San Lorenzo",
    "Argentina",
    78,
    "elite_south_america",
    "south_america_a",
    87,
    72,
    79,
    78,
  ),
  p("Danubio", "Uruguay", 66, "standard", "south_america_b", 93, 94, 57, 98),
  p(
    "Defensor Sporting",
    "Uruguay",
    67,
    "standard",
    "south_america_b",
    92,
    92,
    59,
    97,
  ),
  p(
    "Liverpool Montevideo",
    "Uruguay",
    68,
    "standard",
    "south_america_b",
    83,
    88,
    62,
    93,
  ),
  p(
    "Argentinos Juniors",
    "Argentina",
    75,
    "standard",
    "south_america_a",
    95,
    88,
    70,
    94,
  ),
  p(
    "Vélez Sarsfield",
    "Argentina",
    78,
    "standard",
    "south_america_a",
    94,
    80,
    78,
    88,
  ),
  p(
    "Newell's Old Boys",
    "Argentina",
    75,
    "standard",
    "south_america_a",
    91,
    84,
    73,
    88,
  ),
  p(
    "Rosario Central",
    "Argentina",
    76,
    "standard",
    "south_america_a",
    89,
    80,
    76,
    84,
  ),
  p("Envigado", "Colombia", 63, "standard", "south_america_b", 91, 95, 54, 98),
  p("Huachipato", "Chile", 66, "standard", "south_america_b", 86, 91, 59, 94),
  p("Athletic Club", "España", 83, "standard", "europe_1", 96, 80, 84, 45),
  p("Real Sociedad", "España", 84, "standard", "europe_1", 96, 82, 83, 52),
  p("Valencia", "España", 80, "standard", "europe_1", 92, 75, 81, 78),
  p("Celta de Vigo", "España", 77, "standard", "europe_1", 87, 78, 76, 72),
  p("Southampton", "Inglaterra", 74, "standard", "europe_1", 91, 80, 75, 92),
  p("West Ham", "Inglaterra", 81, "standard", "europe_1", 87, 62, 85, 58),
  p("Rennes", "Francia", 80, "standard", "europe_2", 94, 79, 80, 90),
  p("Nantes", "Francia", 74, "standard", "europe_2", 89, 82, 71, 86),
  p("Freiburg", "Alemania", 79, "standard", "europe_2", 89, 80, 78, 80),
  p("Empoli", "Italia", 72, "standard", "europe_2", 88, 88, 68, 94),
  p(
    "Vitória Guimarães",
    "Portugal",
    75,
    "standard",
    "europe_3",
    86,
    82,
    72,
    90,
  ),
  p("AZ Alkmaar", "Países Bajos", 80, "standard", "europe_3", 93, 82, 78, 92),
  p("Genk", "Bélgica", 78, "standard", "europe_3", 94, 84, 74, 94),
  p("Nordsjælland", "Dinamarca", 72, "standard", "europe_4", 95, 96, 63, 98),
];
export const CAREER_CLUBS: CareerClub[] = PROFILES.map((x, i) => ({
  ...x,
  id: `career-${i + 1}`,
  badgeUrl:x.name==="Envigado"?"https://media.api-sports.io/football/teams/1129.png":null,
}));
const normalize = (v: string) =>
  v
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
const CLUB_ALIASES: Record<string, string[]> = {
  atleticodemadrid:["atleticomadrid"],
  bayernmunchen: ["bayernmunich", "fcbayernmunchen"],
  borussiadortmund: ["dortmund", "bvbdortmund"],
  parissaintgermain: ["psg", "parissg"],
  acmilan: ["milan"],
  inter: ["internazionale", "intermilan"],
  roma: ["asroma"],
  marseille: ["olympiquedemarseille"],
  lyon: ["olympiquelyonnais"],
  sportingcp: ["sportinglisbon", "sportingclubedeportugal"],
  porto:["fcporto"],
  psv: ["psveindhoven"],
  ajax: ["ajaxamsterdam"],
  riverplate: ["riverplatebuenosaires"],
  racingclub: ["racing"],
  athleticclub: ["athleticbilbao"],
  westham: ["westhamunited"],
  vitoriaguimaraes: ["vitoriasc", "vitoriaguimaraessc"],
  nacional: ["clubnacional", "clubnacionaldefootball", "nacionalmontevideo"],
  penarol: ["capenarol", "clubatleticopenarol"],
  argentinosjuniors:["argentinosjrs"],
  envigado:["envigadofc"],
  celtadevigo:["celtavigo"],
  freiburg:["scfreiburg"],
  nordsjlland:["fcnordsjaelland"],
};
export async function loadCareerClubs(): Promise<CareerClub[]> {
  if (!supabase) return CAREER_CLUBS;
  type ClubRow={id:number;name:string;badge_url:string|null;career_category:string;domestic_division:1|2|null;domestic_league_name:string|null;countries:{name:string}|{name:string}[]|null};
  const data:ClubRow[]=[];
  for(let from=0;;from+=1000){
    const {data:page,error}=await supabase.from("clubs").select("id,name,badge_url,career_category,domestic_division,domestic_league_name,countries(name)").eq("is_active",true).eq("is_national_team",false).eq("is_game_eligible",true).order("id").range(from,from+999);
    if(error||!page)return CAREER_CLUBS;
    data.push(...page as unknown as ClubRow[]);
    if(page.length<1000)break;
  }
  const dbCountry:Record<string,string>={España:"Spain",Inglaterra:"England",Alemania:"Germany",Italia:"Italy",Francia:"France","Países Bajos":"Netherlands",Brasil:"Brazil",Bélgica:"Belgium",Dinamarca:"Denmark"};
  const relationName=(row:ClubRow)=>{const relation=row.countries;return Array.isArray(relation)?relation[0]?.name:relation?.name};
  const rows = new Map<string,ClubRow>();
  for(const row of data)rows.set(`${normalize(relationName(row)??"")}|${normalize(row.name)}`,row);
  const curated=CAREER_CLUBS.map((profile) => {
    const key = normalize(profile.name);
    const country=normalize(dbCountry[profile.country]??profile.country);
    const row = [key, ...(CLUB_ALIASES[key] ?? [])]
      .map((alias) => rows.get(`${country}|${alias}`))
      .find(Boolean);
    return row
      ? {
          ...profile,
          id: String(row.id),
          name: row.name,
          badgeUrl: row.badge_url,
          careerCategory:row.career_category as CareerCategory,
          domesticDivision:row.domestic_division,
          leagueName:row.domestic_league_name,
        }
      : profile;
  });
  const used=new Set(curated.map(x=>String(x.id)));
  const countryNames:Record<string,string>={Spain:"España",England:"Inglaterra",Germany:"Alemania",Italy:"Italia",France:"Francia",Netherlands:"Países Bajos",Brazil:"Brasil"};
  const categoryLevel:Record<CareerCategory,number>={premium_international:92,elite_international:86,elite_national:80,national:71,national_b:63};
  const extras=data.filter(x=>!used.has(String(x.id))&&x.career_category).map((x):CareerClub=>{
    const relation=x.countries as unknown as {name:string}|{name:string}[]|null;
    const category=x.career_category as CareerCategory,rawCountry=Array.isArray(relation)?relation[0]?.name:relation?.name,country=rawCountry?(countryNames[rawCountry]??rawCountry):"";
    const europe1=["España","Inglaterra"].includes(country),europe2=["Italia","Francia","Alemania"].includes(country),europe3=["Portugal","Países Bajos","Bélgica"].includes(country);
    const leagueBand:LeagueBand=["Argentina","Brasil"].includes(country)?"south_america_a":["Uruguay","Chile","Colombia","Ecuador","Paraguay","Perú","Bolivia","Venezuela"].includes(country)?"south_america_b":europe1?"europe_1":europe2?"europe_2":europe3?"europe_3":"europe_4";
    const level=categoryLevel[category];return{id:String(x.id),name:x.name,country,badgeUrl:x.badge_url,level,prestige:"standard",leagueBand,academyQuality:category==="national_b"?66:72,youthOpportunity:category==="national_b"?78:65,squadCompetition:level,sellingProfile:65,careerCategory:category,domesticDivision:x.domestic_division,leagueName:x.domestic_league_name};
  });
  return [...curated,...extras];
}
export const NATIONALITIES = [
  "Alemania",
  "Argentina",
  "Bélgica",
  "Brasil",
  "Chile",
  "Colombia",
  "Dinamarca",
  "Ecuador",
  "España",
  "Francia",
  "Inglaterra",
  "Italia",
  "Países Bajos",
  "Paraguay",
  "Portugal",
  "Uruguay",
] as const;
export const NATIONALITY_FLAG_PATHS:Record<(typeof NATIONALITIES)[number],string>={Alemania:"/flags/de.svg",Argentina:"/flags/ar.svg",Bélgica:"/flags/be.svg",Brasil:"/flags/br.svg",Chile:"/flags/cl.svg",Colombia:"/flags/co.svg",Dinamarca:"/flags/dk.svg",Ecuador:"/flags/ec.svg",España:"/flags/es.svg",Francia:"/flags/fr.svg",Inglaterra:"/flags/gb.svg",Italia:"/flags/it.svg","Países Bajos":"/flags/nl.svg",Paraguay:"/flags/py.svg",Portugal:"/flags/pt.svg",Uruguay:"/flags/uy.svg"};
export function starterClubsFor(nationality: string, clubs: CareerClub[]) {
  const home = clubs.filter((c) => c.country === nationality);
  return [...(home.length ? home : clubs)].sort(
    (a, b) =>
      b.youthOpportunity +
      b.academyQuality -
      (a.youthOpportunity + a.academyQuality),
  ).slice(0,3);
}
