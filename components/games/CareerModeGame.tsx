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
  loadCareerClubs,
  starterClubsFor,
} from "../../lib/career/clubs";
import {
  createCareer,
  resolveOffer,
  retireCareer,
  simulateSeason,
} from "../../lib/career/engine";
import { clearCareer, loadCareer, saveCareer } from "../../lib/career/storage";
import type {
  CareerClub,
  CareerPosition,
  CareerState,
  SeasonFocus,
  TrainingFocus,
} from "../../lib/career/types";
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
    currentClub: "CLUB ACTUAL",
    nationalClub: "Club nacional",
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
    offers: "OFERTAS Y CESIONES",
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
    currentClub: "CURRENT CLUB",
    nationalClub: "National club",
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
    offers: "OFFERS AND LOANS",
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
    currentClub: "CLUB ACTUEL",
    nationalClub: "Club national",
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
    offers: "OFFRES ET PRÊTS",
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
    [notice, setNotice] = useState("");
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
    () => starterClubsFor(form.nationality, clubs),
    [form.nationality, clubs],
  );
  useEffect(() => {
    if (starters.length && !starters.some((x) => x.id === form.clubId))
      setForm((x) => ({ ...x, clubId: starters[0].id }));
  }, [starters, form.clubId]);
  function commit(next: CareerState) {
    const final = {
      ...next,
      unlockedAchievementIds: evaluateCareerAchievements(next),
    };
    setCareer(final);
    setNotice(saveCareer(final) ? c.saved : c.saveError);
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
                createCareer({ ...form, club, seed: Date.now() & 0x7fffffff }),
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
            <select
              value={form.nationality}
              onChange={(e) =>
                setForm({ ...form, nationality: e.target.value, clubId: "" })
              }
            >
              {NATIONALITIES.map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
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
            {c.academy}
            <select
              value={form.clubId}
              onChange={(e) => setForm({ ...form, clubId: e.target.value })}
            >
              {starters.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
            </select>
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
    last = career.seasons.at(-1);
  return (
    <section className="career-panel career-panel--dashboard" aria-label={c.season}>
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
            {p.age} {c.years} · {c[p.position]} · {p.nationality}
          </span>
          </div>
        </div>
        <div className="career-club">
          <ClubCrest club={career.club} />
          <div>
            <small>{c.currentClub}</small>
            <strong>{career.club.name}</strong>
            <span>{career.club.country} · {career.club.prestige === "standard" ? c.nationalClub : c[career.club.prestige]}</span>
          </div>
        </div>
      </div>
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
            onClick={() => commit(simulateSeason(career, focus, clubs, training))}
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
      {career.phase === "offers" && (
        <div className="career-offers">
          <h3>{c.offers}</h3>
          {career.offers.map((o) => (
            <article key={o.id}>
              <ClubCrest club={o.club} />
              <div>
                <strong>{o.club.name}</strong>
                <span>
                  {o.familyReturn
                    ? c.returnHome
                    : o.kind === "loan"
                      ? c.loan
                      : c.transfer}{" "}
                  · {c[o.role === "academy" ? "academyRole" : o.role]}
                </span>
              </div>
              <button onClick={() => commit(resolveOffer(career, o.id))}>
                {c.sign}
              </button>
            </article>
          ))}
          <button
            className="career-secondary"
            onClick={() => commit(resolveOffer(career, null))}
          >
            {c.stay}
          </button>
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
      {career.status === "active" && (
        <button
          className="career-reset"
          onClick={() => {
            if (confirm(c.restart)) {
              clearCareer();
              setCareer(null);
            }
          }}
        >
          {c.newGame}
        </button>
      )}
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
function seasonReport(locale: "es" | "en" | "fr", season: NonNullable<CareerState["seasons"]>[number]) {
  const changes = season.blockChanges;
  const strongest = changes ? (Object.entries(changes).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "technical") : "technical";
  const blocks = {
    es: { technical: "Ha dado pasos adelante con balón.", physical: "Su evolución física ha sido lo más destacado.", mentality: "Está interpretando mejor el juego.", form: "Su estado competitivo ha mejorado." },
    en: { technical: "He has taken steps forward on the ball.", physical: "His physical development stood out most.", mentality: "He is reading the game better.", form: "His competitive form has improved." },
    fr: { technical: "Il a progressé avec le ballon.", physical: "Son évolution physique a été remarquable.", mentality: "Il lit mieux le jeu.", form: "Son état compétitif s’est amélioré." },
  } as const;
  const legacy = { es: "El cuerpo técnico ha incorporado esta temporada al nuevo modelo de evaluación.", en: "The coaching staff has incorporated this season into the new evaluation model.", fr: "Le staff a intégré cette saison au nouveau modèle d’évaluation." } as const;
  const context = season.injuredGames > 8
    ? { es: "Las lesiones limitaron su continuidad.", en: "Injuries limited his continuity.", fr: "Les blessures ont limité sa continuité." }[locale]
    : season.minutes < 700
      ? { es: "La falta de minutos frenó su progresión.", en: "Limited minutes slowed his progress.", fr: "Le manque de minutes a freiné sa progression." }[locale]
      : season.selected
        ? { es: "La selección aceleró su madurez y exposición.", en: "International football accelerated his maturity and exposure.", fr: "La sélection a accéléré sa maturité et son exposition." }[locale]
        : season.titles > 0
          ? { es: "El éxito colectivo reforzó su confianza.", en: "Team success strengthened his confidence.", fr: "Le succès collectif a renforcé sa confiance." }[locale]
          : { es: "Los minutos disputados consolidaron su desarrollo.", en: "Playing time consolidated his development.", fr: "Le temps de jeu a consolidé son développement." }[locale];
  return `${changes ? blocks[locale][strongest as keyof typeof blocks.es] : legacy[locale]} ${context}`;
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
