"use client";
import { recordBadgeFacts, badgeFact } from "../../lib/badges/client";

import { useEffect, useRef, useState } from "react";
import { useI18n } from "../I18nProvider";
import challenges from "../../data/odd-one-out/challenges.json";
import { addGamePoints, getGameScore, recordGameResult } from "../../lib/game-scores";
import { answerOdd, isOddSession, newOddRound, nextOdd, type Difficulty, type OddChallenge, type OddRound, type OddSession } from "../../lib/odd-one-out/engine";
import { oddOneOutCopy } from "../../lib/odd-one-out/copy";
import "./OddOneOutGame.css";

const bank = challenges as OddChallenge[];
const SESSION_KEY = "10tg-game-session-v1:el-intruso";
const scoreKey = (difficulty: Difficulty) => `el-intruso-${difficulty}`;

export default function OddOneOutGame() {
  const { locale } = useI18n();
  const t = oddOneOutCopy[locale];
  const [session, setSession] = useState<OddSession>({ bankVersion: 1, difficulty: "easy", rounds: {} });
  const [choosing, setChoosing] = useState(true);
  const [ready, setReady] = useState(false);
  const [storageFailed, setStorageFailed] = useState(false);
  const [records, setRecords] = useState({ easy: 0, hard: 0 });
  const lock = useRef(false);
  const focusTarget = useRef<HTMLHeadingElement>(null);
  const needsFocus = useRef(false);
  const round = session.rounds[session.difficulty];
  const challenge = round ? bank.find(item => item.id === round.queue[round.index]) ?? null : null;

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        if (saved?.version === 1 && isOddSession(saved.value, bank)) {
          setSession(saved.value);
          setChoosing(false);
        }
      }
      setRecords({ easy: Math.floor(getGameScore(scoreKey("easy")).bestScore / 10), hard: Math.floor(getGameScore(scoreKey("hard")).bestScore / 10) });
    } catch { setStorageFailed(true); }
    setReady(true);
  }, []);

  useEffect(() => {
    if (needsFocus.current) { focusTarget.current?.focus(); needsFocus.current = false; }
  }, [session, choosing]);

  function save(value: OddSession) {
    try { sessionStorage.setItem(SESSION_KEY, JSON.stringify({ version: 1, value })); }
    catch { setStorageFailed(true); }
    setSession(value);
  }

  function saveRound(value: OddRound) {
    save({ ...session, difficulty: value.difficulty, rounds: { ...session.rounds, [value.difficulty]: value } });
  }

  function start(difficulty: Difficulty, restart = false) {
    const saved = session.rounds[difficulty];
    saveRound(!restart && saved && !saved.finished ? saved : newOddRound(bank, difficulty));
    setChoosing(false);
    lock.current = false;
    needsFocus.current = true;
  }

  function choose(optionId: string) {
    if (!round || !challenge || lock.current || round.selected !== null || round.finished) return;
    lock.current = true;
    let best = records[round.difficulty];
    try { best = Math.max(best, Math.floor(getGameScore(scoreKey(round.difficulty)).bestScore / 10)); }
    catch { setStorageFailed(true); }
    const next = answerOdd(round, challenge, optionId, best);
    if(optionId===challenge.oddOptionId)recordBadgeFacts([badgeFact("odd-rounds",1,challenge.id),badgeFact("odd-streak",next.streak)]);
    saveRound(next);
    try {
      if (next.lastAward) addGamePoints(scoreKey(round.difficulty), next.lastAward);
      if (next.finished) recordGameResult(scoreKey(round.difficulty), { score: 0, won: false });
    } catch { setStorageFailed(true); }
    setRecords(current => ({ ...current, [round.difficulty]: Math.max(best, next.streak) }));
    needsFocus.current = true;
  }

  function advance() {
    if (!round || round.finished || round.selected === null) return;
    saveRound(nextOdd(round, bank));
    lock.current = false;
    needsFocus.current = true;
  }

  if (!ready) return <div className="odd-panel" role="status">{t.loading}</div>;
  return <div className="odd-game">
    {storageFailed && <p className="odd-storage" role="status">{t.storage}</p>}
    {choosing || !round || !challenge ? <section className="odd-panel odd-intro">
      <span className="odd-kicker">10theGOAT · SPOT THE DIFFERENCE</span>
      <div className="odd-emblem" aria-hidden="true">4≠1</div>
      <h2 ref={focusTarget} tabIndex={-1}>{t.choose}</h2><p>{t.intro}</p>
      <div className="odd-modes">{(["easy", "hard"] as const).map(difficulty => <button type="button" key={difficulty} onClick={() => start(difficulty)}>
        <small>{t.best}: {records[difficulty]}</small><strong>{t[difficulty]}</strong><span>{difficulty === "easy" ? t.easyDescription : t.hardDescription}</span><b>{session.rounds[difficulty] && !session.rounds[difficulty]?.finished ? t.resume : t.start} →</b>
      </button>)}</div>
    </section> : round.finished ? <section className="odd-panel odd-summary">
      <span className="odd-kicker">{t[round.difficulty]} · {t.summary}</span>
      <h2 ref={focusTarget} tabIndex={-1}>{t.incorrect}</h2>
      <div className="odd-final"><strong>{round.streak}</strong><span>{t.streak}</span></div>
      <Explanation challenge={challenge} locale={locale} copy={t} />
      <div className="odd-actions"><button type="button" className="btn btn-primary" onClick={() => start(round.difficulty, true)}>{t.again}</button><button type="button" className="btn odd-secondary" onClick={() => setChoosing(true)}>{t.change}</button></div>
    </section> : <section className="odd-panel odd-round">
      <div className="odd-top"><span className="odd-kicker">{t[round.difficulty]}</span><button type="button" onClick={() => setChoosing(true)}>{t.change}</button></div>
      <dl className="odd-score"><div><dt>{t.streak}</dt><dd>{round.streak}</dd></div><div><dt>{t.best}</dt><dd>{records[round.difficulty]}</dd></div><div><dt>{t.points}</dt><dd>+{round.points}</dd></div></dl>
      <div className="odd-meta"><span>{challenge.category[locale]}</span><span>{t.challenge} {round.streak + (round.selected ? 0 : 1)}</span></div>
      <h2 ref={focusTarget} tabIndex={-1} id="odd-question">{t.question}</h2>
      <div className="odd-options" role="group" aria-labelledby="odd-question">{round.optionOrder.map(id => {
        const option = challenge.options.find(item => item.id === id)!;
        const revealed = round.selected !== null;
        const correct = revealed && id === challenge.oddOptionId;
        const chosenWrong = revealed && id === round.selected && id !== challenge.oddOptionId;
        return <button type="button" key={`${challenge.id}:${id}`} disabled={revealed} className={`odd-option${correct ? " is-odd" : ""}${chosenWrong ? " is-wrong" : ""}`} onClick={() => choose(id)}><span>{option.label}</span>{correct && <b aria-label={t.correct}>✓</b>}{chosenWrong && <b aria-label={t.incorrect}>×</b>}</button>;
      })}</div>
      <div className="odd-feedback" aria-live="polite" aria-atomic="true">{round.selected !== null && <><strong className={round.finished ? "is-wrong" : ""}>{round.finished ? t.incorrect : `${t.correct}${round.lastAward ? ` · +${round.lastAward}` : ""}`}</strong><Explanation challenge={challenge} locale={locale} copy={t} />{!round.finished && <button type="button" className="btn btn-primary" onClick={advance}>{t.next} →</button>}</>}</div>
    </section>}
    <details className="odd-rules"><summary>{t.rules}</summary><p>{t.rulesText}</p></details>
  </div>;
}

function Explanation({ challenge, locale, copy }: { challenge: OddChallenge; locale: "es"|"en"|"fr"; copy: typeof oddOneOutCopy.es | typeof oddOneOutCopy.en | typeof oddOneOutCopy.fr }) {
  const odd = challenge.options.find(option => option.id === challenge.oddOptionId)!;
  return <div className="odd-explanation"><div><span>{copy.connection}</span><p>{challenge.commonReason[locale]}</p></div><div><span>{copy.why}: <b>{odd.label}</b></span><p>{challenge.oddReason[locale]}</p></div><a href={challenge.source} target="_blank" rel="noreferrer">{copy.source} ↗</a></div>;
}
