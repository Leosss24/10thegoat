"use client";
import { recordBadgeFacts, badgeFact } from "../../lib/badges/client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useI18n } from "../I18nProvider";
import ChallengeShare from "./ChallengeShare";
import type { ChallengeQuestion as Question } from "../../lib/trivia/challenge";
import { answerChallenge, challengeCatalogPath, challengePathFor, challengeScore, initialChallenge, isChallengeState, type ChallengeState } from "../../lib/trivia/challenge";
import { challengeCopy } from "../../lib/trivia/challenge-copy";
import "./TriviaGame.css";

export default function TriviaChallenge({ id, version, title, questions }: { id: string; version: number; title: string; questions: Question[] }) {
  const storageKey = `10tg-challenge:${id}:v${version}`;
  const total = questions.length;
  const { locale } = useI18n();
  const t = challengeCopy[locale];
  const [state, setState] = useState<ChallengeState>(initialChallenge);
  const [best, setBest] = useState(0);
  const [ready, setReady] = useState(false);
  const [storageFailed, setStorageFailed] = useState(false);
  const current = useRef(state);
  const heading = useRef<HTMLHeadingElement>(null);
  const focusNext = useRef(false);
  const done = state.answers.length === questions.length && !state.revealed;
  const index = state.answers.length - Number(state.revealed);
  const question = questions[index];
  const score = challengeScore(state, questions);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || "null");
      if (saved?.version === 1 && isChallengeState(saved.state, questions)) {
        current.current = saved.state; setState(saved.state);
        if (Number.isInteger(saved.best) && saved.best >= 0 && saved.best <= questions.length) setBest(saved.best);
      }
    } catch { setStorageFailed(true); }
    setReady(true);
  }, [storageKey, questions]);

  useEffect(() => {
    if (focusNext.current) { heading.current?.focus(); focusNext.current = false; }
  }, [state]);

  function save(next: ChallengeState) {
    current.current = next;
    const nextBest = next.answers.length === questions.length ? Math.max(best, challengeScore(next, questions)) : best;
    setBest(nextBest); setState(next);
    try { localStorage.setItem(storageKey, JSON.stringify({ version: 1, state: next, best: nextBest })); }
    catch { setStorageFailed(true); }
  }
  function choose(option: string) {
    const next = answerChallenge(current.current, questions, option);
    if (next !== current.current) save(next);
  }
  const outcomes = state.answers.map((option, i) => option === questions[i].correctOptionId);
  let streak = 0, longest = 0;
  for (const correct of outcomes) { streak = correct ? streak + 1 : 0; longest = Math.max(longest, streak); }
  const shareText = `10theGOAT · ${title}\n${score}/${total} · ${t.streak}: ${longest} · ${t.attempt}: ${state.attempt}\n${outcomes.map(correct => correct ? "🟩" : "⬛").join("")}\n${t.invite}`;

  if (!ready) return <p role="status">{t.loading}</p>;
  return <div className="trivia">
    {storageFailed && <p className="trivia-storage" role="status">{t.storage}</p>}
    {done ? <section className="trivia-panel trivia-summary">
      <h2 ref={heading} tabIndex={-1}>{title}</h2>
      <div className="trivia-final-streak"><strong>{score}/{total}</strong><span>{t.score}</span></div>
      <p>{t.attempt}: {state.attempt} · {t.streak}: {longest} · {t.best}: {best}/{total}</p>
      <p className="challenge-outcomes" aria-hidden="true">{outcomes.map(correct => correct ? "🟩" : "⬛").join("")}</p>
      {score === total && <p className="trivia-record">🏅 {t.badge}</p>}
      <ChallengeShare title={title} text={shareText} path={`/${locale}${challengePathFor(id)}`} />
      <div className="trivia-actions">
        <button type="button" className="btn trivia-secondary" onClick={() => { focusNext.current = true; save({ ...initialChallenge, attempt: state.attempt + 1 }); }}>{t.again}</button>
        <Link className="btn trivia-secondary" href={`/${locale}${challengeCatalogPath}`}>{t.more}</Link>
      </div>
    </section> : <section className="trivia-panel trivia-round">
      <p className="trivia-kicker">{t.question} {index + 1}/{total} · {t.attempt} {state.attempt} · {t.score} {score}</p>
      <h2 ref={heading} tabIndex={-1}>{question.prompt[locale]}</h2>
      <div className="trivia-options">
        {question.options.map(option => <button type="button" className={`trivia-option${state.revealed && option.id === question.correctOptionId ? " is-correct" : ""}`} key={option.id} disabled={state.revealed} onClick={() => choose(option.id)}>{option.text[locale]}</button>)}
      </div>
      <div className="trivia-feedback" aria-live="polite">
        {state.revealed && <><div><strong>{state.answers[index] === question.correctOptionId ? t.correct : t.wrong}</strong><p>{question.options.find(option => option.id === question.correctOptionId)!.text[locale]} · {question.explanation[locale]}</p><a href={question.source} target="_blank" rel="noreferrer">{t.source} ↗</a></div><button type="button" className="btn btn-primary" onClick={() => { if (!current.current.revealed) return; focusNext.current = true; if(current.current.answers.length===total)recordBadgeFacts([badgeFact("challenge-"+id,challengeScore(current.current,questions))]); save({ ...current.current, revealed: false }); }}>{state.answers.length === total ? t.finish : t.next}</button></>}
      </div>
    </section>}
  </div>;
}
