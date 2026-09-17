import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createTestDatabase,TEST_USER,OTHER_USER} from './lib/football-grid-test-db.mjs';
import {candidates,solve} from '../lib/football-grid/engine.ts';
import {applyFacts,emptyState} from '../lib/badges/engine.ts';
const migration=readFileSync('supabase/migrations/20260916_016_collectible_badges.sql','utf8');
const rules=JSON.parse(readFileSync('lib/badges/catalog.json','utf8'));
const {db,asUser,rpc}=await createTestDatabase();
const sync=async(facts=[],user=TEST_USER)=>(await asUser('select sync_own_badges($1::jsonb) as value',[JSON.stringify(facts)],user)).rows[0].value;
try{
 await db.exec(migration);await db.exec(migration);
 assert.equal((await sync()).awards.length,0);
 await assert.rejects(()=>sync([],null));await assert.rejects(()=>sync([{metric:'grids',subject:'forged',value:1}]));
 await assert.rejects(()=>sync([{metric:'players',subject:'x',value:25}]));await assert.rejects(()=>sync([{metric:'fake',subject:'best',value:1}]));
 const facts=[];for(const b of rules){if(b.metric.startsWith('grid'))continue;const unique=['players','careers','higher-correct','clubs','odd-rounds','connections','timelines'].includes(b.metric);if(unique)for(let i=0;i<b.target;i++)facts.push({metric:b.metric,subject:String(i),value:1});else facts.push({metric:b.metric,subject:'best',value:b.challengeId?25:b.target});}
 for(let i=0;i<facts.length;i+=100)await sync(facts.slice(i,i+100));
 const result=await sync();const expected=applyFacts(emptyState(),facts,rules);
 assert.deepEqual(result.awards.map(a=>a.id).sort(),expected.awards.map(a=>a.id).sort());
 assert.equal((await sync([],OTHER_USER)).awards.length,0);
 assert.equal((await asUser('select * from user_badges',[],OTHER_USER)).rows.length,0);
 await assert.rejects(()=>asUser("insert into user_badges(user_id,badge_id) values($1,'grid.perfect')",[TEST_USER]));
 await assert.rejects(()=>asUser('delete from user_badge_facts'));
 const saved=result.awards;await sync(facts.slice(0,100));assert.deepEqual((await sync()).awards,saved);
 const base=await sync([{metric:'challenge-mundiales-01',subject:'best',value:20}],OTHER_USER);assert.ok(!base.awards[0].plenoAt);
 const full=await sync([{metric:'challenge-mundiales-01',subject:'best',value:25}],OTHER_USER);assert.equal(full.awards[0].earnedAt,base.awards[0].earnedAt);assert.ok(full.awards[0].plenoAt);
 // An incorrect server-validated Grid answer must survive state reloads.
 let grid=await rpc({p_action:'start'});const round=grid.round;
 await rpc({p_action:'answer',p_round:round.id,p_cell:0,p_player:999999999});
 grid=await rpc();assert.equal(grid.round.badge_mistakes,1);
 const catalog=JSON.parse(readFileSync('data/football-grid/catalog.json','utf8'));
 const answer=solve(candidates(round.board,catalog.players));
 for(let cell=0;cell<16;cell++)grid=await rpc({p_action:'answer',p_round:round.id,p_cell:cell,p_player:answer[cell]});
 assert.equal(grid.round.status,'won');
 let awards=(await sync()).awards;assert.ok(awards.some(a=>a.id==='grid.first'));assert.ok(!awards.some(a=>a.id==='grid.perfect'));
 const second=await rpc({p_action:'start'});const solution=solve(candidates(second.round.board,catalog.players));
 for(let cell=0;cell<16;cell++)grid=await rpc({p_action:'answer',p_round:second.round.id,p_cell:cell,p_player:solution[cell]});
 assert.equal(grid.round.status,'won');assert.equal(grid.round.badge_mistakes,0);
 awards=(await sync()).awards;assert.ok(awards.some(a=>a.id==='grid.perfect'));
 await db.exec(migration);assert.deepEqual((await sync()).awards,awards);
 console.log('PASS: SQL thresholds, RLS, authentication, direct-write denial, duplicate retries, Pleno upgrade, Grid errors and migration rerun.');
}finally{await db.close();}
