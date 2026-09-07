// Use an installed Playwright package, or point TRIVIA_PLAYWRIGHT_MODULE at one.
const { chromium } = require(process.env.TRIVIA_PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const bank = JSON.parse(fs.readFileSync('data/trivia/questions.json','utf8'));
const key='10tg-game-session-v1:trivia';
const base = process.env.TRIVIA_BASE_URL || 'http://localhost:3100';
fs.mkdirSync('tmp', { recursive: true });
(async()=>{
const browser=await chromium.launch({headless:true,...(process.env.TRIVIA_BROWSER_CHANNEL ? {channel:process.env.TRIVIA_BROWSER_CHANNEL} : {})});
try {
const context=await browser.newContext({viewport:{width:1440,height:1000}});
const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
const read=()=>page.evaluate(k=>JSON.parse(sessionStorage.getItem(k)).value,key);
async function option(correct=true){const s=await read(),r=s.rounds[s.difficulty],q=bank.find(q=>q.id===r.queue[r.index]);const id=correct?q.correctOptionId:q.options.find(o=>o.id!==q.correctOptionId).id;return page.locator('.trivia-option').nth(r.optionOrder.indexOf(id));}
async function fits(){assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'horizontal overflow');}
await page.goto(`${base}/es/juegos/trivia`);await page.locator('.trivia-mode').first().waitFor();
await page.screenshot({path:'tmp/trivia-desktop-start.png',fullPage:true});
await page.locator('.trivia-mode').first().click(); await page.locator('.trivia-option').first().waitFor();
const initial=await read();assert.equal(initial.difficulty,'easy');assert.equal(await page.locator('.trivia-option').count(),4);
await (await option()).evaluate(b=>{b.click();b.click()});
await page.getByRole('button',{name:'Siguiente pregunta'}).waitFor();
assert.equal((await read()).rounds.easy.points,10);
const scores=await page.evaluate(()=>JSON.parse(localStorage.getItem('10tg-game-scores-v1')));assert.equal(scores['trivia-easy'].points,10);
const answeredEasy = (await read()).rounds.easy;
await page.getByRole('button',{name:'English'}).click();await page.waitForURL('**/en/juegos/trivia');await page.getByRole('button',{name:'Next question'}).waitFor();
assert.deepEqual((await read()).rounds.easy,answeredEasy);
assert.equal((await read()).rounds.easy.queue[0],initial.rounds.easy.queue[0]);
await page.getByRole('button',{name:'Next question'}).evaluate(b=>{b.click();b.click()});
await page.locator('.trivia-option:not([disabled])').first().waitFor();assert.equal((await read()).rounds.easy.index,1);
await page.getByRole('button',{name:'Français'}).click();await page.waitForURL('**/fr/juegos/trivia');await page.locator('.trivia-option:not([disabled])').first().waitFor();
await page.screenshot({path:'tmp/trivia-desktop-question.png',fullPage:true});
const before=await read();await page.reload();await page.locator('.trivia-option:not([disabled])').first().waitFor();assert.deepEqual(await read(),before);
await page.getByRole('button',{name:'Changer de difficulté'}).click();await page.locator('.trivia-mode').nth(1).click();assert.equal((await read()).difficulty,'hard');
await page.getByRole('button',{name:'Changer de difficulté'}).click();await page.locator('.trivia-mode').first().click();assert.deepEqual((await read()).rounds.easy,before.rounds.easy);
await (await option(false)).click();await page.locator('.trivia-summary').waitFor();
let s=await read();assert.equal(s.rounds.easy.finished,true);assert.equal(s.rounds.easy.streak,1);assert.equal(s.rounds.easy.points,10);
assert.equal(await page.locator('.trivia-summary-stats dd').nth(2).textContent(),'50%');
const scored=await page.evaluate(()=>localStorage.getItem('10tg-game-scores-v1'));
await page.reload();await page.locator('.trivia-summary').waitFor();assert.equal(await page.evaluate(()=>localStorage.getItem('10tg-game-scores-v1')),scored);
await page.screenshot({path:'tmp/trivia-desktop-summary.png',fullPage:true});await fits();
await page.setViewportSize({width:390,height:844});await page.screenshot({path:'tmp/trivia-mobile-summary.png',fullPage:true});await fits();
await page.getByRole('button',{name:'Rejouer',exact:true}).click();await page.locator('.trivia-option').first().waitFor();
await page.screenshot({path:'tmp/trivia-mobile-question.png',fullPage:true});await fits();
await (await option()).click();assert.equal((await read()).rounds.easy.points,0,'previous best must not award points');
await page.getByRole('button',{name:'Question suivante'}).click();await (await option()).click();assert.equal((await read()).rounds.easy.points,20);
await page.getByRole('button',{name:'Changer de difficulté'}).click();await page.locator('.trivia-mode').nth(1).click();
await (await option()).click();assert.equal((await read()).rounds.hard.points,10,'hard record is independent');
await page.getByRole('button',{name:'Changer de difficulté'}).click();await page.setViewportSize({width:320,height:740});await fits();
await page.screenshot({path:'tmp/trivia-mobile-start.png',fullPage:true});
for(const locale of ['es','en','fr']){
 await page.goto(`${base}/${locale}/juegos`);assert.equal(await page.locator('a[href$="/juegos/trivia"]').count(),1);assert.equal(await page.locator('a[href$="/juegos/mi-once"]').count(),0);await fits();
 await page.goto(`${base}/${locale}`);assert.equal(await page.locator('.arena-portal--2').getAttribute('href'),`/${locale}/juegos/trivia`);assert.equal(await page.locator('a[href$="/juegos/mi-once"]').count(),0);
}
// Keyboard-only start and focus after advancing.
await page.goto(`${base}/en/juegos/trivia`);await page.locator('.trivia-option,.trivia-summary,.trivia-mode').first().waitFor();
await page.evaluate(k=>sessionStorage.setItem(k,'{broken'),key);await page.reload();await page.locator('.trivia-mode').first().waitFor();
await page.locator('.trivia-mode').first().focus();await page.keyboard.press('Enter');await page.locator('.trivia-option').first().waitFor();assert.equal(await page.locator('h2:focus').count(),1);
await page.setViewportSize({width:1440,height:1000});await fits();
// Blocked browser storage still permits an entire game.
const blocked=await browser.newContext();await blocked.addInitScript(()=>{Storage.prototype.setItem=function(){throw new DOMException('Blocked','SecurityError')};Storage.prototype.getItem=function(){throw new DOMException('Blocked','SecurityError')};});
const p=await blocked.newPage();p.on('pageerror',e=>errors.push(e.message));await p.goto(`${base}/en/juegos/trivia`);await p.locator('.trivia-mode').first().click();await p.locator('.trivia-storage').waitFor();
const prompt=await p.locator('#trivia-question').textContent();const q=bank.find(q=>q.prompt.en===prompt);const wrong=q.options.find(o=>o.id!==q.correctOptionId).text.en;
await p.getByRole('button',{name:new RegExp(wrong.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'))}).click();await p.locator('.trivia-summary').waitFor();
assert.deepEqual(errors,[]);console.log('PASS: desktop/mobile, ES/EN/FR, records, double clicks, reload, difficulty restore, summary, navigation, keyboard, corrupt/blocked storage.');
} finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exit(1)});
