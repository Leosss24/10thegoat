"use client";

import { useEffect, useRef, useState } from "react";
import { useI18n } from "../I18nProvider";
import questions from "../../data/trivia/questions.json";
import { answer, isTriviaSession, newRound, nextQuestion, type Difficulty, type Question, type Round, type TriviaSession } from "../../lib/trivia/engine";
import { triviaCopy } from "../../lib/trivia/copy";
import { addGamePoints, getGameScore, recordGameResult } from "../../lib/game-scores";
import "./TriviaGame.css";

const bank = questions as Question[];
const SESSION_KEY = "10tg-game-session-v1:trivia";
const scoreKey = (difficulty: Difficulty) => `trivia-${difficulty}`;

export default function TriviaGame() {
  const { locale } = useI18n();
  const t = triviaCopy[locale];
  const [session, setSession] = useState<TriviaSession>({ bankVersion: 1, difficulty: "easy", rounds: {} });
  const [ready, setReady] = useState(false);
  const [choosing, setChoosing] = useState(true);
  const [storageFailed, setStorageFailed] = useState(false);
  const [records, setRecords] = useState({ easy: 0, hard: 0 });
  const lock = useRef(false);
  const latestRound = useRef<Round | undefined>(undefined);
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
          latestRound.current = saved.value.rounds[saved.value.difficulty];
          setChoosing(false);
        }
      }
    } catch { /* A corrupt session is replaced on the next start. */ }
    try {
      setRecords({ easy: Math.floor(getGameScore(scoreKey("easy")).bestScore / 10), hard: Math.floor(getGameScore(scoreKey("hard")).bestScore / 10) });
      const probe = `${SESSION_KEY}:probe`;
      sessionStorage.setItem(probe, "1"); sessionStorage.removeItem(probe);
      localStorage.setItem(probe, "1"); localStorage.removeItem(probe);
    } catch { setStorageFailed(true); }
    setReady(true);
  }, []);

  useEffect(() => {
    if (needsFocus.current) { focusTarget.current?.focus(); needsFocus.current = false; }
  }, [session, choosing]);

  function save(value: TriviaSession) {
    try { sessionStorage.setItem(SESSION_KEY, JSON.stringify({ version: 1, value })); }
    catch { setStorageFailed(true); }
    setSession(value);
  }
  function saveRound(value: Round) {
    latestRound.current = value;
    save({ ...session, difficulty: value.difficulty, rounds: { ...session.rounds, [value.difficulty]: value } });
  }
  function start(difficulty: Difficulty, restart = false) {
    const saved = session.rounds[difficulty];
    saveRound(!restart && saved && !saved.finished ? saved : newRound(bank, difficulty));
    setChoosing(false);
    lock.current = false;
    needsFocus.current = true;
  }
  function chooseAnswer(id: string) {
    if (!round || !question || lock.current || round.selected !== null || round.finished) return;
    lock.current = true;
    let best = records[round.difficulty];
    try { best = Math.max(best, Math.floor(getGameScore(scoreKey(round.difficulty)).bestScore / 10)); }
    catch { setStorageFailed(true); }
    const next = answer(round, question, id, best);
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
    if (!round || latestRound.current !== round || round.finished || round.selected === null) return;
    saveRound(nextQuestion(round, bank));
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
        {(["easy", "hard"] as const).map((difficulty, i) => <button type="button" className="trivia-mode" key={difficulty} onClick={() => start(difficulty)}>
          <span className="trivia-mode-top"><span aria-hidden="true">{i === 0 ? "01" : "02"}</span><small>{t.best}: {records[difficulty]}</small></span>
          <strong>{t[difficulty]}</strong>
          <span>{difficulty === "easy" ? t.easyDescription : t.hardDescription}</span>
          <b>{session.rounds[difficulty] && !session.rounds[difficulty]?.finished ? t.resume : t.start} <span aria-hidden="true">↗</span></b>
        </button>)}
      </div>
      <small className="trivia-save-note">{t.saved}</small>
    </section> : round.finished ? <section className="trivia-panel trivia-summary">
      <span className="trivia-kicker">{t[round.difficulty]} · {t.summary}</span>
      <h2 ref={focusTarget} tabIndex={-1}>{t.incorrect}</h2>
      <div className="trivia-final-streak"><strong>{round.streak}</strong><span>{t.streak}</span></div>
      {round.points > 0 && <p className="trivia-record">↗ {t.newBest}</p>}
      <dl className="trivia-summary-stats">
        <div><dt>{t.points}</dt><dd>+{round.points}</dd></div>
        <div><dt>{t.answered}</dt><dd>{round.streak + 1}</dd></div>
        <div><dt>{t.accuracy}</dt><dd>{Math.round(round.streak / (round.streak + 1) * 100)}%</dd></div>
      </dl>
      <div className="trivia-recap">
        <p>{question.prompt[locale]}</p>
        <span>{t.rightAnswer}</span>
        <strong>✓ {question.options.find(o => o.id === question.correctOptionId)!.text[locale]}</strong>
        <small>{question.explanation[locale]}</small>
        <a href={question.source} target="_blank" rel="noreferrer">{t.source} ↗</a>
      </div>
      <div className="trivia-actions"><button type="button" className="btn btn-primary" onClick={() => start(round.difficulty, true)}>{t.again}</button><button type="button" className="trivia-text-button" onClick={() => { setChoosing(true); needsFocus.current = true; }}>{t.change}</button></div>
    </section> : <section className="trivia-panel trivia-round">
      <div className="trivia-round-top"><span className="trivia-kicker">{t[round.difficulty]}</span><button type="button" className="trivia-text-button" onClick={() => { setChoosing(true); needsFocus.current = true; }}>{t.change}</button></div>
      <dl className="trivia-scoreboard"><div><dt>{t.streak}</dt><dd>{round.streak}<span aria-hidden="true"> ↗</span></dd></div><div><dt>{t.best}</dt><dd>{records[round.difficulty]}</dd></div><div><dt>{t.points}</dt><dd>+{round.points}</dd></div></dl>
      <div className="trivia-question-meta"><span>{question.category[locale]}</span><span>{t.question} {round.streak + (round.selected ? 0 : 1)}</span></div>
      <h2 ref={focusTarget} tabIndex={-1} id="trivia-question">{question.prompt[locale]}</h2>
      <div className="trivia-options" role="group" aria-labelledby="trivia-question">
        {round.optionOrder.map((id, i) => {
          const option = question.options.find(o => o.id === id)!;
          const correct = round.selected !== null && id === question.correctOptionId;
          return <button type="button" key={id} disabled={round.selected !== null} className={`trivia-option${correct ? " is-correct" : ""}`} onClick={() => chooseAnswer(id)}>
            <span className="trivia-option-letter" aria-hidden="true">{String.fromCharCode(65 + i)}</span><span>{option.text[locale]}</span>{correct && <span className="trivia-option-check" aria-label={t.correct}>✓</span>}
          </button>;
        })}
      </div>
      <div className="trivia-feedback" aria-live="polite" aria-atomic="true">
        {round.selected !== null && <><div><strong>✓ {t.correct}{round.lastAward > 0 ? ` · +${round.lastAward}` : ""}</strong><p>{question.explanation[locale]}</p></div><button type="button" className="btn btn-primary" onClick={advance}>{t.next} <span aria-hidden="true">→</span></button></>}
      </div>
    </section>}
    <details className="trivia-rules"><summary>{t.rules}</summary><p>{t.rulesText}</p><p>{t.cycle}</p></details>
  </div>;
}
