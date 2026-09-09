import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createTestDatabase,TEST_USER} from './lib/football-grid-test-db.mjs';
import {candidates,solve} from '../lib/football-grid/engine.ts';
const catalog=JSON.parse(readFileSync('data/football-grid/catalog.json','utf8'));
const {db,rpc}=await createTestDatabase();let checks=0;
async function finishAt(id,elapsed,status='won'){
  await db.transaction(async tx=>{
    const moment=(await tx.query('select clock_timestamp()::text as moment')).rows[0].moment;
    await tx.query("update football_grid_rounds set started_at=$2::timestamptz-($3*interval '1 millisecond'),expires_at=$2::timestamptz+((600000-$3)*interval '1 millisecond') where id=$1",[id,moment,elapsed]);
    await tx.query('select football_grid_finish($1,$2,$3::timestamptz)',[id,status,moment]);
  });
}
try{
 for(const [elapsed,expected,streak] of [[120000,4000,1],[300000,2500,2],[60000,4500,3]]){
  const started=await rpc({p_action:'start'});await finishAt(started.round.id,elapsed);
  const state=await rpc({p_action:'answer',p_round:started.round.id,p_cell:0,p_player:1});assert.equal(state.round.score,expected);assert.equal(state.round.elapsed_ms,elapsed);assert.equal(state.stats.current_streak,streak);assert.equal(state.stats.best_streak,streak);checks++;
 }
 let state=await rpc();assert.equal(state.stats.points,11000);assert.equal(state.stats.best_time_ms,60000);assert.equal(state.history.length,3);assert.equal(state.history[0].streak_after,3);checks++;
 const other=await rpc({},'00000000-0000-4000-8000-000000000002');assert.equal(other.history.length,0);checks++;
 // Quota rollover does not reset a streak; a surrender does.
 await db.exec("update football_grid_rounds set day=day-1 where user_id='"+TEST_USER+"'");
 state=await rpc({p_action:'start'});assert.equal(state.used,0);assert.equal(state.stats.current_streak,3);
 state=await rpc({p_action:'surrender',p_round:state.round.id});assert.equal(state.stats.current_streak,0);assert.equal(state.stats.best_streak,3);assert.equal(state.stats.best_time_ms,60000);assert.equal(state.stats.points,10980);assert.equal(state.used,0);checks++;
 const again=await rpc({p_action:'surrender',p_round:state.round.id});assert.equal(again.stats.points,10980);assert.equal(again.history.length,4);checks++;
 state=await rpc({p_action:'start'});await finishAt(state.round.id,60000);state=await rpc();assert.equal(state.stats.current_streak,1);
 state=await rpc({p_action:'start'});await finishAt(state.round.id,600000);state=await rpc({p_action:'answer',p_round:state.round.id,p_cell:0,p_player:1});assert.equal(state.round.status,'timeout');assert.equal(state.round.score,0);assert.equal(state.stats.current_streak,0);assert.equal(state.stats.best_streak,3);checks++;
 // Independent accounts give exact deterministic boundary checks in both modes.
 let i=10;
 for(const mode of ['easy','hard'])for(const elapsed of [0,120000,300000,599999,600000,600001]){
  const uid='00000000-0000-4000-8000-'+String(i++).padStart(12,'0');await db.query('insert into auth.users(id) values ($1)',[uid]);
  state=await rpc({p_action:'start',p_difficulty:mode},uid);assert.equal(state.round.rules_version,2);assert.equal(Date.parse(state.round.expires_at)-Date.parse(state.round.started_at),600000);
  await finishAt(state.round.id,elapsed);state=await rpc({p_difficulty:mode},uid);
  assert.equal(state.round.score,Math.floor((mode==='easy'?5000:10000)*Math.max(0,600000-elapsed)/600000));
  assert.equal(state.round.status,elapsed>=600000?'timeout':'won');checks++;
 }
 // Migration is repeatable and never recalculates historic points.
 const before=await rpc();await db.exec(readFileSync('supabase/migrations/20260909_015_football_grid_scoring.sql','utf8'));state=await rpc();assert.equal(state.stats.points,before.stats.points);assert.equal(state.stats.best_time_ms,before.stats.best_time_ms);assert.equal(state.stats.best_streak,before.stats.best_streak);checks++;
}finally{await db.close();}
const legacy=await createTestDatabase({scoring:false});
try{
 async function complete(s){const solution=solve(candidates(s.round.board,catalog.players));for(let i=0;i<16;i++)s=await legacy.rpc({p_action:'answer',p_round:s.round.id,p_cell:i,p_player:solution[i]});return s;}
 let won=await complete(await legacy.rpc({p_action:'start'}));assert.equal(won.round.score,100);
 const old=await legacy.rpc({p_action:'start'});const expiry=old.round.expires_at;
 await legacy.db.exec(readFileSync('supabase/migrations/20260909_015_football_grid_scoring.sql','utf8'));
 let s=await legacy.rpc();assert.equal(s.round.rules_version,1);assert.equal(s.round.expires_at,expiry);assert.equal(s.stats.points,100);assert.equal(s.stats.current_streak,1);assert.ok(s.stats.best_time_ms>=0);checks++;
 s=await complete(s);assert.equal(s.round.score,100);assert.equal(s.stats.points,200);assert.equal(s.stats.current_streak,2);checks++;
 s=await legacy.rpc({p_action:'start'});assert.equal(s.round.rules_version,2);assert.equal(Date.parse(s.round.expires_at)-Date.parse(s.round.started_at),600000);checks++;
}finally{await legacy.db.close();}
console.log('PASS: '+checks+' scoring/history checks: proportional awards, boundaries, streak reset and rollover, records, history isolation, idempotency and legacy migration.');
