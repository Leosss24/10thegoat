"use client";
import { footballLabel } from "../../lib/football/player-identity";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useI18n } from "../I18nProvider";
import questions from "../../data/trivia/questions.json";
import { answer, expireRound, isTriviaSession, newRound, nextQuestion, type Mode, type Question, type Round, type TriviaSession } from "../../lib/trivia/engine";
import { triviaCopy } from "../../lib/trivia/copy";
import { addGamePoints, getGameScore, recordGameResult } from "../../lib/game-scores";
import "./TriviaGame.css";

function clockColor(seconds: number) {
  const stops = [[60, 104, 224, 156], [45, 116, 189, 255], [30, 255, 216, 92], [20, 255, 159, 82], [10, 255, 102, 112]];
  for (let i = 0; i < stops.length - 1; i++) {
    const a = stops[i], b = stops[i + 1];
    if (seconds > b[0]) {
      const ratio = Math.max(0, Math.min(1, (a[0] - seconds) / (a[0] - b[0])));
      return 'rgb(' + a.slice(1).map((v, j) => Math.round(v + (b[j + 1] - v) * ratio)).join(', ') + ')';
    }
  }
  return 'rgb(255, 102, 112)';
}

const bank = questions as Question[];
const SESSION_KEY = "10tg-game-session-v1:trivia";
const scoreKey = (difficulty: Mode) => `trivia-${difficulty}`;

export default function TriviaGame() {
  const { locale } = useI18n();
  const t = triviaCopy[locale];
  const [session, setSession] = useState<TriviaSession>({ bankVersion: 1, difficulty: "easy", rounds: {} });
  const [ready, setReady] = useState(false);
  const [choosing, setChoosing] = useState(true);
  const [storageFailed, setStorageFailed] = useState(false);
  const [records, setRecords] = useState({ easy: 0, hard: 0, timed: 0 });
  const [now, setNow] = useState(0);
  const lock = useRef(false);
  const latestRound = useRef<Round | undefined>(undefined);
  const latestSession = useRef(session);
  const focusTarget = useRef<HTMLHeadingElement>(null);
  const needsFocus = useRef(false);
  const round = session.rounds[session.difficulty];
  const question = round ? bank.find(q => q.id === round.queue[round.index])! : null;

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        if (saved?.version === 1 && isTriviaSession(saved.value, bank)) {
          setSession(saved.value);
          latestSession.current = saved.value;
          latestRound.current = saved.value.rounds[saved.value.difficulty];
          setChoosing(false);
        }
      }
    } catch { /* A corrupt session is replaced on the next start. */ }
    try {
      setRecords({ easy: Math.floor(getGameScore(scoreKey("easy")).bestScore / 10), hard: Math.floor(getGameScore(scoreKey("hard")).bestScore / 10), timed: Math.floor(getGameScore(scoreKey("timed")).bestScore / 10) });
      const probe = `${SESSION_KEY}:probe`;
      sessionStorage.setItem(probe, "1"); sessionStorage.removeItem(probe);
      localStorage.setItem(probe, "1"); localStorage.removeItem(probe);
    } catch { setStorageFailed(true); }
    setNow(Date.now());
    setReady(true);
  }, []);

  useEffect(() => {
    if (needsFocus.current) { focusTarget.current?.focus(); needsFocus.current = false; }
  }, [session, choosing]);

  useEffect(() => {
    const timed = session.rounds.timed;
    if (!ready || !timed || timed.finished) return;
    let settled = false;
    const tick = () => {
      if (latestSession.current !== session) return;
      setNow(Date.now());
      const expired = expireRound(timed);
      if (expired === timed || settled) return;
      settled = true;
      // Also expire a timed game while the player is viewing another mode.
      if (session.difficulty === "timed") { latestRound.current = expired; needsFocus.current = true; }
      save({ ...session, rounds: { ...session.rounds, timed: expired } });
      try { recordGameResult(scoreKey("timed"), { score: 0, won: false }); }
      catch { setStorageFailed(true); }
    };
    tick();
    const timer = window.setInterval(tick, 100);
    window.addEventListener("focus", tick);
    document.addEventListener("visibilitychange", tick);
    return () => { clearInterval(timer); window.removeEventListener("focus", tick); document.removeEventListener("visibilitychange", tick); };
  }, [ready, session]);

  useEffect(() => {
    if (choosing || round?.difficulty !== "timed" || round.finished || round.selected === null) return;
    const timer = window.setTimeout(() => advance(), 650);
    return () => clearTimeout(timer);
  }, [round, choosing]);

  function save(value: TriviaSession) {
    latestSession.current = value;
    try { sessionStorage.setItem(SESSION_KEY, JSON.stringify({ version: 1, value })); }
    catch { setStorageFailed(true); }
    setSession(value);
  }
  function saveRound(value: Round) {
    latestRound.current = value;
    save({ ...session, difficulty: value.difficulty, rounds: { ...session.rounds, [value.difficulty]: value } });
  }
  function start(difficulty: Mode, restart = false) {
    const saved = session.rounds[difficulty];
    saveRound(!restart && saved && !saved.finished ? saved : newRound(bank, difficulty));
    setChoosing(false);
    lock.current = false;
    needsFocus.current = true;
    setNow(Date.now());
  }
  function finishIfExpired(value: Round, at: number) {
    const expired = expireRound(value, at);
    if (expired === value) return false;
    saveRound(expired);
    needsFocus.current = true;
    try { recordGameResult(scoreKey(value.difficulty), { score: 0, won: false }); }
    catch { setStorageFailed(true); }
    return true;
  }
  function chooseAnswer(id: string) {
    const at = Date.now();
    if (!round || !question || lock.current || round.selected !== null || round.finished) return;
    if (latestRound.current !== round || finishIfExpired(round, at)) return;
    lock.current = true;
    let best = records[round.difficulty];
    try { best = Math.max(best, Math.floor(getGameScore(scoreKey(round.difficulty)).bestScore / 10)); }
    catch { setStorageFailed(true); }
    const next = answer(round, question, id, best, at);
    // Persist the answered state before updating totals: reloads never replay an answer.
    saveRound(next);
    try {
      if (next.lastAward) addGamePoints(scoreKey(round.difficulty), next.lastAward);
      if (next.finished) recordGameResult(scoreKey(round.difficulty), { score: 0, won: false });
    } catch { setStorageFailed(true); }
    setRecords(current => ({ ...current, [round.difficulty]: Math.max(best, next.streak) }));
    if (next.finished) needsFocus.current = true;
  }
  function advance() {
    const at = Date.now();
    if (!round || latestRound.current !== round || round.finished || round.selected === null) return;
    if (finishIfExpired(round, at)) return;
    saveRound(nextQuestion(round, bank, at));
    lock.current = false;
    needsFocus.current = true;
  }

  if (!ready) return <div className="trivia-panel" role="status">{t.loading}</div>;
  return <div className="trivia" data-difficulty={session.difficulty}>
    {storageFailed && <p className="trivia-storage" role="status">{t.storage}</p>}
    {choosing || !round || !question ? <section className="trivia-panel trivia-intro">
      <span className="trivia-kicker">10theGOAT · KNOWLEDGE ARENA</span>
      <div className="trivia-emblem" aria-hidden="true">?</div>
      <h2 ref={focusTarget} tabIndex={-1}>{t.choose}</h2>
      <p>{t.intro}</p>
      <div className="trivia-modes">
        {(["easy", "hard", "timed"] as const).map((difficulty) => <button type="button" className={`trivia-mode${difficulty === "timed" ? " trivia-mode-timed" : ""}`} key={difficulty} onClick={() => start(difficulty)}>
          <span className="trivia-mode-top"><small>{t.best}: {records[difficulty]}</small></span>
          <strong>{t[difficulty]}</strong>
          <span>{difficulty === "timed" ? t.timedDescription : difficulty === "easy" ? t.easyDescription : t.hardDescription}</span>
          <b>{session.rounds[difficulty] && !session.rounds[difficulty]?.finished ? t.resume : t.start} <span aria-hidden="true">↗</span></b>
        </button>)}
      </div>
    </section> : round.finished ? <section className="trivia-panel trivia-summary">
      <span className="trivia-kicker">{t[round.difficulty]} · {t.summary}</span>
      <h2 ref={focusTarget} tabIndex={-1}>{round.timedOut ? t.timeUp : t.incorrect}</h2>
      <div className="trivia-final-streak"><strong>{round.streak}</strong><span>{t.streak}</span></div>
      {round.points > 0 && <p className="trivia-record">↗ {t.newBest}</p>}
      <dl className="trivia-summary-stats">
        <div><dt>{t.points}</dt><dd>+{round.points}</dd></div>
        <div><dt>{t.answered}</dt><dd>{round.streak + (round.timedOut ? 0 : 1)}</dd></div>
        <div><dt>{t.accuracy}</dt><dd>{round.timedOut ? (round.streak ? 100 : 0) : Math.round(round.streak / (round.streak + 1) * 100)}%</dd></div>
      </dl>
      {!round.timedOut && <div className="trivia-recap">
        <p>{question.prompt[locale]}</p>
        <span>{t.rightAnswer}</span>
        <strong>✓ {footballLabel(question.options.find(o => o.id === question.correctOptionId)!.text[locale])}</strong>
        <small>{question.explanation[locale]}</small>
        <a href={question.source} target="_blank" rel="noreferrer">{t.source} ↗</a>
      </div>}
      <div className="trivia-actions"><button type="button" className="btn btn-primary" onClick={() => start(round.difficulty, true)}>{t.again}</button><button type="button" className="btn trivia-secondary" onClick={() => { setChoosing(true); needsFocus.current = true; }}>{t.change}</button></div>
    </section> : <section className="trivia-panel trivia-round">
      <div className="trivia-round-top"><span className="trivia-kicker">{t[round.difficulty]}</span><button type="button" className="trivia-text-button" onClick={() => { setChoosing(true); needsFocus.current = true; }}>{t.change}</button></div>
      {round.difficulty === "timed" && <div className="trivia-clock" style={{ "--clock-color": clockColor(Math.max(0, (round.deadline! - now) / 1000)) } as CSSProperties}>
        <span>{t.timeLeft}</span><strong role="timer" aria-label={t.timeLeft}>{Math.max(0, Math.ceil((round.deadline! - now) / 1000))}<small> s</small></strong>
        <progress max={60} value={Math.max(0, (round.deadline! - now) / 1000)} aria-label={t.timeLeft} />
      </div>}
      <dl className="trivia-scoreboard"><div><dt>{t.streak}</dt><dd>{round.streak}<span aria-hidden="true"> ↗</span></dd></div><div><dt>{t.best}</dt><dd>{records[round.difficulty]}</dd></div><div><dt>{t.points}</dt><dd>+{round.points}</dd></div></dl>
      <div className="trivia-question-meta"><span>{question.category[locale]}</span><span>{t.question} {round.streak + (round.selected ? 0 : 1)}</span></div>
      <h2 ref={focusTarget} tabIndex={-1} id="trivia-question">{question.prompt[locale]}</h2>
      <div className="trivia-options" role="group" aria-labelledby="trivia-question">
        {round.optionOrder.map((id, i) => {
          const option = question.options.find(o => o.id === id)!;
          const correct = round.selected !== null && id === question.correctOptionId;
          return <button type="button" key={`${question.id}:${id}`} disabled={round.selected !== null} className={`trivia-option${correct ? " is-correct" : ""}`} onClick={() => chooseAnswer(id)}>
            <span className="trivia-option-letter" aria-hidden="true">{String.fromCharCode(65 + i)}</span><span>{footballLabel(option.text[locale])}</span>{correct && <span className="trivia-option-check" aria-label={t.correct}>✓</span>}
          </button>;
        })}
      </div>
      <div className="trivia-feedback" aria-live="polite" aria-atomic="true">
        {round.selected !== null && <><div><strong>✓ {t.correct}{round.lastAward > 0 ? ` · +${round.lastAward}` : ""}</strong><p>{question.explanation[locale]}</p></div><button type="button" className="btn btn-primary" onClick={advance}>{t.next} <span aria-hidden="true">→</span></button></>}
      </div>
    </section>}
    <details className="trivia-rules"><summary>{t.rules}</summary><p>{t.rulesText}</p><p>{t.cycle}</p><p>{t.timedRules}</p></details>
  </div>;
}
