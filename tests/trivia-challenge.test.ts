import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { answerChallenge, challengeScore, initialChallenge, isChallengeState } from "../lib/trivia/challenge.ts";
import type { ChallengeQuestion as Question } from "../lib/trivia/challenge.ts";
const catalog = JSON.parse(readFileSync(new URL("../data/trivia/challenges.json", import.meta.url), "utf8"));
const questions = catalog.challenges[0].questions as Question[];
test("challenge contains 25 complete translated questions", () => {
  assert.equal(questions.length, 25);
  assert.equal(new Set(questions.map(q => q.id)).size, 25);
  for (const q of questions) {
    assert.equal(new Set(q.options.map(o => o.id)).size, 4);
    assert.ok(q.options.some(o => o.id === q.correctOptionId));
    for (const locale of ["es", "en", "fr"] as const) {
      assert.ok(q.prompt[locale] && q.explanation[locale]);
      assert.ok(q.options.every(o => o.text[locale]));
    }
  }
});
test("mistakes continue, duplicate answers are ignored, progress survives serialization", () => {
  let state = initialChallenge;
  for (let i = 0; i < 25; i++) {
    const q = questions[i];
    const option = i % 2 ? q.correctOptionId : q.options.find(o => o.id !== q.correctOptionId)!.id;
    state = answerChallenge(state, questions, option);
    assert.equal(state.answers.length, i + 1);
    assert.equal(answerChallenge(state, questions, option), state);
    assert.ok(isChallengeState(JSON.parse(JSON.stringify(state)), questions));
    state = { ...state, revealed: false };
  }
  assert.equal(challengeScore(state, questions), 12);
  assert.equal(answerChallenge(state, questions, "o1"), state);
});
test("invalid saves and options are rejected", () => {
  for (const state of [null, {}, { ...initialChallenge, attempt: 0 }, { ...initialChallenge, answers: ["invalid"] }, { ...initialChallenge, revealed: true }, { ...initialChallenge, answers: Array(26).fill("o1") }]) {
    assert.equal(isChallengeState(state, questions), false);
  }
  assert.equal(answerChallenge(initialChallenge, questions, "invalid"), initialChallenge);
});
