import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { candidates, matches, solve, searchPlayers, pointsAfter, RULES, type Catalog } from '../lib/football-grid/engine.ts';
import { gridCopy, positionCopy } from '../lib/football-grid/copy.ts';
const catalog = JSON.parse(readFileSync(new URL('../data/football-grid/catalog.json',import.meta.url),'utf8')) as Catalog;
const pool = JSON.parse(readFileSync(new URL('../data/football-grid/pool.json',import.meta.url),'utf8')) as {europeanClubs:{id:number}[];historicalClubs:{id:number}[];legendIds:number[];rosters:{club_id:number;player_ids:number[]}[]};

test('every 4×4 board has 16 distinct valid answers, with correct axes per mode',()=>{
  assert.ok(catalog.boards.length>=100);
  assert.equal(new Set(catalog.boards.map(b=>b.id)).size,catalog.boards.length);
  for(const board of catalog.boards){
    assert.equal(board.rows.length,4);assert.equal(board.columns.length,4);
    assert.equal(new Set(board.rows.map(a=>a.kind+a.id)).size,4);assert.equal(new Set(board.columns.map(a=>a.kind+a.id)).size,4);
    assert.ok(board.rows.every(a=>a.kind===(board.difficulty==='hard'?'club':'country')));
    assert.ok(board.columns.every(a=>a.kind===(board.variant==='country-position'?'position':'club')));
    if(board.difficulty==='hard')assert.ok(board.rows.every(a=>!board.columns.some(b=>b.id===a.id)));
    const solution=solve(candidates(board,catalog.players));assert.ok(solution,board.id);assert.equal(new Set(solution).size,16);
    solution.forEach((id,i)=>{const p=catalog.players.find(p=>p.id===id)!;assert.ok(matches(p,board.rows[Math.floor(i/4)])&&matches(p,board.columns[i%4]));});
  }
});
test('matching detects shared-player traps and supports fixed cells',()=>{
  assert.equal(solve([[1],[1]]),null);
  assert.deepEqual(solve([[1,2],[1]]),[2,1]);
  assert.equal(solve([[1,2],[1]],[1,null]),null);
  assert.deepEqual(solve([[1,2],[1]],[2,null]),[2,1]);
  assert.equal(solve([[1],[2]],[2,null]),null);
});
test('Dembélé is a valid distinct answer for PSG × Barcelona',()=>{
  const player=catalog.players.find(p=>p.id===1719)!;
  assert.ok(player);
  assert.ok(matches(player,{kind:'club',id:'3',name:'PSG'}));
  assert.ok(matches(player,{kind:'club',id:'4',name:'Barcelona'}));
});
test('catalog uses unique canonical identities, portraits and supported positions',()=>{
  assert.equal(new Set(catalog.players.map(p=>p.id)).size,catalog.players.length);
  assert.equal(catalog.players.filter(p=>p.legend).length,44);
  for(const p of catalog.players){assert.ok(p.name&&p.countryId);assert.equal(new URL(p.photo).protocol,'https:');assert.ok(p.position in positionCopy.es);assert.equal(new Set(p.clubIds).size,p.clubIds.length);}
});
test('only agreed legends or verified current European Premium/Elite squad members are playable',()=>{
  const european=new Set(pool.europeanClubs.map(c=>String(c.id))),historical=new Set(pool.historicalClubs.map(c=>String(c.id)));
  assert.equal(european.size,26);assert.equal(historical.size,45);
  for(const player of catalog.players){
    assert.equal(player.legend,pool.legendIds.includes(player.id));
    if(!player.legend)assert.ok(pool.rosters.some(r=>european.has(String(r.club_id))&&r.player_ids.includes(player.id)),player.name);
    assert.ok(player.clubIds.every(id=>historical.has(id)));
  }
  for(const board of catalog.boards){
    for(const axis of [...board.rows,...board.columns].filter(a=>a.kind==='club'))assert.ok((board.difficulty==='easy'?european:historical).has(axis.id));
  }
});
test('agreed Messi and Álvarez examples have official-match evidence; Miami is not an axis',()=>{
  const messi=catalog.players.find(p=>p.id===1)!;
  assert.ok(messi.legend);assert.ok(messi.clubIds.includes('4')&&messi.clubIds.includes('3'));
  const alvarez=catalog.players.find(p=>p.id===374)!;
  assert.ok(alvarez.currentClubIds?.includes('42'));
  assert.ok(['42','1780','19'].every(id=>alvarez.clubIds.includes(id)));
  assert.ok(catalog.boards.some(b=>b.difficulty==='hard'&&[...b.rows,...b.columns].some(a=>!pool.europeanClubs.some(c=>String(c.id)===a.id))));
});
test('autocomplete ignores accents, searches aliases and excludes used players',()=>{
  const player={...catalog.players[0],id:1,name:'Ángel Di María',aliases:['Angel di Maria']};
  assert.equal(searchPlayers([player],'angel maria',[])[0]?.id,1);
  assert.equal(searchPlayers([player],'ángel',[1]).length,0);
  assert.equal(searchPlayers([player],'',[]).length,0);
});
test('agreed rewards, surrender penalties and nonnegative balances',()=>{
  assert.deepEqual(RULES,{easy:{seconds:120,reward:100,surrender:20},hard:{seconds:90,reward:200,surrender:50}});
  assert.equal(pointsAfter(0,'easy','won'),100);assert.equal(pointsAfter(0,'hard','won'),200);
  assert.equal(pointsAfter(10,'easy','surrendered'),0);assert.equal(pointsAfter(20,'hard','surrendered'),0);
  assert.equal(pointsAfter(100,'easy','surrendered'),80);assert.equal(pointsAfter(200,'hard','surrendered'),150);
  assert.equal(pointsAfter(100,'hard','timeout'),100);
});
test('all UI messages and positions are present in ES/EN/FR',()=>{
  for(const locale of ['es','en','fr'] as const){assert.deepEqual(Object.keys(gridCopy[locale]),Object.keys(gridCopy.es));assert.ok(Object.values(gridCopy[locale]).every(text=>text.trim()));assert.equal(Object.keys(positionCopy[locale]).length,4);}
});
