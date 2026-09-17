import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { isReleased, releaseDate, validDate } from "../lib/trivia/challenge-schedule.ts";
const catalog = JSON.parse(readFileSync(new URL("../data/trivia/challenges.json", import.meta.url), "utf8"));
test("launch defaults to only Mundiales, without advancing during preparation", () => {

  assert.deepEqual(catalog.challenges.map((c: {unlockWeek:number}) => isReleased(c.unlockWeek,null,new Date("2030-01-01T12:00:00Z"))),[true,false,false,false,false]);
});
test("production launch opens only Mundiales and schedules the next four Mondays", () => {
  assert.equal(catalog.launchDate,"2026-09-17");
  assert.deepEqual(catalog.challenges.map((c: {unlockWeek:number}) => isReleased(c.unlockWeek,catalog.launchDate,new Date("2026-09-17T10:00:00Z"))),[true,false,false,false,false]);
  assert.deepEqual([1,2,3,4].map(week=>releaseDate(catalog.launchDate,week)),["2026-09-21","2026-09-28","2026-10-05","2026-10-12"]);
});
test("weekly release starts on the Monday strictly after launch", () => {
  assert.equal(releaseDate("2026-09-15",1),"2026-09-21");
  assert.equal(releaseDate("2026-09-15",4),"2026-10-12");
  assert.equal(releaseDate("2026-09-21",1),"2026-09-28");
  assert.equal(releaseDate("2026-09-20",1),"2026-09-21");
  assert.equal(releaseDate("2026-12-28",1),"2027-01-04");
});
test("Madrid midnight gates the next challenge and keeps later weeks locked", () => {
  assert.equal(isReleased(1,"2026-09-15",new Date("2026-09-20T21:59:59Z")),false);
  assert.equal(isReleased(1,"2026-09-15",new Date("2026-09-20T22:00:00Z")),true);
  assert.equal(isReleased(2,"2026-09-15",new Date("2026-09-20T22:00:00Z")),false);
  assert.equal(isReleased(4,"2026-09-15",new Date("2027-01-01T00:00:00Z")),true);
});
test("spring and autumn daylight saving transitions use Madrid calendar dates", () => {
  assert.equal(isReleased(1,"2026-03-23",new Date("2026-03-29T21:59:59Z")),false);
  assert.equal(isReleased(1,"2026-03-23",new Date("2026-03-29T22:00:00Z")),true);
  assert.equal(isReleased(1,"2026-10-19",new Date("2026-10-25T22:59:59Z")),false);
  assert.equal(isReleased(1,"2026-10-19",new Date("2026-10-25T23:00:00Z")),true);
});
test("invalid launch dates fail closed for future challenges", () => {
  for(const date of ["", "2026-02-30", "2026-09-15T00:00:00Z", "15/09/2026", "invalid"]) {
    assert.equal(validDate(date),false);
    assert.equal(isReleased(1,date,new Date()),false);
  }
  assert.equal(validDate("2024-02-29"),true);
});
test("catalog has five independent, translated 25-question editions with sources", () => {
  assert.equal(catalog.challenges.length,5);
  const questionIds = new Set();
  for(const [week,c] of catalog.challenges.entries()) {
    assert.equal(c.unlockWeek,week);
    assert.equal(c.questions.length,25);
    assert.ok(c.version > 1);
    const prompts = {es:new Set(),en:new Set(),fr:new Set()};
    for(const q of c.questions) {
      assert.ok(!questionIds.has(q.id)); questionIds.add(q.id);
      assert.ok(["medium","hard"].includes(q.difficulty));
      assert.equal(q.options.length,4);
      assert.equal(q.options.filter((o: {id:string}) => o.id===q.correctOptionId).length,1);
      assert.equal(new URL(q.source).protocol,"https:");
      for(const locale of ["es","en","fr"] as const) {
        assert.ok(c.title[locale] && c.description[locale]);
        assert.ok(q.prompt[locale].length>30 && q.explanation[locale].length>20);
        assert.ok(!prompts[locale].has(q.prompt[locale])); prompts[locale].add(q.prompt[locale]);
        assert.equal(new Set(q.options.map((o: {text:Record<string,string>})=>o.text[locale])).size,4);
      }
    }
  }
  assert.equal(questionIds.size,125);
});
