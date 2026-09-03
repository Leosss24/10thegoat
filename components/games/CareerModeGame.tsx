"use client";
import { useEffect, useMemo, useState } from "react";
import { useI18n } from "../I18nProvider";
import {
  achievementDefinitions,
  evaluateCareerAchievements,
} from "../../lib/achievements";
import {
  CAREER_CLUBS,
  NATIONALITIES,
  NATIONALITY_FLAG_PATHS,
  loadCareerClubs,
  starterClubsFor,
} from "../../lib/career/clubs";
import {
  createCareer,
  academySalary,
  domesticLeagueName,
  resolveOffer,
  retireCareer,
  simulateSeason,
  talentBandForSeed,
} from "../../lib/career/engine";
import { CAREER_DECISIONS, decisionFor, targetNationalityFor } from "../../lib/career/decisions";
import type { DecisionEffects } from "../../lib/career/decisions";
import { localizeDecision } from "../../lib/career/decision-i18n";
import { clearCareer, loadCareer, saveCareer } from "../../lib/career/storage";
import CareerAccountPanel from "./CareerAccountPanel";
import type {
  CareerClub,
  CareerPosition,
  CareerState,
  DecisionResult,
  SeasonFocus,
  TrainingFocus,
} from "../../lib/career/types";
type Celebration={kind:"title";name:string;scope:"collective"|"individual"}|{kind:"tournament";name:string;stage:string;year:number;nation:string};
type TournamentOutcome={stage:string;champion:boolean};
const positions: CareerPosition[] = [
  "centre_back",
  "right_back",
  "left_back",
  "holding_midfielder",
  "central_midfielder",
  "attacking_midfielder",
  "right_winger",
  "left_winger",
  "second_striker",
  "striker",
];
const copy = {
  es: {
    newCareer: "NUEVA CARRERA",
    name: "Nombre",
    number: "Dorsal",
    nationality: "Nacionalidad",
    position: "Posición",
    academy: "Club formador",
    academyOffers: "OFERTAS DE FORMACIÓN",
    currentClub: "CLUB ACTUAL",
    nationalClub: "Club nacional",
    premium_international: "Premium internacional",
    elite_international: "Élite internacional",
    elite_national: "Élite nacional",
    national: "Nacional",
    national_b: "Nacional B",
    start: "Comenzar formación",
    loading: "Preparando academias…",
    season: "TEMPORADA",
    years: "años",
    overall: "MEDIA",
    technical: "TÉCNICA",
    physical: "FÍSICO",
    mentality: "MENTALIDAD",
    formState: "ESTADO",
    reputation: "REPUTACIÓN",
    family: "FAMILIA",
    legacy: "LEGADO",
    cabinet: "VITRINA",
    training: "Plan de entrenamiento",
    objective: "Objetivo de temporada",
    simulate: "Simular temporada",
    development: "Desarrollo",
    team: "Ganar minutos",
    visibility: "Visibilidad",
    recovery: "Recuperación",
    familyFocus: "Familia",
    technicalPlan: "Pulir la técnica",
    physicalPlan: "Mejorar físicamente",
    mentalPlan: "Trabajar la mentalidad",
    balancedPlan: "Entrenamiento equilibrado",
    recoveryPlan: "Cuidar el cuerpo",
    coachReport: "INFORME DEL ENTRENADOR",
    decision: "DECISIÓN DE TEMPORADA",
    competitions: "COMPETICIONES",
    offers: "OFERTAS Y CESIONES",
    noOffers: "No hay ofertas en este momento",
    noDecisions: "No hay decisiones que tomar en este momento",
    stay: "Quedarme",
    sign: "Aceptar",
    transfer: "Traspaso",
    loan: "Cesión",
    returnHome: "Vuelta a casa",
    history: "Historial",
    achievements: "LOGROS",
    locked: "Bloqueado",
    retire: "Retirarme",
    newGame: "Nueva carrera",
    noSeasons: "Tu historia empieza en la academia.",
    saved: "Partida guardada",
    saveError: "No se pudo guardar.",
    event: "Evento",
    injury: "Lesión",
    breakthrough: "Explosión",
    mentor: "Mentor",
    competition: "Competencia",
    familyEvent: "Situación familiar",
    none: "Temporada estable",
    trophies: "Títulos",
    apps: "PJ",
    goals: "G",
    assists: "A",
    cleanSheets: "PC",
    minutes: "MIN",
    growth: "PROG",
    academyQ: "Formación",
    opportunity: "Oportunidad",
    demand: "Exigencia",
    salary: "SALARIO ANUAL",
    signingBonus: "PRIMA DE FICHAJE",
    earnings: "INGRESOS ACUMULADOS",
    contract: "CONTRATO HASTA",
    premium_europe: "Premium Europa",
    elite_europe: "Élite Europa",
    premium_south_america: "Premium Sudamérica",
    elite_south_america: "Élite Sudamérica",
    standard: "Formador",
    academyRole: "Academia",
    prospect: "Promesa",
    rotation: "Rotación",
    starter: "Titular",
    star: "Estrella",
    restart: "¿Borrar esta carrera?",
    abandon: "ABANDONAR CARRERA",
    abandonConfirm: "¿Abandonar esta carrera y volver a los juegos? La carrera activa se eliminará, pero tus puntos guardados permanecerán disponibles.",
    centre_back: "Defensa central",
    right_back: "Lateral derecho",
    left_back: "Lateral izquierdo",
    holding_midfielder: "Pivote",
    central_midfielder: "Interior",
    attacking_midfielder: "Mediapunta",
    right_winger: "Extremo derecho",
    left_winger: "Extremo izquierdo",
    second_striker: "Segundo delantero",
    striker: "Delantero centro",
  },
  en: {
    newCareer: "NEW CAREER",
    name: "Name",
    number: "Shirt number",
    nationality: "Nationality",
    position: "Position",
    academy: "Training club",
    academyOffers: "DEVELOPMENT OFFERS",
    currentClub: "CURRENT CLUB",
    nationalClub: "National club",
    premium_international: "International Premium",
    elite_international: "International Elite",
    elite_national: "National Elite",
    national: "National",
    national_b: "National B",
    start: "Start development",
    loading: "Preparing academies…",
    season: "SEASON",
    years: "years old",
    overall: "OVERALL",
    technical: "TECHNIQUE",
    physical: "PHYSICAL",
    mentality: "MENTALITY",
    formState: "FORM",
    reputation: "REPUTATION",
    family: "FAMILY",
    legacy: "LEGACY",
    cabinet: "TROPHY CABINET",
    training: "Training plan",
    objective: "Season objective",
    simulate: "Simulate season",
    development: "Development",
    team: "Earn minutes",
    visibility: "Visibility",
    recovery: "Recovery",
    familyFocus: "Family",
    technicalPlan: "Polish technique",
    physicalPlan: "Improve physically",
    mentalPlan: "Build mentality",
    balancedPlan: "Balanced training",
    recoveryPlan: "Protect the body",
    coachReport: "COACH REPORT",
    decision: "SEASON DECISION",
    competitions: "COMPETITIONS",
    offers: "OFFERS AND LOANS",
    noOffers: "There are no offers at this time",
    noDecisions: "There are no decisions to make at this time",
    stay: "Stay",
    sign: "Accept",
    transfer: "Transfer",
    loan: "Loan",
    returnHome: "Return home",
    history: "History",
    achievements: "ACHIEVEMENTS",
    locked: "Locked",
    retire: "Retire",
    newGame: "New career",
    noSeasons: "Your story starts in the academy.",
    saved: "Game saved",
    saveError: "Could not save.",
    event: "Event",
    injury: "Injury",
    breakthrough: "Breakthrough",
    mentor: "Mentor",
    competition: "Competition",
    familyEvent: "Family situation",
    none: "Steady season",
    trophies: "Trophies",
    apps: "APP",
    goals: "G",
    assists: "A",
    cleanSheets: "CS",
    minutes: "MIN",
    growth: "GROWTH",
    academyQ: "Training",
    opportunity: "Opportunity",
    demand: "Demand",
    salary: "ANNUAL SALARY",
    signingBonus: "SIGNING BONUS",
    earnings: "CAREER EARNINGS",
    contract: "CONTRACT UNTIL",
    premium_europe: "Europe Premium",
    elite_europe: "Europe Elite",
    premium_south_america: "South America Premium",
    elite_south_america: "South America Elite",
    standard: "Developer",
    academyRole: "Academy",
    prospect: "Prospect",
    rotation: "Rotation",
    starter: "Starter",
    star: "Star",
    restart: "Delete this career?",
    abandon: "ABANDON CAREER",
    abandonConfirm: "Abandon this career and return to the games? The active career will be deleted, but your saved checkpoints will remain available.",
    centre_back: "Centre-back",
    right_back: "Right-back",
    left_back: "Left-back",
    holding_midfielder: "Holding midfielder",
    central_midfielder: "Central midfielder",
    attacking_midfielder: "Attacking midfielder",
    right_winger: "Right winger",
    left_winger: "Left winger",
    second_striker: "Second striker",
    striker: "Striker",
  },
  fr: {
    newCareer: "NOUVELLE CARRIÈRE",
    name: "Nom",
    number: "Numéro",
    nationality: "Nationalité",
    position: "Poste",
    academy: "Club formateur",
    academyOffers: "OFFRES DE FORMATION",
    currentClub: "CLUB ACTUEL",
    nationalClub: "Club national",
    premium_international: "Premium international",
    elite_international: "Élite internationale",
    elite_national: "Élite nationale",
    national: "National",
    national_b: "National B",
    start: "Commencer la formation",
    loading: "Préparation des académies…",
    season: "SAISON",
    years: "ans",
    overall: "NOTE",
    technical: "TECHNIQUE",
    physical: "PHYSIQUE",
    mentality: "MENTAL",
    formState: "ÉTAT",
    reputation: "RÉPUTATION",
    family: "FAMILLE",
    legacy: "HÉRITAGE",
    cabinet: "VITRINE",
    training: "Plan d’entraînement",
    objective: "Objectif de saison",
    simulate: "Simuler la saison",
    development: "Progression",
    team: "Gagner du temps de jeu",
    visibility: "Visibilité",
    recovery: "Récupération",
    familyFocus: "Famille",
    technicalPlan: "Affiner la technique",
    physicalPlan: "Progresser physiquement",
    mentalPlan: "Travailler le mental",
    balancedPlan: "Entraînement équilibré",
    recoveryPlan: "Préserver le corps",
    coachReport: "RAPPORT DE L’ENTRAÎNEUR",
    decision: "DÉCISION DE SAISON",
    competitions: "COMPÉTITIONS",
    offers: "OFFRES ET PRÊTS",
    noOffers: "Aucune offre pour le moment",
    noDecisions: "Aucune décision à prendre pour le moment",
    stay: "Rester",
    sign: "Accepter",
    transfer: "Transfert",
    loan: "Prêt",
    returnHome: "Retour au pays",
    history: "Historique",
    achievements: "SUCCÈS",
    locked: "Verrouillé",
    retire: "Retraite",
    newGame: "Nouvelle carrière",
    noSeasons: "Votre histoire commence à l’académie.",
    saved: "Partie enregistrée",
    saveError: "Enregistrement impossible.",
    event: "Événement",
    injury: "Blessure",
    breakthrough: "Révélation",
    mentor: "Mentor",
    competition: "Concurrence",
    familyEvent: "Situation familiale",
    none: "Saison régulière",
    trophies: "Titres",
    apps: "MJ",
    goals: "B",
    assists: "PD",
    cleanSheets: "CS",
    minutes: "MIN",
    growth: "PROG",
    academyQ: "Formation",
    opportunity: "Opportunité",
    demand: "Exigence",
    salary: "SALAIRE ANNUEL",
    signingBonus: "PRIME À LA SIGNATURE",
    earnings: "REVENUS CUMULÉS",
    contract: "CONTRAT JUSQU’EN",
    premium_europe: "Premium Europe",
    elite_europe: "Élite Europe",
    premium_south_america: "Premium Amérique du Sud",
    elite_south_america: "Élite Amérique du Sud",
    standard: "Formateur",
    academyRole: "Académie",
    prospect: "Espoir",
    rotation: "Rotation",
    starter: "Titulaire",
    star: "Star",
    restart: "Supprimer cette carrière ?",
    abandon: "ABANDONNER LA CARRIÈRE",
    abandonConfirm: "Abandonner cette carrière et revenir aux jeux ? La carrière active sera supprimée, mais vos sauvegardes resteront disponibles.",
    centre_back: "Défenseur central",
    right_back: "Latéral droit",
    left_back: "Latéral gauche",
    holding_midfielder: "Milieu défensif",
    central_midfielder: "Milieu central",
    attacking_midfielder: "Milieu offensif",
    right_winger: "Ailier droit",
    left_winger: "Ailier gauche",
    second_striker: "Deuxième attaquant",
    striker: "Avant-centre",
  },
} as const;
const ach = {
  es: [
    "Debut profesional",
    "Primer impacto",
    "Centenario",
    "Campeón",
    "Internacional",
    "Leyenda",
  ],
  en: [
    "Professional debut",
    "First impact",
    "Centurion",
    "Champion",
    "International",
    "Legend",
  ],
  fr: [
    "Débuts professionnels",
    "Premier impact",
    "Centenaire",
    "Champion",
    "International",
    "Légende",
  ],
};
export default function CareerModeGame() {
  const { locale } = useI18n(),
    c = copy[locale];
  const [career, setCareer] = useState<CareerState | null>(null),
    [clubs, setClubs] = useState<CareerClub[]>(CAREER_CLUBS),
    [ready, setReady] = useState(false),
    [focus, setFocus] = useState<SeasonFocus>("development"),
    [training, setTraining] = useState<TrainingFocus>("balanced"),
    [decisionChoice,setDecisionChoice]=useState("no"),
    [celebrations,setCelebrations]=useState<Celebration[]>([]),
    [notice, setNotice] = useState(""),
    [careerSeed] = useState(()=>Date.now()&0x7fffffff);
  const [form, setForm] = useState({
    name: "",
    shirtNumber: 10,
    nationality: "España",
    position: "attacking_midfielder" as CareerPosition,
    clubId: "",
  });
  useEffect(() => {
    setCareer(loadCareer());
    loadCareerClubs()
      .then(setClubs)
      .finally(() => setReady(true));
  }, []);
  const starters = useMemo(
    () => starterClubsFor(form.nationality, clubs, careerSeed, talentBandForSeed(careerSeed)),
    [form.nationality, clubs, careerSeed],
  );
  useEffect(() => {
    if (starters.length && !starters.some((x) => x.id === form.clubId))
      setForm((x) => ({ ...x, clubId: starters[0].id }));
  }, [starters, form.clubId]);
  useEffect(()=>setDecisionChoice("no"),[career?.year]);
  function commit(next: CareerState) {
    const final = {
      ...next,
      unlockedAchievementIds: evaluateCareerAchievements(next),
    };
    setCareer(final);
    const previousSeason=career?.seasons.at(-1),newSeason=final.seasons.at(-1);
    if(newSeason&&newSeason!==previousSeason){
      const international=newSeason.competitions?.find(x=>x.kind==="international");
      const earned:Celebration[]=[
        ...(international?[{kind:"tournament" as const,name:international.name,stage:international.stage,year:newSeason.year,nation:final.player.nationality}]:[]),
        ...(newSeason.competitions?.filter(x=>x.champion&&x.kind!=="international").map(x=>({kind:"title" as const,name:x.name,scope:"collective" as const}))??[]),
        ...(newSeason.individualAwards?.map(name=>({kind:"title" as const,name,scope:"individual" as const}))??[]),
      ];
      if(earned.length)setCelebrations(x=>[...x,...earned]);
    }
    setNotice(saveCareer(final) ? c.saved : c.saveError);
  }
  function finishTournament(item:Extract<Celebration,{kind:"tournament"}>,outcome:TournamentOutcome){
    setCareer(current=>{
      if(!current)return current;
      let titleDelta=0;
      const seasons=current.seasons.map(season=>{
        if(season.year!==item.year)return season;
        const previous=season.competitions?.find(x=>x.kind==="international"&&x.name===item.name);
        if(!previous)return season;
        titleDelta=Number(outcome.champion)-Number(previous.champion);
        const competitions=season.competitions?.map(x=>x===previous?{...x,stage:outcome.stage,champion:outcome.champion}:x);
        return {...season,competitions,trophies:competitions?.filter(x=>x.champion).map(x=>x.name)??[],titles:competitions?.filter(x=>x.champion).length??0};
      });
      const updated={...current,seasons,totals:{...current.totals,titles:Math.max(0,current.totals.titles+titleDelta)}};
      const final={...updated,unlockedAchievementIds:evaluateCareerAchievements(updated)};
      saveCareer(final);
      return final;
    });
    setCelebrations(queue=>outcome.champion?[{kind:"title",name:item.name,scope:"collective"},...queue.slice(1)]:queue.slice(1));
  }
  if (!ready)
    return (
      <section className="career-panel career-loading" aria-live="polite">
        {c.loading}
      </section>
    );
  if (!career)
    return (
      <section className="career-panel career-panel--create">
        <CareerAccountPanel locale={locale} career={career} onLoad={state=>{setCareer(state);saveCareer(state)}}/>
        <div className="career-title-lockup">
          <span aria-hidden="true">★</span>
          <div><small>10theGOAT</small><h2>{c.newCareer}</h2></div>
          <span aria-hidden="true">★</span>
        </div>
        <form
          className="career-create"
          onSubmit={(e) => {
            e.preventDefault();
            const club =
              starters.find((x) => x.id === form.clubId) ?? starters[0];
            if (club)
              commit(
                createCareer({ ...form, club, seed: careerSeed }),
              );
          }}
        >
          <label>
            {c.name}
            <input
              required
              minLength={2}
              maxLength={40}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </label>
          <label>
            {c.number}
            <input
              type="number"
              required
              min={1}
              max={99}
              value={form.shirtNumber}
              onChange={(e) =>
                setForm({ ...form, shirtNumber: Number(e.target.value) })
              }
            />
          </label>
          <label>
            {c.nationality}
            <span className="career-nationality-select"><img src={NATIONALITY_FLAG_PATHS[form.nationality as keyof typeof NATIONALITY_FLAG_PATHS]} alt=""/><select
              value={form.nationality}
              onChange={(e) =>
                setForm({ ...form, nationality: e.target.value, clubId: "" })
              }
            >
              {NATIONALITIES.map((x) => (
                <option key={x} value={x}>{x}</option>
              ))}
            </select></span>
          </label>
          <label>
            {c.position}
            <select
              value={form.position}
              onChange={(e) =>
                setForm({ ...form, position: e.target.value as CareerPosition })
              }
            >
              {positions.map((x) => (
                <option key={x} value={x}>
                  {c[x]}
                </option>
              ))}
            </select>
          </label>
          <label className="career-club-choice">
            {c.academyOffers}
            <span className="career-starter-offers">{starters.map(x=><button type="button" key={x.id} className={form.clubId===x.id?"is-selected":""} onClick={()=>setForm({...form,clubId:x.id})}><ClubCrest club={x}/><b>{x.name}</b><small>{formatMoney(academySalary(x,talentBandForSeed(careerSeed),careerSeed),locale)} / {locale==="es"?"AÑO":locale==="fr"?"AN":"YEAR"}</small></button>)}</span>
          </label>
          {(() => {
            const x = starters.find((x) => x.id === form.clubId);
            return (
              x && (
                <div className="career-club-preview">
                  <ClubCrest club={x} />
                  <div className="career-club-preview-copy">
                    <strong>{x.name}</strong>
                    <span>{c[x.prestige]}</span>
                    <em>{x.country}</em>
                  </div>
                  <div className="career-profile-bars">
                    <Profile label={c.academyQ} value={x.academyQuality} />
                    <Profile label={c.opportunity} value={x.youthOpportunity} />
                    <Profile label={c.demand} value={x.squadCompetition} />
                  </div>
                </div>
              )
            );
          })()}
          <button className="career-primary" type="submit">
            {c.start} · 15 {c.years}
          </button>
        </form>
      </section>
    );
  const p = career.player,
    last = career.seasons.at(-1),dilemma=localizeDecision(decisionFor(career),locale),
    lastDefinition=last?.decision?CAREER_DECISIONS.find(x=>x.id===last.decision?.decisionId||x.title===last.decision?.title):undefined,
    localizedLast=lastDefinition?localizeDecision(lastDefinition,locale):undefined;
  return (
    <section className="career-panel career-panel--dashboard" aria-label={c.season}>
      <CareerAccountPanel locale={locale} career={career} onLoad={state=>{setCareer(state);saveCareer(state)}}/>
      <div className="career-scoreboard">
        <div className="career-player-identity">
          <div className="career-shirt" aria-hidden="true"><span>{p.shirtNumber}</span></div>
          <div>
          <small>
            {c.season} {career.year}/{String(career.year + 1).slice(-2)}
          </small>
          <h2>
            {p.name} <b>#{p.shirtNumber}</b>
          </h2>
          <span>
            {p.age} {c.years} · {c[p.position]} · <img className="career-inline-flag" src={NATIONALITY_FLAG_PATHS[p.nationality as keyof typeof NATIONALITY_FLAG_PATHS]} alt=""/> {p.nationality}
          </span>
          </div>
        </div>
        <div className="career-club">
          <ClubCrest club={career.club} />
          <div>
            <small>{c.currentClub}</small>
            <strong>{career.club.name}</strong>
            <span>{career.club.country} · {career.club.careerCategory ? c[career.club.careerCategory] : career.club.prestige === "standard" ? c.nationalClub : c[career.club.prestige]}{career.club.leagueName?` · ${career.club.leagueName}`:""}</span>
          </div>
        </div>
      </div>
      <div className="career-finances"><div><span>{c.salary}</span><strong>{formatMoney(career.currentAnnualSalary,locale)}</strong></div><div><span>{c.contract}</span><strong>{career.contractUntil}</strong></div><div><span>{c.earnings}</span><strong>{formatMoney(career.careerEarnings,locale)}</strong></div></div>
      <TrophyCabinet career={career} title={c.cabinet}/>
      <div className="career-rating-stack">
        <div className="career-rating-hero"><span>{c.overall}</span><strong>{p.overall}</strong></div>
        <div className="career-rating-bars">
          <BarMetric label={c.technical} value={p.blocks.technical} trend={last?.blockChanges?.technical} />
          <BarMetric label={c.physical} value={p.blocks.physical} trend={last?.blockChanges?.physical} />
          <BarMetric label={c.mentality} value={p.blocks.mentality} trend={last?.blockChanges?.mentality} />
          <BarMetric label={c.formState} value={p.blocks.form} trend={last?.blockChanges?.form} />
          <BarMetric label={c.reputation} value={p.reputation} />
          <BarMetric label={c.family} value={p.familyBond} />
        </div>
        <div className="career-legacy-strip"><span>{c.legacy}</span><strong>{career.legacyScore}</strong></div>
      </div>
      {career.status === "active" && <div className="career-market-grid">
        <div className="career-offers">
          <h3>{c.offers}</h3>
          {career.phase === "offers" ? <>
            <div className="career-offer-list">{career.offers.map((o) => (
              <article key={o.id}>
                <ClubCrest club={o.club} />
                <div><strong>{o.club.name}</strong><span>{o.familyReturn ? c.returnHome : o.kind === "loan" ? c.loan : c.transfer} · {c[o.role === "academy" ? "academyRole" : o.role]}</span><small>{c.salary}: {formatMoney(o.annualSalary,locale)} · {c.signingBonus}: {formatMoney(o.signingBonus,locale)} · {o.contractYears} {c.years}</small></div>
                <button onClick={() => commit(resolveOffer(career, o.id))}>{c.sign}</button>
              </article>
            ))}</div>
            <div className="career-offer-stay"><button className="career-secondary" onClick={() => commit(resolveOffer(career, null))}>{c.stay}</button></div>
          </> : <p className="career-empty-state">{c.noOffers}</p>}
        </div>
        <div className="career-decision">
          <h3>{c.decision}</h3>
          {career.phase === "season" ? <>
            <strong>{dilemma.title}</strong><p>{dilemma.description}{dilemma.id==="nationality"?` ${targetNationalityFor(career)} ${locale==="en"?"awaits your answer.":locale==="fr"?"attend votre réponse.":"espera tu respuesta."}`:""}</p>
            <div>{dilemma.choices.map(choice=>{const selected=decisionChoice===choice.id;return <button key={choice.id} aria-pressed={selected} className={`${selected?"is-selected ":""}${choiceTone(choice.effects)}`} onClick={()=>setDecisionChoice(choice.id)}><b>{choice.label}</b><ChoiceEffects effects={choice.effects} labels={c}/>{choice.riskText&&<span className="career-risk">{choice.riskText}{choice.chance!==undefined?` · ${choice.chance}% ${locale==="en"?"FAVOURABLE":locale==="fr"?"FAVORABLE":"FAVORABLE"}`:""}</span>}</button>})}</div>
          </> : <p className="career-empty-state">{c.noDecisions}</p>}
        </div>
      </div>}
      {career.phase === "season" && (
        <div className="career-action">
          <label>
            {c.training}
            <select value={training} onChange={(e) => setTraining(e.target.value as TrainingFocus)}>
              <option value="technical">{c.technicalPlan}</option>
              <option value="physical">{c.physicalPlan}</option>
              <option value="mental">{c.mentalPlan}</option>
              <option value="balanced">{c.balancedPlan}</option>
              <option value="recovery">{c.recoveryPlan}</option>
            </select>
          </label>
          <label>
            {c.objective}
            <select
              value={focus}
              onChange={(e) => setFocus(e.target.value as SeasonFocus)}
            >
              <option value="development">{c.development}</option>
              <option value="team">{c.team}</option>
              <option value="visibility">{c.visibility}</option>
              <option value="recovery">{c.recovery}</option>
              <option value="family">{c.familyFocus}</option>
            </select>
          </label>
          <button
            className="career-primary"
            onClick={() => commit(simulateSeason(career, focus, clubs, training,decisionChoice))}
          >
            {c.simulate}
          </button>
          {p.age >= 32 && (
            <button
              className="career-secondary"
              onClick={() => commit(retireCareer(career))}
            >
              {c.retire}
            </button>
          )}
        </div>
      )}
      {career.phase === "retired" && (
        <div className="career-retired">
          <span>{c.legacy}</span>
          <strong>{career.legacyScore}</strong>
          <button
            className="career-primary"
            onClick={() => {
              clearCareer();
              setCareer(null);
            }}
          >
            {c.newGame}
          </button>
        </div>
      )}
      {notice && (
        <p className="career-notice" aria-live="polite">
          {notice}
        </p>
      )}
      {last && (
        <div className="career-last">
          <h3>
            {last.year}/{String(last.year + 1).slice(-2)} · {last.club.name} ·{" "}
            {c[last.role === "academy" ? "academyRole" : last.role]}
          </h3>
          <div>
            <Stat label={c.minutes} value={last.minutes} />
            <Stat label={c.apps} value={last.appearances} />
            <Stat label={c.goals} value={last.goals} />
            <Stat label={c.assists} value={last.assists} />
            <Stat label={c.cleanSheets} value={last.cleanSheets} />
            <Stat label={c.growth} value={last.growth} />
          </div>
          <p>
            {c.event}: {c[last.event === "family" ? "familyEvent" : last.event]}{" "}
            · ⭐ {last.rating}
          </p>
          <div className="career-coach-report">
            <strong>{c.coachReport}</strong>
            <p>{seasonReport(locale, last)}</p>
          </div>
          {last.decision&&<div className={`career-season-result ${last.decision.success?"is-success":"is-risk"}`}><strong>{localizedLast?.title??last.decision.title}</strong><p>{localizedLast?.choices.find(x=>x.id===(last.decision?.choiceId??"no"))?.label??last.decision.choice} · {localizedDecisionOutcome(last.decision,locale)}{last.decision.chance!==undefined?` (${last.decision.chance}% ${locale==="en"?"favourable":locale==="fr"?"favorable":"favorable"})`:""}</p></div>}
          {!!last.competitions?.length&&<div className="career-competitions"><strong>{c.competitions}</strong>{last.competitions.map(x=><span key={x.name}>{x.name}<b>{x.stage}</b></span>)}</div>}
        </div>
      )}
      <div className="career-columns">
        <div>
          <h3>{c.history}</h3>
          {!career.seasons.length ? (
            <p>{c.noSeasons}</p>
          ) : (
            <ol className="career-history">
              {career.seasons
                .slice()
                .reverse()
                .map((s) => (
                  <li key={s.year}>
                    <span>
                      {s.year}/{String(s.year + 1).slice(-2)} · {s.club.name}
                    </span>
                    <strong>
                      {s.minutes} {c.minutes} · {s.goals} {c.goals} ·{" "}
                      {s.assists} {c.assists}
                    </strong>
                  </li>
                ))}
            </ol>
          )}
        </div>
        <div>
          <h3>{c.achievements}</h3>
          <ul className="career-achievements">
            {achievementDefinitions.map((a, i) => {
              const on = career.unlockedAchievementIds.includes(a.id);
              return (
                <li className={on ? "is-unlocked" : ""} key={a.id}>
                  <span>{on ? "◆" : "◇"}</span>
                  {ach[locale][i]}
                  {!on && <small>{c.locked}</small>}
                </li>
              );
            })}
          </ul>
        </div>
      </div>
      {career.status === "active" && <div className="career-exit-actions">
        <button className="career-reset" onClick={()=>{if(confirm(c.restart)){clearCareer();setCareer(null)}}}>{c.newGame}</button>
        <button className="career-abandon" onClick={()=>{if(confirm(c.abandonConfirm)){clearCareer();window.location.assign(`/${locale}/juegos`)}}}>{c.abandon}</button>
      </div>}
      {celebrations[0]&&<CelebrationModal item={celebrations[0]} seed={career.seed} onDone={outcome=>{const item=celebrations[0];if(item.kind==="tournament"&&outcome)finishTournament(item,outcome);else setCelebrations(x=>x.slice(1))}}/>}
    </section>
  );
}
function BarMetric({ label, value, trend }: { label: string; value: number; trend?: number }) {
  return (
    <div className="career-rating-bar">
      <span>{label}</span><strong>{value}</strong>
      <i aria-hidden="true"><b style={{ width: `${value}%` }} /></i>
      {trend !== undefined && <small className={trend > 0 ? "is-up" : trend < 0 ? "is-down" : ""}>{trend > 0 ? "↑" : trend < 0 ? "↓" : "→"}</small>}
    </div>
  );
}
const tournamentTeams:Record<string,string[]>={
  "Copa Mundial":["Argentina","Australia","Austria","Bélgica","Brasil","Canadá","Chile","Colombia","Corea del Sur","Croacia","Dinamarca","Ecuador","Egipto","España","Estados Unidos","Francia","Alemania","Inglaterra","Italia","Japón","Marruecos","México","Nigeria","Noruega","Países Bajos","Paraguay","Polonia","Portugal","Senegal","Suiza","Turquía","Uruguay"],
  Eurocopa:["Alemania","Austria","Bélgica","Croacia","Dinamarca","Escocia","Eslovaquia","Eslovenia","España","Francia","Georgia","Hungría","Inglaterra","Italia","Países Bajos","Polonia","Portugal","República Checa","Rumanía","Serbia","Suiza","Turquía","Ucrania","Gales"],
  "Copa América":["Argentina","Bolivia","Brasil","Canadá","Chile","Colombia","Costa Rica","Ecuador","Estados Unidos","Jamaica","México","Panamá","Paraguay","Perú","Uruguay","Venezuela"],
};
function trophyImage(name:string,individual=false){if(individual)return "/trophies/individual.svg";if(name.includes("Mundial"))return "/trophies/world.svg";if(name.includes("Euro")||name.includes("América")||name.includes("Champions")||name.includes("Libertadores"))return "/trophies/continental.svg";return "/trophies/club.svg"}
function TrophyCabinet({career,title}:{career:CareerState;title:string}){
  const items=new Map<string,{count:number;individual:boolean}>();
  for(const season of career.seasons){for(const competition of season.competitions?.filter(x=>x.champion)??[]){const name=competition.kind==="domestic"?domesticLeagueName(season.club):competition.name;const old=items.get(name);items.set(name,{count:(old?.count??0)+1,individual:false})}for(const award of season.individualAwards??[]){const old=items.get(award);items.set(award,{count:(old?.count??0)+1,individual:true})}}
  return <section className="career-cabinet"><h3>{title}</h3>{items.size?<div>{[...items].map(([name,item])=><article key={name}><img src={trophyImage(name,item.individual)} alt=""/><span>{name}</span><strong>×{item.count}</strong></article>)}</div>:<p>TODAVÍA NO HAY TROFEOS. LA VITRINA TE ESTÁ ESPERANDO.</p>}</section>
}
function CelebrationModal({item,seed,onDone}:{item:Celebration;seed:number;onDone:(outcome?:TournamentOutcome)=>void}){
  if(item.kind==="title")return <div className="career-modal-backdrop" role="presentation"><div className="career-title-modal" role="dialog" aria-modal="true"><small>{item.scope==="individual"?"PREMIO INDIVIDUAL":"TÍTULO CONSEGUIDO"}</small><img src={trophyImage(item.name,item.scope==="individual")} alt=""/><h2>{item.name}</h2><p>{item.scope==="individual"?"TU TEMPORADA HA SIDO RECONOCIDA. ESTE TROFEO YA ESTÁ EN TU VITRINA.":"CAMPEONES. EL TROFEO YA FORMA PARTE DE TU HISTORIA."}</p><button className="career-primary" onClick={()=>onDone()}>CONTINUAR</button></div></div>;
  return <TournamentPredictor item={item} seed={seed} onDone={onDone}/>;
}
type RevealedMatch={score:string;positive:boolean;note?:string};
function positiveTournamentCells(seed:number,year:number,name:string){
  let value=(seed^year^Array.from(name).reduce((sum,char)=>sum+char.charCodeAt(0),0))>>>0;
  const cells=Array.from({length:49},(_,index)=>index);
  for(let index=cells.length-1;index>0;index--){value=(Math.imul(value,1664525)+1013904223)>>>0;const swap=value%(index+1);[cells[index],cells[swap]]=[cells[swap],cells[index]]}
  return new Set(cells.slice(0,16));
}
function TournamentPredictor({item,seed,onDone}:{item:Extract<Celebration,{kind:"tournament"}>;seed:number;onDone:(outcome:TournamentOutcome)=>void}){
  const rounds=item.name==="Copa América"?[{label:"CUARTOS DE FINAL",stage:"Cuartos de final"},{label:"SEMIFINALES",stage:"Semifinales"},{label:"FINAL",stage:"Final"}]:[{label:"OCTAVOS DE FINAL",stage:"Octavos de final"},{label:"CUARTOS DE FINAL",stage:"Cuartos de final"},{label:"SEMIFINALES",stage:"Semifinales"},{label:"FINAL",stage:"Final"}];
  const favorable=useMemo(()=>positiveTournamentCells(seed,item.year,item.name),[seed,item.year,item.name]);
  const [phase,setPhase]=useState<"group"|"knockout">("group"),[groupMatch,setGroupMatch]=useState(0),[points,setPoints]=useState(0),[round,setRound]=useState(0),[revealed,setRevealed]=useState<Record<number,RevealedMatch>>({}),[pending,setPending]=useState<{message:string;outcome?:TournamentOutcome;next:"group"|"knockout"|"round"}|null>(null);
  const teams=tournamentTeams[item.name]??tournamentTeams["Copa Mundial"],matchNumber=phase==="group"?groupMatch:round+3;
  const rivals=teams.filter(x=>x!==item.nation),rival=rivals[Math.abs(seed+item.year*13+matchNumber*7)%Math.max(1,rivals.length)]??"Rival";
  const reveal=(cell:number)=>{
    if(pending||revealed[cell])return;
    const positive=favorable.has(cell),variant=Math.abs(seed+item.year+cell+matchNumber)%3;
    if(phase==="group"){
      const draw=!positive&&variant===0,earned=positive?3:draw?1:0;
      const score=positive?["1–0","2–0","2–1"][variant]:draw?["0–0","1–1","2–2"][variant]:["0–1","0–2","1–2"][variant];
      const total=points+earned,last=groupMatch===2;
      setRevealed(old=>({...old,[cell]:{score,positive}}));setPoints(total);
      setPending({message:last?(total>=4?`CLASIFICADOS CON ${total} PUNTOS`:`ELIMINADOS CON ${total} PUNTOS`):(positive?"VICTORIA · +3 PUNTOS":draw?"EMPATE · +1 PUNTO":"DERROTA · 0 PUNTOS"),outcome:last&&total<4?{stage:"Fase de grupos",champion:false}:undefined,next:last?"knockout":"group"});
      return;
    }
    const penalties=variant===0,score=penalties?(variant%2?"0–0":"1–1"):positive?["2–1","1–0","3–1"][variant]:["1–2","0–1","1–3"][variant],note=penalties?(positive?"VICTORIA EN PENALTIS":"DERROTA EN PENALTIS"):undefined;
    const isFinal=round===rounds.length-1,outcome=!positive?{stage:rounds[round].stage,champion:false}:isFinal?{stage:"Campeón",champion:true}:undefined;
    setRevealed(old=>({...old,[cell]:{score,positive,note}}));
    setPending({message:!positive?`${item.nation} QUEDA ELIMINADA`:isFinal?`${item.nation} ES CAMPEONA`:"¡AVANZAMOS DE RONDA!",outcome,next:"round"});
  };
  const advance=()=>{if(!pending)return;if(pending.outcome){onDone(pending.outcome);return}if(pending.next==="group")setGroupMatch(x=>x+1);else if(pending.next==="knockout"){setPhase("knockout");setRound(0)}else setRound(x=>x+1);setPending(null)};
  const phaseLabel=phase==="group"?`FASE DE GRUPOS · PARTIDO ${groupMatch+1}/3 · ${points} PUNTOS`:rounds[round].label;
  return <div className="career-modal-backdrop"><div className="career-tournament-modal" role="dialog" aria-modal="true"><header><img src={trophyImage(item.name)} alt=""/><div><small>{item.year} · {phaseLabel}</small><h2>{item.name}</h2><p>{item.nation} <b>VS</b> {rival}</p></div></header><p className="career-predict-help">DESTAPA UNA CASILLA PARA CONOCER EL RESULTADO. 16 DE LAS 49 SON FAVORABLES.</p><div className="career-score-grid">{Array.from({length:49},(_,cell)=>{const result=revealed[cell];return <button key={cell} disabled={!!pending||!!result} className={result?`is-revealed ${result.positive?"is-positive":"is-negative"}`:""} onClick={()=>reveal(cell)} aria-label={result?`Resultado ${result.score}`:`Destapar casilla ${cell+1}`}>{result?.score??"?"}{result?.note&&<small>{result.note}</small>}</button>})}</div>{pending&&<div className={`career-match-result ${pending.outcome&&!pending.outcome.champion?"is-out":"is-through"}`}><strong>{revealed[Number(Object.keys(revealed).at(-1))]?.score}</strong>{revealed[Number(Object.keys(revealed).at(-1))]?.note&&<span>{revealed[Number(Object.keys(revealed).at(-1))]?.note}</span>}<p>{pending.message}</p><button className="career-primary" onClick={advance}>{pending.outcome?"CERRAR":"SIGUIENTE PARTIDO"}</button></div>}</div></div>
}
const effectKeys=["technical","physical","mentality","form","reputation","family"] as const;
function formatMoney(value:number,locale:"es"|"en"|"fr"){
  return new Intl.NumberFormat(locale,{style:"currency",currency:"EUR",maximumFractionDigits:0,notation:value>=1_000_000?"compact":"standard"}).format(value);
}
function choiceTone(effects:DecisionEffects){const values=Object.values(effects);return values.some(x=>x<0)?values.some(x=>x>0)?"is-mixed":"is-negative":values.some(x=>x>0)?"is-positive":"is-neutral"}
function ChoiceEffects({effects,labels}:{effects:DecisionEffects;labels:{technical:string;physical:string;mentality:string;formState:string;reputation:string;family:string}}){
  const names={technical:labels.technical,physical:labels.physical,mentality:labels.mentality,form:labels.formState,reputation:labels.reputation,family:labels.family};
  return <span className="career-effect-list">{effectKeys.flatMap(key=>{const value=effects[key];return value?[<em key={key} className={value>0?"is-up":"is-down"}>{value>0?"↑":"↓"} {names[key]}</em>]:[]})}</span>
}
function localizedDecisionOutcome(result:DecisionResult,locale:"es"|"en"|"fr"){
  if(result.nationalityChange)return locale==="en"?`You now represent ${result.nationalityChange.to}`:locale==="fr"?`Vous représentez désormais ${result.nationalityChange.to}`:`Ahora representas a ${result.nationalityChange.to}`;
  if(result.chance===undefined)return {es:"Decisión aplicada",en:"Decision applied",fr:"Décision appliquée"}[locale];
  return result.success?{es:"El riesgo salió a tu favor",en:"The risk paid off",fr:"Le risque a tourné en votre faveur"}[locale]:{es:"Las consecuencias negativas se hicieron realidad",en:"The negative consequences materialised",fr:"Les conséquences négatives se sont réalisées"}[locale];
}
function seasonReport(locale: "es" | "en" | "fr", season: NonNullable<CareerState["seasons"]>[number]) {
  const changes = season.blockChanges;
  const strongest:[string,number] = changes ? (Object.entries(changes).sort((a, b) => b[1] - a[1])[0] ?? ["technical",0]) : ["technical",0];
  const progress = {
    es: { technical: "Ha dado pasos adelante con balón.", physical: "Su evolución física ha sido lo más destacado.", mentality: "Está interpretando mejor el juego.", form: "Su estado competitivo ha mejorado." },
    en: { technical: "He has taken steps forward on the ball.", physical: "His physical development stood out most.", mentality: "He is reading the game better.", form: "His competitive form has improved." },
    fr: { technical: "Il a progressé avec le ballon.", physical: "Son évolution physique a été remarquable.", mentality: "Il lit mieux le jeu.", form: "Son état compétitif s’est amélioré." },
  } as const;
  const regression={es:"No ha progresado esta temporada y necesita recuperar continuidad.",en:"He has not progressed this season and needs continuity.",fr:"Il n’a pas progressé cette saison et doit retrouver de la continuité."} as const;
  const legacy = { es: "El cuerpo técnico todavía está reuniendo datos para evaluarlo.", en: "The coaching staff is still gathering data to assess him.", fr: "Le staff recueille encore des données pour l’évaluer." } as const;
  const context = season.injuredGames > 8
    ? { es: "Las lesiones limitaron su continuidad.", en: "Injuries limited his continuity.", fr: "Les blessures ont limité sa continuité." }[locale]
    : season.minutes < 700
      ? { es: "La falta de minutos frenó su progresión.", en: "Limited minutes slowed his progress.", fr: "Le manque de minutes a freiné sa progression." }[locale]
      : season.selected
        ? { es: "La selección aceleró su madurez y exposición.", en: "International football accelerated his maturity and exposure.", fr: "La sélection a accéléré sa maturité et son exposition." }[locale]
        : season.titles > 0
          ? { es: "El éxito colectivo reforzó su confianza.", en: "Team success strengthened his confidence.", fr: "Le succès collectif a renforcé sa confiance." }[locale]
          : { es: "Los minutos disputados consolidaron su desarrollo.", en: "Playing time consolidated his development.", fr: "Le temps de jeu a consolidé son développement." }[locale];
  const lowest=season.blocks?Object.entries(season.blocks).sort((a,b)=>a[1]-b[1])[0]:undefined;
  const weaknessNames={es:{technical:"la técnica",physical:"el físico",mentality:"la mentalidad",form:"el estado de forma"},en:{technical:"technique",physical:"physical condition",mentality:"mentality",form:"form"},fr:{technical:"la technique",physical:"le physique",mentality:"le mental",form:"la forme"}} as const;
  const weakness=lowest&&lowest[1]<70&&(season.year+season.age)%3===0?{
    es:`Tiene ${weaknessNames.es[lowest[0] as keyof typeof weaknessNames.es]} en ${lowest[1]}, un valor bajo; quizá deba cuidarlo más.`,
    en:`His ${weaknessNames.en[lowest[0] as keyof typeof weaknessNames.en]} is low at ${lowest[1]}; he should pay it more attention.`,
    fr:`${weaknessNames.fr[lowest[0] as keyof typeof weaknessNames.fr]} est faible (${lowest[1]}) ; il devrait davantage la travailler.`,
  }[locale]:"";
  const opening=changes?(strongest[1]>0?progress[locale][strongest[0] as keyof typeof progress.es]:regression[locale]):legacy[locale];
  return `${opening} ${context}${weakness?` ${weakness}`:""}`;
}
function Stat({ label, value }: { label: string; value: number }) {
  return (
    <span>
      <strong>{value}</strong>
      <small>{label}</small>
    </span>
  );
}
function Profile({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <small>{label}</small>
      <meter min="0" max="100" value={value} />
      <b>{value}</b>
    </div>
  );
}
function ClubCrest({ club }: { club: CareerClub }) {
  const [failed, setFailed] = useState(false);
  const initials = club.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
  return club.badgeUrl && !failed ? (
    <span className="career-crest career-crest--image">
      <img src={club.badgeUrl} alt={club.name} onError={() => setFailed(true)} />
    </span>
  ) : (
    <span className="career-crest career-crest--fallback" aria-label={club.name}>
      <b>{initials}</b>
    </span>
  );
}
