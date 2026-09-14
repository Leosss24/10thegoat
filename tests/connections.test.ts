import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { newConnections, restoreConnections, selectConnection, checkConnection, nextConnections } from "../lib/connections/engine.ts";
import type { ConnectionPuzzle } from "../lib/connections/data.ts";
const read = (path: string) => JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8").replace(/^\uFEFF/, ""));
const bank = read("../data/connections/puzzles.json") as ConnectionPuzzle[];
const legacy = read("../data/connections/legacy.json") as ConnectionPuzzle[];
test("20 boards, 80 distinct relations, and canonical photographed players without overlapping board rules", () => {
  const identities = new Map<number, {display_name:string;photo_url:string}>(read("../data/players/catalog.json").players.map((p: {id:number}) => [p.id,p]));
  const relations = new Map<string, number[]>(read("../data/connections/relations.json").map((r: {id:string;playerIds:number[]}) => [r.id,r.playerIds]));
  assert.equal(bank.length,20);
  assert.equal(new Set(bank.flatMap(p=>p.groups.map(g=>g.id))).size,80);
  for(const p of bank){
    assert.equal(p.groups.length,4);assert.equal(new Set(p.groups.flatMap(g=>g.members.map(m=>m.id))).size,16);
    for(const g of p.groups){assert.equal(g.members.length,4);
      for(const m of g.members){const person=identities.get(m.playerId!);assert.ok(person);assert.equal(m.label,person.display_name.toUpperCase());assert.equal(m.photo_url,person.photo_url);assert.ok(m.photo_url?.startsWith('https://'));
        assert.deepEqual(p.groups.filter(other=>relations.get(other.id)!.includes(m.playerId!)).map(x=>x.id),[g.id]);}
      for(const l of ['es','en','fr'] as const){assert.ok(g.title[l]);assert.ok(g.reason[l].length>20);}
    }
  }
});
test("all twenty boards rotate once, then avoid an immediate repeat; scoring is idempotent",()=>{
  let state=newConnections(bank);const seen=new Set<string>();
  for(let i=0;i<20;i++){
    assert.ok(!seen.has(state.puzzleId));seen.add(state.puzzleId);const puzzle=bank.find(p=>p.id===state.puzzleId)!;
    for(const group of puzzle.groups){for(const m of group.members)state=selectConnection(state,puzzle,m.id);const result=checkConnection(state,puzzle);state=result.state;if(state.finished)assert.deepEqual(result.award,{score:400,won:true});}
    assert.equal(checkConnection(state,puzzle).award,null);const previous=state.puzzleId;state=nextConnections(state,bank);assert.notEqual(state.puzzleId,previous);
  }
  assert.equal(seen.size,20);
});
test("resume the original board and migrate queue without losing progress; reject corrupt saves",()=>{
  const p=legacy[0];const saved={version:1,puzzleId:p.id,order:p.groups.flatMap(g=>g.members.map(m=>m.id)),selected:[p.groups[1].members[0].id],solved:[p.groups[0].id],mistakes:3,finished:false,recorded:false};
  const restored=restoreConnections(saved,bank,legacy)!;assert.ok(restored);assert.equal(restored.puzzleId,p.id);assert.deepEqual(restored.selected,saved.selected);assert.equal(restored.queue.length,21);assert.deepEqual(restoreConnections(restored,bank,legacy),restored);
  for(const patch of [{selected:[saved.selected[0],saved.selected[0]]},{solved:[p.groups[0].id,p.groups[0].id]},{finished:true},{mistakes:-1},{selected:[p.groups[0].members[0].id]},{queue:['missing'],version:2,index:0}])assert.equal(restoreConnections({...saved,...patch},bank,legacy),null);
});
