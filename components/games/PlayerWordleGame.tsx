"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { supabase } from "../../lib/supabase";
import { getGameScore, recordGameResult, type GameScoreStats } from "../../lib/game-scores";

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
};

type ClubRow = {
  id: number;
  name: string;
  badge_url: string | null;
  is_national_team: boolean;
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
  // game_name será la respuesta canónica tras la curación. El fallback mantiene
  // jugable la versión mientras completamos esa migración.
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
  const [pool, setPool] = useState<PlayerWord[]>([]);
  const [target, setTarget] = useState<PlayerWord | null>(null);
  const [guesses, setGuesses] = useState<SubmittedGuess[]>([]);
  const [current, setCurrent] = useState<Record<number, string>>({});
  const [finished, setFinished] = useState(false);
  const [won, setWon] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hintPosition, setHintPosition] = useState<number | null>(null);
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
        setError("Falta la configuración pública de Supabase.");
        setLoading(false);
        return;
      }

      const [playersRes, clubsRes, careerRes] = await Promise.all([
        supabase
          .from("players")
          .select("id,display_name,full_name,first_name,last_name,game_name,photo_url,is_active,is_retired"),
        supabase
          .from("clubs")
          .select("id,name,badge_url,is_national_team"),
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
        // Hasta que grabemos game_name, mantenemos los activos jugables con fallback.
        // Los retirados entrarán automáticamente cuando tengan game_name curado.
        if (!player.is_active && !player.game_name) continue;

        const word = getPlayerWord(player);
        if (word.length < 4 || word.length > 14) continue;
        if (!/^[A-ZÑÇ -]+$/.test(word)) continue;

        const club = currentClub.get(player.id) ?? latestClub.get(player.id);
        const retired = player.is_retired || !player.is_active;
        if (!unique.has(word)) {
          unique.set(word, {
            id: player.id,
            fullName: player.full_name?.trim() || player.display_name,
            word,
            photoUrl: player.photo_url,
            teamName: retired ? "Retirado" : (club?.name ?? "Equipo no disponible"),
            teamBadge: retired ? null : (club?.badge_url ?? null),
            isRetired: retired,
          });
        }
      }

      const ready = [...unique.values()];
      if (ready.length < 10) {
        setError("No hay suficientes jugadores válidos para iniciar el juego.");
        setLoading(false);
        return;
      }
      setPool(ready);
      setTarget(pickRandom(ready));
      setLoading(false);
    }
    load();
  }, []);

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

  function editableIndexes(answer: string) {
    return answer
      .split("")
      .map((char, index) => ({ char, index }))
      .filter(({ char, index }) => char !== "-" && char !== " " && index !== hintPosition)
      .map(({ index }) => index);
  }

  function currentAsDisplay() {
    if (!target) return "";
    return target.word.split("").map((answerChar, index) => {
      if (answerChar === "-" || answerChar === " ") return answerChar;
      if (index === hintPosition) return answerChar;
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
      setMessage("FALTAN LETRAS");
      return;
    }

    const displayGuess = currentAsDisplay();
    if (!validWords.has(displayGuess) && displayGuess !== target.word) {
      setMessage("JUGADOR NO VÁLIDO");
      return;
    }

    const entry = { word: displayGuess, marks: scoreGuess(displayGuess, target.word) };
    const next = [...guesses, entry];
    setGuesses(next);
    setCurrent({});

    if (displayGuess === target.word) {
      const baseScore = ATTEMPT_SCORES[next.length - 1] ?? 0;
      const score = Math.max(0, baseScore - (usedHint ? 10 : 0));
      const updated = recordGameResult(GAME_KEY, { score, won: true, usedHint });
      setScoreStats(updated);
      setRoundScore(score);
      setWon(true);
      setFinished(true);
      setMessage("¡GOOOL!");
    } else if (next.length >= MAX_ATTEMPTS) {
      const updated = recordGameResult(GAME_KEY, { score: 0, won: false, usedHint });
      setScoreStats(updated);
      setRoundScore(0);
      setFinished(true);
      setMessage(`ERA ${target.word}`);
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
      setMessage("YA TIENES TODAS LAS POSICIONES DESCUBIERTAS");
      return;
    }

    const picked = pickRandom(candidates);
    setHintPosition(picked.index);
    setUsedHint(true);
    // La posición de la pista pasa a ser una casilla fija. Si había una letra
    // escrita en esa posición, se elimina; el resto del intento se conserva.
    setCurrent((value) => {
      const next = { ...value };
      delete next[picked.index];
      return next;
    });
    setMessage(`PISTA: ${picked.char} EN POSICIÓN ${picked.index + 1} · -10 PTS`);
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
    setMessage(`ERA ${target.word}`);
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

  function restart() {
    if (!pool.length) return;
    let next = pickRandom(pool);
    if (target && pool.length > 1) while (next.id === target.id) next = pickRandom(pool);
    setTarget(next);
    setGuesses([]);
    setCurrent({});
    setFinished(false);
    setWon(false);
    setMessage(null);
    setHintPosition(null);
    setUsedHint(false);
    setSurrendered(false);
    setRoundScore(null);
  }

  if (loading) return <div className="wordle-status">Preparando jugador…</div>;
  if (error || !target) return <div className="wordle-status error">{error}</div>;

  const rows = Array.from({ length: MAX_ATTEMPTS }, (_, rowIndex) => {
    const submitted = guesses[rowIndex];
    const isCurrent = rowIndex === guesses.length && !finished;
    return { submitted, isCurrent };
  });

  return (
    <section className="player-wordle">
      <div className="wordle-meta">
        <span>{expectedEditablePositions(target.word)} letras</span>
        <span>6 intentos</span>
        <span>{scoreStats.points} pts</span>
      </div>

      {message && <div className="wordle-toast">{message}</div>}

      <div className="wordle-board" style={{ "--word-length": target.word.length } as CSSProperties}>
        {rows.map((row, rowIndex) => (
          <div className="wordle-row" key={rowIndex}>
            {target.word.split("").map((answerChar, columnIndex) => {
              const submittedChar = row.submitted?.word[columnIndex] ?? "";
              const mark = row.submitted?.marks[columnIndex];
              const fixed = answerChar === "-" || answerChar === " ";
              // La pista queda BLOQUEADA en la misma posición de todos los intentos
              // restantes. Las letras del intento actual se guardan por posición
              // absoluta, evitando que la letra de pista aparezca también al inicio.
              const hinted = !row.submitted && columnIndex === hintPosition && !fixed;
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
            {usedHint ? "Pista usada (-10)" : "Pista (-10)"}
          </button>
          <button type="button" className="wordle-action surrender" onClick={surrender}>Rendirse (-20)</button>
        </div>
      )}

      <div className="wordle-keyboard" aria-label="Teclado">
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
        <span><i className="correct" /> Posición correcta</span>
        <span><i className="present" /> Está, pero en otra posición</span>
        <span><i className="absent" /> No está en el nombre</span>
      </div>

      {finished && (
        <div className={`wordle-result ${won ? "win" : "loss"}`}>
          <div className="wordle-answer">
            <div className="wordle-answer-photo">
              {target.photoUrl ? <img src={target.photoUrl} alt={target.fullName} /> : <span>⚽</span>}
            </div>
            <div className="wordle-answer-copy">
              <small>{won ? "JUGADOR ADIVINADO" : surrendered ? "TE HAS RENDIDO" : "FIN DE LA PARTIDA"}</small>
              <strong>{target.fullName}</strong>
              <div className="wordle-team-line">
                {target.teamBadge && <img src={target.teamBadge} alt="" />}
                <span>{target.teamName}</span>
              </div>
              <em>Respuesta: {target.word}</em>
              <div className={`wordle-score ${roundScore && roundScore > 0 ? "positive" : roundScore && roundScore < 0 ? "negative" : "zero"}`}>
                <strong>{roundScore !== null && roundScore > 0 ? `+${roundScore}` : (roundScore ?? 0)} puntos</strong>
                <span>Total Adivina el jugador: {scoreStats.points} pts</span>
                {won && <small>{guesses.length}.º intento{usedHint ? " · pista usada" : ""}</small>}
              </div>
            </div>
          </div>
          <button type="button" onClick={restart}>Jugar otra</button>
        </div>
      )}
    </section>
  );
}
