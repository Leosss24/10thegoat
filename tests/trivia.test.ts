import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { answer, isTriviaSession, newRound, nextQuestion, type Question, type TriviaSession } from "../lib/trivia/engine.ts";

const bank = JSON.parse(readFileSync(new URL("../data/trivia/questions.json", import.meta.url), "utf8")) as Question[];
const session = (round: ReturnType<typeof newRound>): TriviaSession => ({ bankVersion: 1, difficulty: round.difficulty, rounds: { [round.difficulty]: round } });
const current = (round: ReturnType<typeof newRound>) => bank.find(q => q.id === round.queue[round.index])!;

test("trivia bank contains 200 unique, fully localized questions per difficulty with four distinct options and a source", () => {
  assert.equal(bank.length, 400);
  assert.equal(new Set(bank.map(q => q.id)).size, 400);
  for (const difficulty of ["easy", "hard"]) assert.equal(bank.filter(q => q.difficulty === difficulty).length, 200);
  for (const locale of ["es", "en", "fr"] as const) {
    assert.equal(new Set(bank.map(q => q.prompt[locale])).size, 400);
    for (const q of bank) {
      assert.ok(q.prompt[locale].length > 10, q.id);
      assert.ok(q.category[locale].length > 0 && q.explanation[locale].length > 10, q.id);
      assert.equal(q.options.length, 4, q.id);
      assert.equal(new Set(q.options.map(o => o.id)).size, 4, q.id);
      assert.equal(new Set(q.options.map(o => o.text[locale].trim())).size, 4, q.id);
      assert.ok(q.options.every(o => o.text[locale].trim()), q.id);
      assert.equal(q.options.filter(o => o.id === q.correctOptionId).length, 1, q.id);
      assert.equal(new URL(q.source).protocol, "https:");
    }
  }
});

test("new records award streak × 10; earlier streaks award nothing", () => {
  let round = newRound(bank, "easy");
  for (let i = 1; i <= 6; i++) {
    const q = current(round);
    round = answer(round, q, q.correctOptionId, Math.max(3, i - 1));
    assert.equal(round.lastAward, i > 3 ? i * 10 : 0);
    assert.equal(round.streak, i);
    assert.ok(isTriviaSession(session(round), bank));
    if (i < 6) round = nextQuestion(round, bank);
  }
  assert.equal(round.points, 150);
});

test("first mistake ends the game without subtracting earned points", () => {
  let round = newRound(bank, "hard");
  let q = current(round);
  round = nextQuestion(answer(round, q, q.correctOptionId, 0), bank);
  q = current(round);
  round = answer(round, q, q.options.find(o => o.id !== q.correctOptionId)!.id, 1);
  assert.equal(round.finished, true);
  assert.equal(round.streak, 1);
  assert.equal(round.points, 10);
  assert.equal(round.lastAward, 0);
  assert.equal(nextQuestion(round, bank), round);
  assert.equal(answer(round, q, q.correctOptionId, 1), round);
  assert.ok(isTriviaSession(session(round), bank));
});

test("invalid, stale and repeated answers cannot score", () => {
  const round = newRound(bank, "easy"), q = current(round);
  assert.equal(answer(round, q, "invalid", 0), round);
  assert.equal(answer(round, bank.find(x => x.id !== q.id)!, "o1", 0), round);
  assert.equal(nextQuestion(round, bank), round);
  const result = answer(round, q, q.correctOptionId, 0);
  assert.equal(answer(result, q, q.correctOptionId, 0), result);
  assert.equal(result.points, 10);
});

test("200 correct answers do not end a game or repeat questions within a cycle", () => {
  let round = newRound(bank, "easy");
  const seen = new Set<string>();
  for (let i = 0; i < 200; i++) {
    const q = current(round);
    assert.ok(!seen.has(q.id)); seen.add(q.id);
    round = answer(round, q, q.correctOptionId, i);
    assert.ok(isTriviaSession(session(round), bank));
    round = nextQuestion(round, bank);
    assert.ok(isTriviaSession(session(round), bank));
    if (i === 199) assert.notEqual(current(round).id, q.id);
  }
  assert.equal(round.finished, false);
  assert.equal(round.streak, 200);
  assert.equal(round.index, 0);
  assert.equal(round.points, 201000);
});

test("serialized rounds preserve question and option order across languages and difficulties", () => {
  const easy = newRound(bank, "easy"), hard = newRound(bank, "hard");
  const q = current(easy);
  const value: TriviaSession = { bankVersion: 1, difficulty: "hard", rounds: { easy: answer(easy, q, q.correctOptionId, 0), hard } };
  const restored = JSON.parse(JSON.stringify(value));
  assert.ok(isTriviaSession(restored, bank));
  assert.deepEqual(restored, value);
  restored.difficulty = "easy";
  assert.ok(isTriviaSession(restored, bank));
  assert.deepEqual(restored.rounds.hard, hard);
});

test("corrupt, negative, stale-bank and contradictory saved states are rejected", () => {
  const value = session(newRound(bank, "easy"));
  for (const invalid of [null, {}, { ...value, bankVersion: 2 }, { ...value, difficulty: "impossible" }, { ...value, rounds: {} }]) assert.equal(isTriviaSession(invalid, bank), false);
  for (const patch of [{ streak: -1 }, { points: -20 }, { index: 200 }, { selected: "missing" }, { finished: true }, { queue: [] }, { queue: Array(200).fill("easy-001") }, { optionOrder: ["o1", "o1", "o2", "o3"] }, { lastAward: 10 }, { streak: 1 }]) {
    const invalid = { ...value, rounds: { easy: { ...value.rounds.easy, ...patch } } };
    assert.equal(isTriviaSession(invalid, bank), false, JSON.stringify(patch));
  }
});

test("bank expansion preserves existing games and uses all new questions on restart", () => {
  const previousBank = bank.filter(q => Number(q.id.split("-")[1]) <= 100);
  let round = newRound(previousBank, "hard");
  for (let i = 0; i < 101; i++) {
    const q = current(round);
    round = answer(round, q, q.correctOptionId, i);
    const restored = JSON.parse(JSON.stringify(session(round)));
    assert.ok(isTriviaSession(restored, bank));
    assert.equal(answer(restored.rounds.hard!, q, q.correctOptionId, i), restored.rounds.hard);
    round = nextQuestion(round, bank);
    assert.ok(isTriviaSession(session(round), bank));
    assert.equal(round.queue.length, 100);
  }
  assert.equal(round.streak, 101);
  const fresh = newRound(bank, "hard");
  assert.equal(fresh.queue.length, 200);
  assert.ok(fresh.queue.includes("hard-200"));
  const removed = previousBank.filter(q => q.id !== round.queue[0]);
  assert.equal(isTriviaSession(session(round), removed), false);
});
