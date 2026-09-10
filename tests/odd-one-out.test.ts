import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { answerOdd, isOddSession, newOddRound, nextOdd, type OddChallenge, type OddSession } from "../lib/odd-one-out/engine.ts";

const bank = JSON.parse(readFileSync(new URL("../data/odd-one-out/challenges.json", import.meta.url), "utf8")) as OddChallenge[];
const session = (round: ReturnType<typeof newOddRound>): OddSession => ({ bankVersion: 1, difficulty: round.difficulty, rounds: { [round.difficulty]: round } });
const current = (round: ReturnType<typeof newOddRound>) => bank.find(item => item.id === round.queue[round.index])!;

test("bank has localized, unambiguous explanations for every challenge", () => {
  assert.ok(bank.length >= 12);
  assert.equal(new Set(bank.map(item => item.id)).size, bank.length);
  for (const item of bank) {
    assert.equal(item.options.length, 4);
    assert.equal(new Set(item.options.map(option => option.id)).size, 4);
    assert.equal(item.options.filter(option => option.id === item.oddOptionId).length, 1);
    assert.equal(new URL(item.source).protocol, "https:");
    for (const locale of ["es", "en", "fr"] as const) {
      assert.ok(item.category[locale].trim());
      assert.ok(item.commonReason[locale].length > 20);
      assert.ok(item.oddReason[locale].length > 20);
    }
  }
});

test("correct answers reveal the selection and only new records score", () => {
  let round = newOddRound(bank, "easy");
  let item = current(round);
  round = answerOdd(round, item, item.oddOptionId, 0);
  assert.equal(round.finished, false);
  assert.equal(round.streak, 1);
  assert.equal(round.points, 10);
  assert.equal(round.selected, item.oddOptionId);
  round = nextOdd(round, bank);
  item = current(round);
  round = answerOdd(round, item, item.oddOptionId, 3);
  assert.equal(round.points, 10);
  assert.equal(round.lastAward, 0);
});

test("a mistake ends the run without removing points and cannot be replayed", () => {
  let round = newOddRound(bank, "hard");
  let item = current(round);
  round = answerOdd(round, item, item.oddOptionId, 0);
  round = nextOdd(round, bank);
  item = current(round);
  const wrong = item.options.find(option => option.id !== item.oddOptionId)!.id;
  const ended = answerOdd(round, item, wrong, 1);
  assert.equal(ended.finished, true);
  assert.equal(ended.points, 10);
  assert.equal(ended.selected, wrong);
  assert.equal(answerOdd(ended, item, item.oddOptionId, 1), ended);
  assert.equal(nextOdd(ended, bank), ended);
  assert.ok(isOddSession(session(ended), bank));
});

test("serialized sessions preserve the challenge and option order across languages", () => {
  const round = newOddRound(bank, "easy");
  const restored = JSON.parse(JSON.stringify(session(round)));
  assert.ok(isOddSession(restored, bank));
  assert.deepEqual(restored.rounds.easy!.optionOrder, round.optionOrder);
  for (const patch of [{ points: -1 }, { queue: [] }, { optionOrder: ["x"] }, { selected: "missing" }, { finished: true }]) {
    const invalid: unknown = { ...restored, rounds: { easy: { ...restored.rounds.easy, ...patch } } };
    assert.equal(isOddSession(invalid, bank), false);
  }
});
