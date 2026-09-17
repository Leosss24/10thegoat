import {isReleased} from '../lib/trivia/challenge-schedule.ts';
import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const json=p=>JSON.parse(readFileSync(p,'utf8'));
const trivia=json('data/trivia/questions.json'),odd=json('data/odd-one-out/challenges.json'),connections=json('data/connections/puzzles.json'),timeline=json('data/timeline/challenges.json'),challenges=json('data/trivia/challenges.json'),clubs=json('data/badges/catalog.json').clubs;
const base=process.env.BADGES_TEST_URL??'http://localhost:3211';
const browser=await chromium.launch({channel:'msedge',headless:true});
const context=await browser.newContext({viewport:{width:390,height:844}});const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
// No third-party images are necessary to validate collectible logic.
await context.route('https://**/*',route=>route.abort());
const store=()=>page.evaluate(()=>JSON.parse(sessionStorage.getItem('10tg-badges-v1:guest'))?.state);
const session=key=>page.evaluate(key=>JSON.parse(sessionStorage.getItem('10tg-game-session-v1:'+key))?.value,key);
async function close(){if(await page.locator('.badge-award-dialog[open]').count())await page.locator('.badge-award-dialog').getByRole('button',{name:'Seguir jugando',exact:true}).click();}
async function notice(id){await page.locator('.badge-award-dialog[open]').waitFor();assert.ok((await store()).awards.some(a=>a.id===id));}
try{
 await page.goto(base+'/es/usuario');await page.locator('.collectible-card').last().waitFor();assert.equal(await page.locator('.collectible-card').count(),32);assert.equal(await page.locator('[data-badge-id^="challenge."][data-available="true"]').count(),challenges.challenges.filter(c=>isReleased(c.unlockWeek,challenges.launchDate,new Date())).length);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:'tmp/badges/collection-mobile.png',fullPage:true});
 await page.setViewportSize({width:1440,height:1000});await page.screenshot({path:'tmp/badges/collection-desktop.png',fullPage:true});
 await page.goto(base+'/es/juegos/trivia');await page.locator('.trivia-mode').first().click();
 for(let i=0;i<5;i++){const s=await session('trivia'),r=s.rounds[s.difficulty],q=trivia.find(q=>q.id===r.queue[r.index]);await page.locator('.trivia-options button').nth(r.optionOrder.indexOf(q.correctOptionId)).click();if(i<4)await page.locator('.trivia-feedback button').click();}
 await notice('trivia.easy');await close();await page.reload();assert.equal(await page.locator('.badge-award-dialog[open]').count(),0);
 // Perfect Connections: three saved solved groups, actual final group interaction.
 await page.goto(base+'/es/juegos/conexiones');await page.locator('.connections-grid button').first().waitFor();let s=await session('conexiones'),p=connections.find(p=>p.id===s.puzzleId);
 await page.evaluate(({s,p})=>sessionStorage.setItem('10tg-game-session-v1:conexiones',JSON.stringify({version:1,value:{...s,solved:p.groups.slice(0,3).map(g=>g.id),selected:[]}})),{s,p});await page.reload();for(const b of await page.locator('.connections-grid button').all())await b.click();await page.getByRole('button',{name:'Comprobar grupo',exact:true}).click();await notice('connections.perfect');assert.equal((await store()).awards.filter(a=>a.id.startsWith('connections.')).length,2);await page.screenshot({path:'tmp/badges/unlock-desktop.png'});await close();
 await page.goto(base+'/es/juegos/ordena-historia');await page.locator('.timeline-check').waitFor();
 for(let i=0;i<5;i++){const s=await session('ordena-historia'),c=timeline.find(c=>c.id===s.queue[s.index]);const order=[...c.events].sort((a,b)=>(a.date??`${a.year}-01-01`).localeCompare(b.date??`${b.year}-01-01`)).map(e=>e.id);await page.evaluate(({s,order})=>sessionStorage.setItem('10tg-game-session-v1:ordena-historia',JSON.stringify({version:1,value:{...s,order}})),{s,order});await page.reload();await page.getByRole('button',{name:'Comprobar orden',exact:true}).click();if(i===0){await notice('timeline.first');await close();}if(i<4)await page.getByRole('button',{name:/Siguiente historia/}).click();}
 await notice('timeline.perfect');await close();
 await page.goto(base+'/es/juegos/el-intruso');await page.locator('.odd-modes button').first().click();
 for(let i=0;i<10;i++){const s=await session('el-intruso'),r=s.rounds[s.difficulty],c=odd.find(c=>c.id===r.queue[r.index]);await page.locator('.odd-options button').nth(r.optionOrder.indexOf(c.oddOptionId)).click();if(i===0){await notice('odd.first');await close();}if(i<9)await page.locator('.odd-feedback button').click();}
 await notice('odd.perfect');await close();
 await page.goto(base+'/es/juegos/adivina-escudo');await page.locator('.badge-search input').waitFor();const b=await session('adivina-escudo'),club=clubs.find(c=>c.id===b.targetId);await page.locator('.badge-search input').fill(club.name);await page.locator('.badge-search button[type="submit"]').click();await notice('crest.first');await close();
 // Entire challenge through the real UI, then repeat-result/reload deduplication.
 const challenge=challenges.challenges[0];await page.goto(base+'/es/juegos/trivia/reto/'+challenge.id);
 for(let i=0;i<25;i++){const q=challenge.questions[i];await page.locator('.trivia-options').getByRole('button',{name:q.options.find(o=>o.id===q.correctOptionId).text.es,exact:true}).click();await page.getByRole('button',{name:i===24?'Ver resultado':'Siguiente pregunta',exact:true}).click();}
 await notice('challenge.mundiales-01');assert.ok((await store()).awards.find(a=>a.id==='challenge.mundiales-01').plenoAt);await page.setViewportSize({width:390,height:844});await page.screenshot({path:'tmp/badges/pleno-mobile.png'});await close();await page.reload();assert.equal(await page.locator('.badge-award-dialog[open]').count(),0);
 await page.goto(base+'/es/usuario');assert.ok(await page.locator('[data-badge-id="challenge.mundiales-01"]').textContent().then(s=>s.includes('Pleno')));assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 for(const locale of ['en','fr']){await page.goto(base+`/${locale}/usuario`);assert.equal(await page.locator('.collectible-card').count(),32);assert.ok(await page.locator('[data-badge-id="trivia.easy"]').textContent().then(s=>!s.includes('Calentamiento')));}
 assert.deepEqual(errors,[]);console.log('PASS: collection 32 badges, mobile/desktop, translations, six games, combined popup, Pleno and reload deduplication.');
}catch(error){await page.screenshot({path:'tmp/badges/browser-failure.png',fullPage:true});console.error(await page.locator('body').innerText());throw error;}finally{await browser.close();}
