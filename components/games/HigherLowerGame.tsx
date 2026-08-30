"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { addGamePoints, getGameScore, recordGameResult } from "../../lib/game-scores";

type Player = {
  id: number;
  display_name: string;
  photo_url: string | null;
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

export default function HigherLowerGame() {
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
        setError("Falta la configuración pública de Supabase en .env.local.");
        setLoading(false);
        return;
      }

      const [playersResult, clubsResult, statsResult] = await Promise.all([
        supabase.from("players").select("id,display_name,photo_url"),
        supabase.from("clubs").select("id,name,badge_url,is_national_team"),
        supabase
          .from("player_season_stats")
          .select("player_id,club_id,season_start_year,appearances,goals")
          .gt("appearances", 0),
      ]);

      const firstError = playersResult.error || clubsResult.error || statsResult.error;
      if (firstError) {
        setError(firstError.message);
        setLoading(false);
        return;
      }

      const players = (playersResult.data ?? []) as Player[];
      const clubs = (clubsResult.data ?? []) as Club[];
      const stats = (statsResult.data ?? []) as StatRow[];
      const playerMap = new Map(players.map((player) => [player.id, player]));
      const clubMap = new Map(clubs.map((club) => [club.id, club]));
      const activeSeason = currentSeasonStartYear();

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
        setError("Todavía no hay suficientes temporadas de clubes finalizadas para jugar.");
        setLoading(false);
        return;
      }

      setCards(ready);
      startWithCards(ready);
      setLoading(false);
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
    return <div className="hl-status">Cargando datos reales de 10 The GOAT…</div>;
  }

  if (error || !left || !right) {
    return (
      <div className="hl-status hl-error">
        <strong>No se puede iniciar la partida.</strong>
        <span>{error ?? "No hay suficientes datos."}</span>
      </div>
    );
  }

  return (
    <section className="hl-game" aria-label="Mayor o Menor">
      <div className="hl-topbar">
        <div><span>Racha</span><strong>{streak}</strong></div>
        <div><span>Récord</span><strong>{best}</strong></div>
        <div><span>Puntos</span><strong>{totalPoints}</strong></div>
      </div>

      <div className="hl-question">
        ¿El jugador de la derecha marcó <strong>más</strong> o <strong>menos</strong> goles esa temporada?
      </div>

      <div className="hl-board">
        <PlayerCard card={left} showGoals />

        <div className="hl-versus" aria-hidden="true">VS</div>

        <PlayerCard card={right} showGoals={revealed} />
      </div>

      {!revealed ? (
        <div className="hl-actions">
          <button className="hl-button hl-higher" onClick={() => guess("higher")}>↑ Más goles</button>
          <button className="hl-button hl-lower" onClick={() => guess("lower")}>↓ Menos goles</button>
        </div>
      ) : gameOver ? (
        <div className="hl-game-over" role="status">
          <div className="hl-game-over-copy">
            <span className="hl-game-over-kicker">Fin de la partida</span>
            <strong>Racha: {streak}</strong>
            <span>{right.playerName} marcó {right.goals} goles en {formatSeason(right.season)}.</span>
            <small>Récord personal: {best}</small>
          </div>
          <button className="hl-button hl-restart" onClick={restart}>Jugar de nuevo ↻</button>
        </div>
      ) : (
        <div className="hl-result is-correct">
          <div>
            <strong>¡Correcto!</strong>
            <span>{right.playerName} marcó {right.goals} goles en {formatSeason(right.season)}.</span>
            {lastAward > 0 ? <small>Nuevo récord · +{lastAward} puntos</small> : <small>Supera tu récord para sumar puntos.</small>}
          </div>
          <button className="hl-button" onClick={nextRound}>Siguiente →</button>
        </div>
      )}

      <p className="hl-note">
        Se suman los goles de todas las competiciones de club de temporadas ya finalizadas. Las selecciones no cuentan en este modo.
      </p>
    </section>
  );
}

function PlayerCard({ card, showGoals }: { card: SeasonCard; showGoals: boolean }) {
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
        <div className="hl-season">Temporada {formatSeason(card.season)}</div>
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
          <span>goles</span>
        </div>
        <div className="hl-appearances">{card.appearances} apariciones registradas</div>
      </div>
    </article>
  );
}
