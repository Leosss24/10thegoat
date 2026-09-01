"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { supabase } from "../../lib/supabase";
import { getGameScore, recordGameResult, type GameScoreStats } from "../../lib/game-scores";
import { useI18n } from "../I18nProvider";

type Difficulty = "easy" | "hard" | "impossible";

type PlayerRow = {
  id: number;
  display_name: string;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  game_name: string | null;
  photo_url: string | null;
  is_active: boolean;
  is_retired: boolean;
  is_legend: boolean;
};

type ClubRow = {
  id: number;
  name: string;
  badge_url: string | null;
  is_national_team: boolean;
  is_easy_player_pool: boolean;
  is_hard_player_pool: boolean;
};

type CareerRow = {
  player_id: number;
  club_id: number;
  season_start_year: number;
  is_current: boolean | null;
};

type PlayerWord = {
  id: number;
  fullName: string;
  word: string;
  photoUrl: string | null;
  teamName: string;
  teamBadge: string | null;
  isRetired: boolean;
  isLegend: boolean;
  easyEligible: boolean;
  hardEligible: boolean;
};

type Mark = "correct" | "present" | "absent" | "fixed";

type SubmittedGuess = {
  word: string;
  marks: Mark[];
};

const MAX_ATTEMPTS = 6;
const GAME_KEY = "adivina-jugador";
const ATTEMPT_SCORES = [100, 80, 60, 40, 30, 20] as const;
const KEYBOARD = [
  ["Q","W","E","R","T","Y","U","I","O","P"],
  ["A","S","D","F","G","H","J","K","L","Ñ","Ç"],
  ["ENTER","Z","X","C","V","B","N","M","BACKSPACE"],
];

function normalizeLetters(value: string) {
  return value
    .replace(/Ñ/g, "__ENYE__").replace(/ñ/g, "__ENYE__")
    .replace(/Ç/g, "__CEDI__").replace(/ç/g, "__CEDI__")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/__ENYE__/g, "Ñ").replace(/__CEDI__/g, "Ç")
    .toUpperCase()
    .replace(/[‐‑‒–—]/g, "-")
    .replace(/\s+/g, " ")
    .replace(/[^A-ZÑÇ -]/g, "")
    .trim();
}

function getPlayerWord(player: PlayerRow) {
  const raw = (player.game_name || player.last_name || player.display_name || "").trim();
  return normalizeLetters(raw);
}

function scoreGuess(guess: string, answer: string): Mark[] {
  const marks: Mark[] = Array(answer.length).fill("absent");
  const remaining = new Map<string, number>();

  for (let i = 0; i < answer.length; i++) {
    if (answer[i] === "-" || answer[i] === " ") {
      marks[i] = "fixed";
      continue;
    }
    if (guess[i] === answer[i]) {
      marks[i] = "correct";
    } else {
      remaining.set(answer[i], (remaining.get(answer[i]) ?? 0) + 1);
    }
  }

  for (let i = 0; i < answer.length; i++) {
    if (marks[i] === "correct" || marks[i] === "fixed") continue;
    const letter = guess[i];
    const count = remaining.get(letter) ?? 0;
    if (letter && count > 0) {
      marks[i] = "present";
      remaining.set(letter, count - 1);
    }
  }

  return marks;
}

function pickRandom<T>(items: T[]) {
  return items[Math.floor(Math.random() * items.length)];
}

export default function PlayerWordleGame() {
  const { locale } = useI18n();
  const c = locale === "en" ? { difficulty: "DIFFICULTY", easy: ["EASY", "Big clubs + legends"], hard: ["HARD", "Top 5 leagues + Argentina + legends"], impossible: ["IMPOSSIBLE", "Full database"], config: "Public Supabase configuration is missing.", retired: "Retired", unavailable: "Team unavailable", few: "There are not enough valid players to start the game.", missing: "MISSING LETTERS", invalid: "INVALID PLAYER", goal: "GOAL!", allKnown: "YOU HAVE ALREADY REVEALED EVERY POSITION", hintAt: "AT POSITION", noPlayers: "NO PLAYERS ARE AVAILABLE AT THIS DIFFICULTY", loading: "Preparing player…", players: "players", letters: "letters", attempts: "6 attempts", hintUsed: "Hint used (-10)", hint: "Hint (-10)", surrender: "Give up (-20)", keyboard: "Keyboard", correct: "Correct position", present: "In the name, but elsewhere", absent: "Not in the name", guessed: "PLAYER GUESSED", gaveUp: "YOU GAVE UP", over: "GAME OVER", answer: "Answer", points: "points", total: "Total Guess the Player", attempt: "attempt", used: "hint used", again: "Play again", was: "WAS" } : locale === "fr" ? { difficulty: "DIFFICULTÉ", easy: ["FACILE", "Grands clubs + légendes"], hard: ["DIFFICILE", "5 grands championnats + Argentine + légendes"], impossible: ["IMPOSSIBLE", "Toute la base de données"], config: "La configuration publique de Supabase est manquante.", retired: "Retraité", unavailable: "Équipe indisponible", few: "Il n'y a pas assez de joueurs valides pour démarrer la partie.", missing: "IL MANQUE DES LETTRES", invalid: "JOUEUR NON VALIDE", goal: "BUUUT !", allKnown: "VOUS AVEZ DÉJÀ DÉCOUVERT TOUTES LES POSITIONS", hintAt: "EN POSITION", noPlayers: "AUCUN JOUEUR DISPONIBLE À CETTE DIFFICULTÉ", loading: "Préparation du joueur…", players: "joueurs", letters: "lettres", attempts: "6 essais", hintUsed: "Indice utilisé (-10)", hint: "Indice (-10)", surrender: "Abandonner (-20)", keyboard: "Clavier", correct: "Bonne position", present: "Dans le nom, mais ailleurs", absent: "Absent du nom", guessed: "JOUEUR DEVINÉ", gaveUp: "VOUS AVEZ ABANDONNÉ", over: "FIN DE LA PARTIE", answer: "Réponse", points: "points", total: "Total Devinez le joueur", attempt: "essai", used: "indice utilisé", again: "Rejouer", was: "C'ÉTAIT" } : { difficulty: "DIFICULTAD", easy: ["FÁCIL", "Grandes clubes + leyendas"], hard: ["DIFÍCIL", "5 grandes ligas + Argentina + leyendas"], impossible: ["IMPOSIBLE", "Toda la base de datos"], config: "Falta la configuración pública de Supabase.", retired: "Retirado", unavailable: "Equipo no disponible", few: "No hay suficientes jugadores válidos para iniciar el juego.", missing: "FALTAN LETRAS", invalid: "JUGADOR NO VÁLIDO", goal: "¡GOOOL!", allKnown: "YA TIENES TODAS LAS POSICIONES DESCUBIERTAS", hintAt: "EN POSICIÓN", noPlayers: "NO HAY JUGADORES DISPONIBLES EN ESTA DIFICULTAD", loading: "Preparando jugador…", players: "jugadores", letters: "letras", attempts: "6 intentos", hintUsed: "Pista usada (-10)", hint: "Pista (-10)", surrender: "Rendirse (-20)", keyboard: "Teclado", correct: "Posición correcta", present: "Está, pero en otra posición", absent: "No está en el nombre", guessed: "JUGADOR ADIVINADO", gaveUp: "TE HAS RENDIDO", over: "FIN DE LA PARTIDA", answer: "Respuesta", points: "puntos", total: "Total Adivina el jugador", attempt: "intento", used: "pista usada", again: "Jugar otra", was: "ERA" };
  const difficultyCopy: Record<Difficulty, { label: string; description: string }> = { easy: { label: c.easy[0], description: c.easy[1] }, hard: { label: c.hard[0], description: c.hard[1] }, impossible: { label: c.impossible[0], description: c.impossible[1] } };
  const [pool, setPool] = useState<PlayerWord[]>([]);
  const [difficulty, setDifficulty] = useState<Difficulty>("easy");
  const [target, setTarget] = useState<PlayerWord | null>(null);
  const [guesses, setGuesses] = useState<SubmittedGuess[]>([]);
  const [current, setCurrent] = useState<Record<number, string>>({});
  const [finished, setFinished] = useState(false);
  const [won, setWon] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hintPosition, setHintPosition] = useState<number | null>(null);
  const [hintRow, setHintRow] = useState<number | null>(null);
  const [usedHint, setUsedHint] = useState(false);
  const [surrendered, setSurrendered] = useState(false);
  const [roundScore, setRoundScore] = useState<number | null>(null);
  const [scoreStats, setScoreStats] = useState<GameScoreStats>(() => ({ points: 0, played: 0, wins: 0, bestScore: 0, hintsUsed: 0, surrenders: 0 }));

  useEffect(() => {
    setScoreStats(getGameScore(GAME_KEY));
  }, []);

  useEffect(() => {
    async function load() {
      if (!supabase) {
        setError(c.config);
        setLoading(false);
        return;
      }

      const [playersRes, clubsRes, careerRes] = await Promise.all([
        supabase
          .from("players")
          .select("id,display_name,full_name,first_name,last_name,game_name,photo_url,is_active,is_retired,is_legend"),
        supabase
          .from("clubs")
          .select("id,name,badge_url,is_national_team,is_easy_player_pool,is_hard_player_pool"),
        supabase
          .from("player_club_seasons")
          .select("player_id,club_id,season_start_year,is_current")
          .order("season_start_year", { ascending: false }),
      ]);

      const firstError = playersRes.error || clubsRes.error || careerRes.error;
      if (firstError) {
        setError(firstError.message);
        setLoading(false);
        return;
      }

      const players = (playersRes.data ?? []) as PlayerRow[];
      const clubs = (clubsRes.data ?? []) as ClubRow[];
      const career = (careerRes.data ?? []) as CareerRow[];

      const clubMap = new Map(clubs.map((club) => [club.id, club]));
      const latestClub = new Map<number, ClubRow>();
      const currentClub = new Map<number, ClubRow>();

      for (const row of career) {
        const club = clubMap.get(row.club_id);
        if (!club || club.is_national_team) continue;
        if (!latestClub.has(row.player_id)) latestClub.set(row.player_id, club);
        if (row.is_current === true && !currentClub.has(row.player_id)) currentClub.set(row.player_id, club);
      }

      const unique = new Map<string, PlayerWord>();
      for (const player of players) {
        if (!player.is_active && !player.game_name) continue;

        const word = getPlayerWord(player);
        if (word.length < 4 || word.length > 14) continue;
        if (!/^[A-ZÑÇ -]+$/.test(word)) continue;

        const club = currentClub.get(player.id) ?? latestClub.get(player.id);
        const retired = player.is_retired || !player.is_active;
        const legend = retired && player.is_legend === true;
        const easyEligible = legend || (!retired && club?.is_easy_player_pool === true);
        const hardEligible = legend || (!retired && club?.is_hard_player_pool === true);

        if (!unique.has(word)) {
          unique.set(word, {
            id: player.id,
            fullName: player.full_name?.trim() || player.display_name,
            word,
            photoUrl: player.photo_url,
            teamName: retired ? c.retired : (club?.name ?? c.unavailable),
            teamBadge: retired ? null : (club?.badge_url ?? null),
            isRetired: retired,
            isLegend: legend,
            easyEligible,
            hardEligible,
          });
        }
      }

      const ready = [...unique.values()];
      if (ready.length < 10) {
        setError(c.few);
        setLoading(false);
        return;
      }

      setPool(ready);
      const easy = ready.filter((player) => player.easyEligible);
      const initialPool = easy.length >= 10 ? easy : ready;
      if (easy.length < 10) setDifficulty("impossible");
      setTarget(pickRandom(initialPool));
      setLoading(false);
    }

    load();
  }, []);

  const difficultyPool = useMemo(() => {
    if (difficulty === "easy") return pool.filter((player) => player.easyEligible);
    if (difficulty === "hard") return pool.filter((player) => player.hardEligible);
    return pool;
  }, [pool, difficulty]);

  const validWords = useMemo(() => {
    if (!target) return new Set<string>();
    return new Set(
      pool
        .filter((p) => p.word.length === target.word.length && p.word.split("").every((c, i) =>
          (target.word[i] === "-" || target.word[i] === " ")
            ? c === target.word[i]
            : (c !== "-" && c !== " ")
        ))
        .map((p) => p.word)
    );
  }, [pool, target]);

  const keyboardState = useMemo(() => {
    const priority: Record<Exclude<Mark, "fixed">, number> = { absent: 1, present: 2, correct: 3 };
    const result: Record<string, Exclude<Mark, "fixed">> = {};
    for (const guess of guesses) {
      guess.word.split("").forEach((letter, index) => {
        if (letter === "-" || letter === " ") return;
        const mark = guess.marks[index] as Exclude<Mark, "fixed">;
        if (!result[letter] || priority[mark] > priority[result[letter]]) result[letter] = mark;
      });
    }
    return result;
  }, [guesses]);

  function expectedEditablePositions(answer: string) {
    return answer.split("").filter((c) => c !== "-" && c !== " ").length;
  }

  function hintAppliesToCurrentRow() {
    return hintRow === guesses.length && hintPosition !== null;
  }

  function editableIndexes(answer: string) {
    const currentHint = hintAppliesToCurrentRow() ? hintPosition : null;
    return answer
      .split("")
      .map((char, index) => ({ char, index }))
      .filter(({ char, index }) => char !== "-" && char !== " " && index !== currentHint)
      .map(({ index }) => index);
  }

  function currentAsDisplay() {
    if (!target) return "";
    const currentHint = hintAppliesToCurrentRow() ? hintPosition : null;
    return target.word.split("").map((answerChar, index) => {
      if (answerChar === "-" || answerChar === " ") return answerChar;
      if (index === currentHint) return answerChar;
      return current[index] ?? "";
    }).join("");
  }

  function addLetter(letter: string) {
    if (!target || finished) return;
    const position = editableIndexes(target.word).find((index) => !current[index]);
    if (position === undefined) return;
    setCurrent((value) => ({ ...value, [position]: letter }));
    setMessage(null);
  }

  function removeLetter() {
    if (!target || finished) return;
    const filled = editableIndexes(target.word).filter((index) => current[index]);
    const position = filled.at(-1);
    if (position === undefined) return;
    setCurrent((value) => {
      const next = { ...value };
      delete next[position];
      return next;
    });
    setMessage(null);
  }

  function submit() {
    if (!target || finished) return;
    const missing = editableIndexes(target.word).some((index) => !current[index]);
    if (missing) {
      setMessage(c.missing);
      return;
    }

    const displayGuess = currentAsDisplay();
    if (!validWords.has(displayGuess) && displayGuess !== target.word) {
      setMessage(c.invalid);
      return;
    }

    const entry = { word: displayGuess, marks: scoreGuess(displayGuess, target.word) };
    const next = [...guesses, entry];
    setCurrent({});
    setHintPosition(null);
    setHintRow(null);
    setGuesses(next);

    if (displayGuess === target.word) {
      const baseScore = ATTEMPT_SCORES[next.length - 1] ?? 0;
      const score = Math.max(0, baseScore - (usedHint ? 10 : 0));
      const updated = recordGameResult(GAME_KEY, { score, won: true, usedHint });
      setScoreStats(updated);
      setRoundScore(score);
      setWon(true);
      setFinished(true);
      setMessage(c.goal);
    } else if (next.length >= MAX_ATTEMPTS) {
      const updated = recordGameResult(GAME_KEY, { score: 0, won: false, usedHint });
      setScoreStats(updated);
      setRoundScore(0);
      setFinished(true);
      setMessage(`${c.was} ${target.word}`);
    } else {
      setMessage(null);
    }
  }

  function useHint() {
    if (!target || finished || usedHint) return;

    const knownCorrect = new Set<number>();
    for (const guess of guesses) {
      guess.marks.forEach((mark, index) => {
        if (mark === "correct") knownCorrect.add(index);
      });
    }

    const candidates = target.word
      .split("")
      .map((char, index) => ({ char, index }))
      .filter(({ char, index }) => char !== "-" && char !== " " && !knownCorrect.has(index));

    if (!candidates.length) {
      setMessage(c.allKnown);
      return;
    }

    const picked = pickRandom(candidates);
    setHintPosition(picked.index);
    setHintRow(guesses.length);
    setUsedHint(true);
    setCurrent((value) => {
      const next = { ...value };
      delete next[picked.index];
      return next;
    });
    setMessage(`${c.hint}: ${picked.char} ${c.hintAt} ${picked.index + 1} · -10 PTS`);
  }

  function surrender() {
    if (!target || finished) return;
    const updated = recordGameResult(GAME_KEY, { score: -20, won: false, usedHint, surrendered: true });
    setScoreStats(updated);
    setRoundScore(-20);
    setSurrendered(true);
    setWon(false);
    setFinished(true);
    setCurrent({});
    setMessage(`${c.was} ${target.word}`);
  }

  function pressKey(key: string) {
    if (key === "ENTER") submit();
    else if (key === "BACKSPACE") removeLetter();
    else addLetter(key);
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Enter") submit();
      else if (event.key === "Backspace") removeLetter();
      else {
        const normalized = normalizeLetters(event.key);
        if (/^[A-ZÑÇ]$/.test(normalized)) addLetter(normalized);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  function resetRound(nextTarget: PlayerWord) {
    setTarget(nextTarget);
    setGuesses([]);
    setCurrent({});
    setFinished(false);
    setWon(false);
    setMessage(null);
    setHintPosition(null);
    setHintRow(null);
    setUsedHint(false);
    setSurrendered(false);
    setRoundScore(null);
  }

  function restart() {
    if (!difficultyPool.length) return;
    let next = pickRandom(difficultyPool);
    if (target && difficultyPool.length > 1) {
      while (next.id === target.id) next = pickRandom(difficultyPool);
    }
    resetRound(next);
  }

  function changeDifficulty(nextDifficulty: Difficulty) {
    if (nextDifficulty === difficulty) return;
    const nextPool =
      nextDifficulty === "easy"
        ? pool.filter((player) => player.easyEligible)
        : nextDifficulty === "hard"
          ? pool.filter((player) => player.hardEligible)
          : pool;

    if (!nextPool.length) {
      setMessage(c.noPlayers);
      return;
    }

    setDifficulty(nextDifficulty);
    resetRound(pickRandom(nextPool));
  }

  if (loading) return <div className="wordle-status" role="status" aria-live="polite">{c.loading}</div>;
  if (error || !target) return <div className="wordle-status error" role="alert">{error}</div>;

  const rows = Array.from({ length: MAX_ATTEMPTS }, (_, rowIndex) => {
    const submitted = guesses[rowIndex];
    const isCurrent = rowIndex === guesses.length && !finished;
    return { submitted, isCurrent };
  });

  return (
    <section className="player-wordle">
      <div className="wordle-difficulty" aria-label={c.difficulty}><strong>{c.difficulty}</strong>
        <div className="wordle-difficulty-buttons">
          {(Object.keys(difficultyCopy) as Difficulty[]).map((level) => (
            <button
              type="button"
              key={level}
              onClick={() => changeDifficulty(level)}
              className={`wordle-difficulty-button ${difficulty === level ? "is-active" : ""}`}
              aria-pressed={difficulty === level}
            >
              {difficultyCopy[level].label}
            </button>
          ))}
        </div>
        <small>{difficultyCopy[difficulty].description} · {difficultyPool.length} {c.players}</small>
      </div>

      <div className="wordle-meta">
        <span>{expectedEditablePositions(target.word)} {c.letters}</span><span>{c.attempts}</span>
        <span>{scoreStats.points} pts</span>
      </div>

      {message && <div className="wordle-toast" role="status" aria-live="polite">{message}</div>}

      <div className="wordle-board" style={{ "--word-length": target.word.length } as CSSProperties}>
        {rows.map((row, rowIndex) => (
          <div className="wordle-row" key={rowIndex}>
            {target.word.split("").map((answerChar, columnIndex) => {
              const submittedChar = row.submitted?.word[columnIndex] ?? "";
              const mark = row.submitted?.marks[columnIndex];
              const fixed = answerChar === "-" || answerChar === " ";
              const hinted = row.isCurrent && rowIndex === hintRow && columnIndex === hintPosition && !fixed;
              const char = row.submitted
                ? submittedChar
                : hinted
                  ? answerChar
                  : row.isCurrent
                    ? (current[columnIndex] ?? "")
                    : "";

              return (
                <div
                  key={columnIndex}
                  className={`wordle-tile ${mark ? `is-${mark}` : ""} ${hinted ? "is-correct is-hint" : ""} ${fixed ? "is-separator" : ""} ${char && !mark ? "has-letter" : ""}`}
                >
                  {fixed ? answerChar : char}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {!finished && (
        <div className="wordle-actions">
          <button type="button" className="wordle-action hint" onClick={useHint} disabled={usedHint}>
            {usedHint ? c.hintUsed : c.hint}
          </button>
          <button type="button" className="wordle-action surrender" onClick={surrender}>{c.surrender}</button>
        </div>
      )}

      <div className="wordle-keyboard" aria-label={c.keyboard}>
        {KEYBOARD.map((row, index) => (
          <div className="wordle-key-row" key={index}>
            {row.map((key) => {
              const state = keyboardState[key];
              return (
                <button
                  type="button"
                  key={key}
                  onClick={() => pressKey(key)}
                  className={`wordle-key ${key.length > 1 ? "is-wide" : ""} ${state ? `is-${state}` : ""}`}
                  disabled={finished}
                >
                  {key === "BACKSPACE" ? "⌫" : key === "ENTER" ? "✓" : key}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      <div className="wordle-legend">
        <span><i className="correct" /> {c.correct}</span><span><i className="present" /> {c.present}</span><span><i className="absent" /> {c.absent}</span>
      </div>

      {finished && (
        <div className={`wordle-result ${won ? "win" : "loss"}`}>
          <div className="wordle-answer">
            <div className="wordle-answer-photo">
              {target.photoUrl ? <img src={target.photoUrl} alt={target.fullName} /> : <span>⚽</span>}
            </div>
            <div className="wordle-answer-copy">
              <small>{won ? c.guessed : surrendered ? c.gaveUp : c.over}</small>
              <strong>{target.fullName}</strong>
              <div className="wordle-team-line">
                {target.teamBadge && <img src={target.teamBadge} alt="" />}
                <span>{target.teamName}</span>
              </div>
              <em>{c.answer}: {target.word}</em>
              <div className={`wordle-score ${roundScore && roundScore > 0 ? "positive" : roundScore && roundScore < 0 ? "negative" : "zero"}`}>
                <strong>{roundScore !== null && roundScore > 0 ? `+${roundScore}` : (roundScore ?? 0)} {c.points}</strong><span>{c.total}: {scoreStats.points} pts</span>{won && <small>{guesses.length}. {c.attempt}{usedHint ? ` · ${c.used}` : ""}</small>}
              </div>
            </div>
          </div>
          <button type="button" onClick={restart}>{c.again}</button>
        </div>
      )}

      <style jsx>{`
        .wordle-difficulty {
          display: grid;
          gap: 8px;
          margin: 0 auto 14px;
          text-align: center;
        }
        .wordle-difficulty > strong {
          font-size: 0.72rem;
          letter-spacing: 0.16em;
        }
        .wordle-difficulty-buttons {
          display: flex;
          justify-content: center;
          flex-wrap: wrap;
          gap: 8px;
        }
        .wordle-difficulty-button {
          border: 1px solid rgba(255,255,255,.18);
          background: #161616;
          color: #fff;
          border-radius: 999px;
          padding: 8px 13px;
          font: inherit;
          font-size: 0.78rem;
          font-weight: 800;
          cursor: pointer;
        }
        .wordle-difficulty-button:hover {
          border-color: #A8FF00;
        }
        .wordle-difficulty-button.is-active {
          background: #A8FF00;
          border-color: #A8FF00;
          color: #0D0D0D;
        }
        .wordle-difficulty small {
          opacity: .7;
          font-size: .72rem;
        }
      `}</style>
    </section>
  );
}
