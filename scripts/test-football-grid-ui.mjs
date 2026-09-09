import assert from 'node:assert/strict';
import { readFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createTestDatabase, TEST_USER } from './lib/football-grid-test-db.mjs';
import { candidates, solve } from '../lib/football-grid/engine.ts';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.GRID_PLAYWRIGHT_MODULE||'playwright');
const base=process.env.GRID_BASE_URL||'http://localhost:3108';
const catalog=JSON.parse(readFileSync('data/football-grid/catalog.json','utf8'));
const {db,rpc}=await createTestDatabase();
const browser=await chromium.launch({headless:true,channel:process.env.GRID_BROWSER_CHANNEL||'msedge'});
mkdirSync('tmp',{recursive:true});
const errors=[];
let failNetwork=false;
try{
  const context=await browser.newContext({viewport:{width:1440,height:1100}});
  const session={access_token:`${Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url')}.${Buffer.from(JSON.stringify({sub:TEST_USER,exp:Math.floor(Date.now()/1000)+3600,role:'authenticated'})).toString('base64url')}.test`,refresh_token:'test',expires_at:Math.floor(Date.now()/1000)+3600,expires_in:3600,token_type:'bearer',user:{id:TEST_USER,aud:'authenticated',role:'authenticated',email:'grid-test@example.invalid',app_metadata:{},user_metadata:{},created_at:new Date().toISOString()}};
  // Capture the configured project host from requests; session key is supplied by
  // the test environment without printing credentials or contacting Supabase.
  const project=new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname.split('.')[0];
  await context.addInitScript(({session,key})=>localStorage.setItem(key,JSON.stringify(session)),{session,key:`sb-${project}-auth-token`});
  await context.route('**/rest/v1/rpc/football_grid_play',async route=>{
    if(failNetwork){await route.abort();return;}
    try{const result=await rpc(route.request().postDataJSON()||{});await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(result)});}
    catch(e){await route.fulfill({status:400,contentType:'application/json',body:JSON.stringify({message:e.message,code:'TEST_SQL_ERROR'})});}
  });
  await context.route('**/auth/v1/**',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(session.user)}));
  await context.route('**/rest/v1/football_grid_catalogs*',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({payload:catalog})}));
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  const fits=async()=>assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'horizontal overflow');
  const state=(mode='easy')=>rpc({p_difficulty:mode});
  await page.goto(`${base}/es/juegos/football-grid`);await page.locator('.fg-mode .fg-primary').first().waitFor();
  await page.screenshot({path:'tmp/grid-desktop-intro.png',fullPage:true});
  await page.locator('.fg-mode .fg-primary').first().evaluate(b=>{b.click();b.click();});
  await page.locator('.fg-cell').first().waitFor();let initial=await state();assert.equal(initial.stats.played,0);
  assert.equal(await page.locator('.fg-cell').count(),16);
  assert.equal(await page.getByRole('timer').count(),0);
  const initialPoints=Number((await page.locator('.fg-time strong').innerText()).replace(/[^0-9]/g,''));
  assert.ok(initialPoints>4900&&initialPoints<=5000);
  await page.waitForTimeout(1200);
  assert.ok(Number((await page.locator('.fg-time strong').innerText()).replace(/[^0-9]/g,''))<initialPoints);
  assert.equal(Date.parse(initial.round.expires_at)-Date.parse(initial.round.started_at),600000);
  const solution=solve(candidates(initial.round.board,catalog.players));
  async function fill(cell,id){
    await page.locator('.fg-cell').nth(cell).click();await page.locator('#fg-search').fill(catalog.players.find(p=>p.id===id).name);
    await page.locator(`#fg-option-${id}`).click();await page.locator('dialog').waitFor({state:'hidden'});
  }
  // Wrong answer keeps the round, cell and clock; no attempt cap.
  const wrong=catalog.players.find(p=>!candidates(initial.round.board,[p])[0].length);
  await page.locator('.fg-cell').first().click();await page.locator('#fg-search').fill(wrong.name);
  await page.locator(`#fg-option-${wrong.id}`).click();await page.locator('.fg-search-feedback').filter({hasText:'Ese jugador no cumple las dos condiciones.'}).waitFor();
  assert.equal((await state()).round.answers[0],null);await page.keyboard.press('Escape');
  // Keyboard autocomplete, then cross-language restore.
  await page.locator('.fg-cell').first().focus();await page.keyboard.press('Enter');
  await page.locator('#fg-search').fill(catalog.players.find(p=>p.id===solution[0]).name);
  await page.keyboard.press('Enter');await page.locator('dialog').waitFor({state:'hidden'});
  assert.equal((await state()).round.answers[0],solution[0]);
  await page.getByRole('button',{name:'English',exact:true}).click();await page.waitForURL('**/en/juegos/football-grid');await page.locator('.fg-cell.is-solved').waitFor();
  assert.equal((await state()).round.id,initial.round.id);assert.equal((await state()).round.expires_at,initial.round.expires_at);
  await page.reload();await page.locator('.fg-cell.is-solved').waitFor();
  await page.getByRole('button',{name:'Français',exact:true}).click();await page.waitForURL('**/fr/juegos/football-grid');await page.locator('.fg-cell.is-solved').waitFor();
  await page.waitForFunction(()=>Array.from(document.querySelectorAll('.fg-axis img,.fg-cell.is-solved img')).every(img=>img.complete&&img.naturalWidth>0));
  await page.screenshot({path:'tmp/grid-desktop-round.png',fullPage:true});
  for(const width of [390,320]){await page.setViewportSize({width,height:900});await fits();await page.screenshot({path:`tmp/grid-mobile-${width}.png`,fullPage:true});}
  await page.locator('.fg-cell').nth(1).click();await page.locator('#fg-search').fill(catalog.players.find(p=>p.id===solution[1]).name);await page.screenshot({path:'tmp/grid-mobile-search.png',fullPage:true});await page.keyboard.press('Escape');
  // A second browser tab sees the same server round.
  const second=await context.newPage();await second.goto(`${base}/es/juegos/football-grid`);await second.locator('.fg-cell.is-solved').waitFor();assert.equal(await second.locator('.fg-cell.is-solved').count(),1);await second.close();
  for(let i=1;i<16;i++)await fill(i,solution[i]);
  await page.locator('.fg-summary.is-win').waitFor();const wonScore=(await state()).round.score;assert.ok(wonScore>0&&wonScore<=5000);assert.equal((await state()).stats.points,wonScore);assert.equal((await state()).used,1);
  assert.equal((await state()).stats.current_streak,1);assert.ok((await state()).stats.best_time_ms>0);assert.equal(await page.locator('.fg-history li').count(),1);
  await page.screenshot({path:'tmp/grid-mobile-win.png',fullPage:true});
  // Retry/reload does not award the result again.
  await page.reload();await page.locator('.fg-summary.is-win').waitFor();assert.equal((await state()).stats.points,wonScore);
  await page.getByRole('button',{name:'Nouvelle partie',exact:true}).click();await page.locator('.fg-cell:not([disabled])').first().waitFor();
  await page.getByRole('button',{name:/Abandonner ·/}).click();await page.getByRole('button',{name:'Oui, abandonner'}).click();await page.locator('.fg-summary').waitFor();
  assert.equal((await state()).stats.points,wonScore-20);assert.equal((await state()).used,1);
  // Server expiry survives navigation, with no surrender loophole.
  for(let i=0;i<2;i++){
    await page.getByRole('button',{name:'Nouvelle partie',exact:true}).click();await page.locator('.fg-cell:not([disabled])').first().waitFor();
    const current=await state();await db.query("update football_grid_rounds set expires_at=now()-interval '1 second' where id=$1",[current.round.id]);
    await page.reload();await page.getByRole('heading',{name:'Temps écoulé',exact:true}).waitFor();
  }
  assert.equal((await state()).used,3);assert.ok(await page.locator('.fg-summary button').isDisabled());
  await page.getByRole('button',{name:'Changer de mode',exact:true}).click();await page.locator('.fg-mode .fg-primary').nth(1).click();await page.locator('.fg-cell').first().waitFor();
  const hard=await state('hard');assert.equal(Date.parse(hard.round.expires_at)-Date.parse(hard.round.started_at),600000);
  await page.setViewportSize({width:1440,height:1100});await fits();await page.screenshot({path:'tmp/grid-desktop-hard.png',fullPage:true});
  // A transient error can recover the same round without resetting its deadline.
  failNetwork=true;await page.reload();await page.locator('.fg-notice').waitFor();failNetwork=false;
  await page.getByRole('button',{name:'Réessayer',exact:true}).click();await page.locator('.fg-mode .fg-primary').nth(1).waitFor();
  await page.locator('.fg-mode .fg-primary').nth(1).click();await page.locator('.fg-cell').first().waitFor();assert.equal((await state('hard')).round.id,hard.round.id);
  assert.deepEqual(errors,[]);
  const guest=await browser.newContext();const guestPage=await guest.newPage();await guestPage.goto(`${base}/en/juegos/football-grid`);await guestPage.locator('.fg-login').waitFor();assert.equal(await guestPage.locator('.fg-cell').count(),0);await guest.close();
  console.log('PASS: real UI + migration SQL, desktop/390/320, ES/EN/FR, keyboard search, invalid answers, win, surrender, expiry, quota, reload, two tabs, network recovery, sign-in gate and screenshots.');
}finally{await browser.close();await db.close();}
