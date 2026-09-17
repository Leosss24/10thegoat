import ts from 'typescript';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
const dir='tmp/badges/client-tests';mkdirSync(dir,{recursive:true});
for(const name of ['catalog','engine','client']){
 let source=readFileSync(`lib/badges/${name}.ts`,'utf8');
 source=source.replace("import raw from './catalog.json';",`const raw=${readFileSync('lib/badges/catalog.json','utf8')};`).replace("'../supabase'","'./supabase.mjs'").replace("'./catalog'","'./catalog.mjs'").replace("'./engine'","'./engine.mjs'");
 writeFileSync(`${dir}/${name}.mjs`,ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText);
}
writeFileSync(`${dir}/supabase.mjs`,`export const supabase={rpc:(...args)=>globalThis.rpcMock(...args)};`);
class Storage{items=new Map();getItem(k){return this.items.get(k)??null}setItem(k,v){this.items.set(k,v)}removeItem(k){this.items.delete(k)}}
globalThis.localStorage=new Storage();globalThis.sessionStorage=new Storage();
const c=await import(pathToFileURL(resolve(`${dir}/client.mjs`)));
const {applyFacts,emptyState}=await import(pathToFileURL(resolve(`${dir}/engine.mjs`)));
const {badges}=await import(pathToFileURL(resolve(`${dir}/catalog.mjs`)));
const servers=new Map();let account='A',offline=false,delayed;
globalThis.rpcMock=async(_name,{p_facts})=>{if(offline)return{error:{message:'offline'}};const owner=account;const state=applyFacts(servers.get(owner)??emptyState(),p_facts,badges);servers.set(owner,state);if(delayed)await delayed;return{data:state};};
const settle=()=>new Promise(resolve=>setTimeout(resolve,20));
c.setBadgeOwner('A');await settle();
c.recordBadgeFacts([c.badgeFact('players',1,'10')]);await settle();assert.equal(c.badgeSnapshot().status,'saved');assert.equal(c.badgeSnapshot().state.awards.length,1);assert.equal(c.badgeSnapshot().notices.length,1);c.dismissBadge('player.first');
c.recordBadgeFacts([c.badgeFact('players',1,'10')]);assert.equal(c.badgeSnapshot().notices.length,0);
offline=true;c.recordBadgeFacts([c.badgeFact('players',1,'20')]);await settle();assert.equal(c.badgeSnapshot().status,'error');assert.equal(JSON.parse(localStorage.getItem('10tg-badges-v1:A')).pending.length,1);
account='B';c.setBadgeOwner('B');await settle();assert.equal(c.badgeSnapshot().state.awards.length,0);assert.equal(c.badgeStreak('timeline',true),1);assert.equal(c.badgeStreak('timeline',false),0);assert.equal(c.badgeStreak('timeline',true),1);
account='A';c.setBadgeOwner('A');await settle();assert.equal(c.badgeSnapshot().state.facts.length,2);offline=false;await c.syncBadges();assert.equal(servers.get('A').facts.length,2);assert.equal(c.badgeSnapshot().status,'saved');assert.equal(JSON.parse(localStorage.getItem('10tg-badges-v1:A')).pending.length,0);
// Old account responses must never enter a newly selected account.
let release;delayed=new Promise(resolve=>release=resolve);const inFlight=c.syncBadges();account='B';c.setBadgeOwner('B');release();delayed=null;await inFlight;await settle();assert.equal(c.badgeSnapshot().owner,'B');assert.equal(c.badgeSnapshot().state.awards.length,0);
c.setBadgeOwner(null);c.recordBadgeFacts([c.badgeFact('player-perfect')]);assert.equal(c.badgeSnapshot().state.awards.length,1);account='C';c.setBadgeOwner('C');await settle();assert.equal(c.badgeSnapshot().state.awards.length,0);
// Grid can finish while an earlier background request is still in flight.
let releaseGrid;delayed=new Promise(resolve=>releaseGrid=resolve);const oldSync=c.syncBadges();
servers.set('C',applyFacts(servers.get('C'),[{metric:'grids',subject:'board-1',value:1}],badges));
await c.syncBadges(true);releaseGrid();delayed=null;await oldSync;await settle();
assert.ok(c.badgeSnapshot().notices.some(a=>a.id==='grid.first'));
c.dismissBadge('grid.first');
// Another tab contributes different content; unrelated accounts are ignored.
c.receiveBadgeStorage('10tg-badges-v1:C',JSON.stringify({state:{facts:[{metric:'players',subject:'77',value:1}]},pending:[{metric:'players',subject:'77',value:1}]}));
c.receiveBadgeStorage('10tg-badges-v1:D',JSON.stringify({state:{facts:[{metric:'players',subject:'88',value:1}]},pending:[]}));
await c.syncBadges();assert.ok(servers.get('C').facts.some(f=>f.subject==='77'));assert.ok(!c.badgeSnapshot().state.facts.some(f=>f.subject==='88'));
console.log('PASS: account isolation, offline retry, duplicate notices, delayed responses, Grid notification race, cross-tab merge, guest isolation and streak reset.');
