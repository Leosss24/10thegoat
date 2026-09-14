import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { newTimeline, restoreTimeline, checkTimeline, nextTimeline, orderedEvents } from "../lib/timeline/engine.ts";
import type {TimelineChallenge} from "../lib/timeline/data.ts";
const bank=JSON.parse(readFileSync(new URL('../data/timeline/challenges.json',import.meta.url),'utf8')) as TimelineChallenge[];
test('100 distinct themed histories have five ordered dates and all three languages',()=>{
 assert.equal(bank.length,100);assert.equal(new Set(bank.map(c=>c.id)).size,100);assert.equal(new Set(bank.map(c=>c.events.map(e=>e.id).sort().join('|'))).size,100);
 for(const c of bank){assert.equal(c.events.length,5);assert.equal(new Set(c.events.map(e=>e.date??e.year)).size,5);assert.equal(new URL(c.source).protocol,'https:');for(const l of ['es','en','fr'] as const){assert.ok(c.title[l]);assert.ok(c.category[l]);assert.ok(c.explanation[l]);for(const e of c.events){assert.ok(e.text[l]);if(e.date){assert.equal(Number(e.date.slice(0,4)),e.year);assert.ok(Number.isFinite(Date.parse(e.date)));}}}}
});
test('histories in one season are scored by full date rather than year; checking cannot award twice',()=>{
 const c=bank.find(c=>c.events.every(e=>e.date))!;let s=newTimeline([c]);const correct=orderedEvents(c).map(e=>e.id);s={...s,order:correct};s=checkTimeline(s,[c]);assert.equal(s.score,100);assert.equal(checkTimeline(s,[c]),s);
 const wrong=checkTimeline({...s,checked:false,score:0,order:[...correct].reverse()},[c]);assert.equal(wrong.score,20);
});
test('a saved four-history queue retains its current order and gains the other 96 histories',()=>{
 const original=bank.slice(0,4);const s=newTimeline(original);const restored=restoreTimeline(s,bank)!;assert.ok(restored);assert.deepEqual(restored.order,s.order);assert.equal(restored.queue.length,100);assert.deepEqual(restored.queue.slice(0,4),s.queue);assert.equal(restoreTimeline({...s,checked:true,score:99},bank),null);
});
test('a full cycle never repeats a history and does not repeat at the cycle boundary',()=>{
 let s=newTimeline(bank);const seen=new Set<string>();for(let i=0;i<100;i++){assert.ok(!seen.has(s.queue[s.index]));seen.add(s.queue[s.index]);s=checkTimeline(s,bank);const previous=s.queue[s.index];s=nextTimeline(s,bank);assert.notEqual(s.queue[s.index],previous);}assert.equal(seen.size,100);
});
