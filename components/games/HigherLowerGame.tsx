"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { addGamePoints, getGameScore, recordGameResult } from "../../lib/game-scores";
import { useI18n } from "../I18nProvider";

type Player = {
  id: number;
  display_name: string;
  photo_url: string | null;
  primary_position: string | null;
};

type Club = {
  id: number;
  name: string;
  badge_url: string | null;
  is_national_team: boolean;
};

type StatRow = {
  player_id: number;
  club_id: number;
  season_start_year: number;
  appearances: number | null;
  goals: number | null;
};

type SeasonCard = {
  key: string;
  playerId: number;
  playerName: string;
  photoUrl: string | null;
  season: number;
  appearances: number;
  goals: number;
  clubNames: string[];
  clubBadges: string[];
};

type Guess = "higher" | "lower";

const BEST_STREAK_KEY = "10tg-higher-lower-best";
const GAME_KEY = "mayor-o-menor";
const MIN_STAT_SEASONS = 15;
const SUPABASE_PAGE_SIZE = 1000;
const ALWAYS_ELIGIBLE_PLAYER_IDS = new Set([
  6,   // Kylian Mbappé
  60,  // Raphinha
  5,   // Erling Haaland
  251, // Kai Havertz
]);

function randomItem<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function formatSeason(year: number) {
  return `${year}/${String((year + 1) % 100).padStart(2, "0")}`;
}

function currentSeasonStartYear() {
  const now = new Date();
  // Para nuestro dataset de clubes tratamos julio-junio como temporada futbolística.
  // Así, en agosto de 2026 la temporada 2026/27 queda fuera del juego.
  return now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
}

function isAttacker(position: string | null) {
  const normalized = (position ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

  return normalized === "attacker";
}

export default function HigherLowerGame() {
  const { locale } = useI18n();
  const c = locale === "en" ? { config: "Public Supabase configuration is missing from .env.local.", few: "There are not enough completed club seasons to play yet.", loadError: "Error loading Supabase data.", loading: "Loading real 10theGOAT data…", cannot: "The game cannot start.", noData: "Not enough data.", label: "Higher or Lower", streak: "Streak", best: "Record", points: "Points", question: <>Did the player on the right score <strong>more</strong> or <strong>fewer</strong> goals that season?</>, higher: "↑ More goals", lower: "↓ Fewer goals", over: "Game over", scored: "scored", goalsIn: "goals in", personal: "Personal record", restart: "Play again ↻", correct: "Correct!", newRecord: "New record", beat: "Beat your record to earn points.", next: "Next →", note: "Goals from all club competitions in completed seasons are added together. National teams do not count in this mode.", season: "Season", goals: "goals", apps: "recorded appearances" } : locale === "fr" ? { config: "La configuration publique de Supabase manque dans .env.local.", few: "Il n'y a pas encore assez de saisons de clubs terminées pour jouer.", loadError: "Erreur lors du chargement des données Supabase.", loading: "Chargement des données réelles de 10theGOAT…", cannot: "Impossible de démarrer la partie.", noData: "Données insuffisantes.", label: "Plus ou Moins", streak: "Série", best: "Record", points: "Points", question: <>Le joueur de droite a-t-il marqué <strong>plus</strong> ou <strong>moins</strong> de buts cette saison-là ?</>, higher: "↑ Plus de buts", lower: "↓ Moins de buts", over: "Fin de la partie", scored: "a marqué", goalsIn: "buts en", personal: "Record personnel", restart: "Rejouer ↻", correct: "Correct !", newRecord: "Nouveau record", beat: "Battez votre record pour gagner des points.", next: "Suivant →", note: "Les buts de toutes les compétitions de clubs des saisons terminées sont additionnés. Les sélections ne comptent pas dans ce mode.", season: "Saison", goals: "buts", apps: "apparitions enregistrées" } : { config: "Falta la configuración pública de Supabase en .env.local.", few: "Todavía no hay suficientes temporadas de clubes finalizadas para jugar.", loadError: "Error cargando los datos de Supabase.", loading: "Cargando datos reales de 10theGOAT…", cannot: "No se puede iniciar la partida.", noData: "No hay suficientes datos.", label: "Mayor o Menor", streak: "Racha", best: "Récord", points: "Puntos", question: <>¿El jugador de la derecha marcó <strong>más</strong> o <strong>menos</strong> goles esa temporada?</>, higher: "↑ Más goles", lower: "↓ Menos goles", over: "Fin de la partida", scored: "marcó", goalsIn: "goles en", personal: "Récord personal", restart: "Jugar de nuevo ↻", correct: "¡Correcto!", newRecord: "Nuevo récord", beat: "Supera tu récord para sumar puntos.", next: "Siguiente →", note: "Se suman los goles de todas las competiciones de club de temporadas ya finalizadas. Las selecciones no cuentan en este modo.", season: "Temporada", goals: "goles", apps: "apariciones registradas" };
  const [cards, setCards] = useState<SeasonCard[]>([]);
  const [left, setLeft] = useState<SeasonCard | null>(null);
  const [right, setRight] = useState<SeasonCard | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [lastCorrect, setLastCorrect] = useState<boolean | null>(null);
  const [gameOver, setGameOver] = useState(false);
  const [streak, setStreak] = useState(0);
  const [best, setBest] = useState(0);
  const [totalPoints, setTotalPoints] = useState(0);
  const [lastAward, setLastAward] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const saved = Number(window.localStorage.getItem(BEST_STREAK_KEY) ?? 0);
    if (Number.isFinite(saved)) setBest(saved);
    setTotalPoints(getGameScore(GAME_KEY).points);
  }, []);

  useEffect(() => {
    async function load() {
      if (!supabase) {
        setError(c.config);
        setLoading(false);
        return;
      }

      const client = supabase;

      async function fetchAllPlayers(): Promise<Player[]> {
        const rows: Player[] = [];

        for (let from = 0; ; from += SUPABASE_PAGE_SIZE) {
          const { data, error } = await client
            .from("players")
            .select("id,display_name,photo_url,primary_position")
            .order("id", { ascending: true })
            .range(from, from + SUPABASE_PAGE_SIZE - 1);

          if (error) throw error;
          const page = (data ?? []) as Player[];
          rows.push(...page);
          if (page.length < SUPABASE_PAGE_SIZE) break;
        }

        return rows;
      }

      async function fetchAllClubs(): Promise<Club[]> {
        const rows: Club[] = [];

        for (let from = 0; ; from += SUPABASE_PAGE_SIZE) {
          const { data, error } = await client
            .from("clubs")
            .select("id,name,badge_url,is_national_team")
            .order("id", { ascending: true })
            .range(from, from + SUPABASE_PAGE_SIZE - 1);

          if (error) throw error;
          const page = (data ?? []) as Club[];
          rows.push(...page);
          if (page.length < SUPABASE_PAGE_SIZE) break;
        }

        return rows;
      }

      async function fetchAllStats(): Promise<StatRow[]> {
        const rows: StatRow[] = [];

        for (let from = 0; ; from += SUPABASE_PAGE_SIZE) {
          const { data, error } = await client
            .from("player_season_stats")
            .select("id,player_id,club_id,season_start_year,appearances,goals")
            .gt("appearances", 0)
            .order("id", { ascending: true })
            .range(from, from + SUPABASE_PAGE_SIZE - 1);

          if (error) throw error;
          const page = (data ?? []) as StatRow[];
          rows.push(...page);
          if (page.length < SUPABASE_PAGE_SIZE) break;
        }

        return rows;
      }

      try {
        const [players, clubs, stats] = await Promise.all([
          fetchAllPlayers(),
          fetchAllClubs(),
          fetchAllStats(),
        ]);

        const clubMap = new Map(clubs.map((club) => [club.id, club]));
        const activeSeason = currentSeasonStartYear();

        // Contamos temporadas distintas con estadísticas de club utilizables.
        // Una temporada puede tener varias filas por club/competición, pero cuenta una sola vez.
        const statSeasonsByPlayer = new Map<number, Set<number>>();
        for (const stat of stats) {
          const club = clubMap.get(stat.club_id);
          if (!club || club.is_national_team || stat.season_start_year >= activeSeason) continue;

          const seasons = statSeasonsByPlayer.get(stat.player_id) ?? new Set<number>();
          seasons.add(stat.season_start_year);
          statSeasonsByPlayer.set(stat.player_id, seasons);
        }

        // Pool de Mayor o Menor:
        // - solo delanteros (Attacker)
        // - 15 o más temporadas distintas con estadísticas
        // - excepciones editoriales: Mbappé, Raphinha, Haaland y Havertz
        // Las excepciones también necesitan al menos una temporada con estadísticas para generar cartas.
        const eligiblePlayers = players.filter((player) => {
          if (!isAttacker(player.primary_position)) return false;
          const seasonCount = statSeasonsByPlayer.get(player.id)?.size ?? 0;
          return seasonCount >= MIN_STAT_SEASONS ||
            (ALWAYS_ELIGIBLE_PLAYER_IDS.has(player.id) && seasonCount > 0);
        });

        const playerMap = new Map(eligiblePlayers.map((player) => [player.id, player]));

        const grouped = new Map<string, SeasonCard>();

        for (const stat of stats) {
          const club = clubMap.get(stat.club_id);
          const player = playerMap.get(stat.player_id);
          if (!club || !player || club.is_national_team) continue;
          if (stat.season_start_year >= activeSeason) continue;

          const key = `${stat.player_id}:${stat.season_start_year}`;
          const current = grouped.get(key) ?? {
            key,
            playerId: player.id,
            playerName: player.display_name,
            photoUrl: player.photo_url,
            season: stat.season_start_year,
            appearances: 0,
            goals: 0,
            clubNames: [],
            clubBadges: [],
          };

          current.appearances += stat.appearances ?? 0;
          current.goals += stat.goals ?? 0;
          if (!current.clubNames.includes(club.name)) current.clubNames.push(club.name);
          if (club.badge_url && !current.clubBadges.includes(club.badge_url)) current.clubBadges.push(club.badge_url);
          grouped.set(key, current);
        }

        const ready = [...grouped.values()]
          .filter((card) => card.appearances > 0)
          .sort((a, b) => b.season - a.season || b.goals - a.goals);

        if (ready.length < 2) {
          setError(c.few);
          setLoading(false);
          return;
        }

        setCards(ready);
        startWithCards(ready);
        setLoading(false);
      } catch (loadError) {
        const message = loadError instanceof Error ? loadError.message : c.loadError;
        setError(message);
        setLoading(false);
      }
    }

    load();
  }, []);

  const availableOpponents = useMemo(() => {
    if (!left) return [];
    return cards.filter((card) => card.playerId !== left.playerId && card.goals !== left.goals);
  }, [cards, left]);

  function startWithCards(source: SeasonCard[]) {
    const first = randomItem(source);
    const candidates = source.filter((card) => card.playerId !== first.playerId && card.goals !== first.goals);
    const second = candidates.length ? randomItem(candidates) : randomItem(source.filter((card) => card.key !== first.key));
    setLeft(first);
    setRight(second);
    setRevealed(false);
    setLastCorrect(null);
    setGameOver(false);
  }

  function guess(choice: Guess) {
    if (!left || !right || revealed || gameOver) return;
    const correct = choice === "higher" ? right.goals > left.goals : right.goals < left.goals;
    setRevealed(true);
    setLastCorrect(correct);

    if (correct) {
      const nextStreak = streak + 1;
      setStreak(nextStreak);
      setLastAward(0);
      if (nextStreak > best) {
        const award = nextStreak * 10;
        const score = addGamePoints(GAME_KEY, award);
        setTotalPoints(score.points);
        setLastAward(award);
        setBest(nextStreak);
        window.localStorage.setItem(BEST_STREAK_KEY, String(nextStreak));
      }
    } else {
      const score = recordGameResult(GAME_KEY, { score: 0, won: false });
      setTotalPoints(score.points);
      setLastAward(0);
      setGameOver(true);
    }
  }

  function nextRound() {
    if (!right || gameOver) return;
    const nextLeft = right;
    let candidates = cards.filter(
      (card) => card.playerId !== nextLeft.playerId && card.goals !== nextLeft.goals && card.key !== nextLeft.key,
    );
    if (!candidates.length) candidates = availableOpponents;
    if (!candidates.length) return;

    setLeft(nextLeft);
    setRight(randomItem(candidates));
    setRevealed(false);
    setLastCorrect(null);
  }

  function restart() {
    if (cards.length < 2) return;
    setStreak(0);
    setLastAward(0);
    startWithCards(cards);
  }

  if (loading) {
    return <div className="hl-status">{c.loading}</div>;
  }

  if (error || !left || !right) {
    return (
      <div className="hl-status hl-error">
        <strong>{c.cannot}</strong><span>{error ?? c.noData}</span>
      </div>
    );
  }

  return (
    <section className="hl-game" aria-label={c.label}>
      <div className="hl-topbar">
        <div><span>{c.streak}</span><strong>{streak}</strong></div><div><span>{c.best}</span><strong>{best}</strong></div><div><span>{c.points}</span><strong>{totalPoints}</strong></div>
      </div>

      <div className="hl-question">
        {c.question}
      </div>

      <div className="hl-board">
        <PlayerCard card={left} showGoals copy={c} />

        <div className="hl-versus" aria-hidden="true">VS</div>

        <PlayerCard card={right} showGoals={revealed} copy={c} />
      </div>

      {!revealed ? (
        <div className="hl-actions">
          <button className="hl-button hl-higher" onClick={() => guess("higher")}>{c.higher}</button><button className="hl-button hl-lower" onClick={() => guess("lower")}>{c.lower}</button>
        </div>
      ) : gameOver ? (
        <div className="hl-game-over" role="status">
          <div className="hl-game-over-copy">
            <span className="hl-game-over-kicker">{c.over}</span><strong>{c.streak}: {streak}</strong><span>{right.playerName} {c.scored} {right.goals} {c.goalsIn} {formatSeason(right.season)}.</span><small>{c.personal}: {best}</small>
          </div>
          <button className="hl-button hl-restart" onClick={restart}>{c.restart}</button>
        </div>
      ) : (
        <div className="hl-result is-correct">
          <div>
            <strong>{c.correct}</strong><span>{right.playerName} {c.scored} {right.goals} {c.goalsIn} {formatSeason(right.season)}.</span>{lastAward > 0 ? <small>{c.newRecord} · +{lastAward} {c.points.toLowerCase()}</small> : <small>{c.beat}</small>}
          </div>
          <button className="hl-button" onClick={nextRound}>{c.next}</button>
        </div>
      )}

      <p className="hl-note">
        {c.note}
      </p>
    </section>
  );
}

function PlayerCard({ card, showGoals, copy }: { card: SeasonCard; showGoals: boolean; copy: { season: string; goals: string; apps: string } }) {
  return (
    <article className="hl-player-card">
      <div className="hl-photo-wrap">
        {card.photoUrl ? (
          <img className="hl-photo" src={card.photoUrl} alt={card.playerName} />
        ) : (
          <div className="hl-photo-fallback">⚽</div>
        )}
      </div>

      <div className="hl-player-content">
        <div className="hl-season">{copy.season} {formatSeason(card.season)}</div>
        <h2>{card.playerName}</h2>
        <div className="hl-clubs">
          <div className="hl-badges">
            {card.clubBadges.slice(0, 2).map((badge) => (
              <img key={badge} src={badge} alt="" />
            ))}
          </div>
          <span>{card.clubNames.join(" · ")}</span>
        </div>
        <div className={`hl-goals ${showGoals ? "is-visible" : "is-hidden"}`}>
          <strong>{showGoals ? card.goals : "?"}</strong>
          <span>{copy.goals}</span>
        </div>
        <div className="hl-appearances">{card.appearances} {copy.apps}</div>
      </div>
    </article>
  );
}
