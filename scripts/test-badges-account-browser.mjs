import {createCareer} from '../lib/career/engine.ts';
import {candidates,solve} from '../lib/football-grid/engine.ts';
import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createTestDatabase,TEST_USER,OTHER_USER} from './lib/football-grid-test-db.mjs';
const base=process.env.BADGES_TEST_URL??'http://localhost:3211';
const endpoint=process.env.NEXT_PUBLIC_SUPABASE_URL;
if(!endpoint)throw new Error('Run with --env-file=.env.local (public configuration only).');
const storageKey='sb-'+new URL(endpoint).hostname.split('.')[0]+'-auth-token';
const bank=JSON.parse(readFileSync('data/connections/puzzles.json','utf8'));
const {db,asUser,rpc}=await createTestDatabase();
await db.exec(readFileSync('supabase/migrations/20260916_016_collectible_badges.sql','utf8'));
const players=['ALPHA','BRAVO','CHARLIE','DELTA','ECHO','FOXTROT','GOLF','HOTEL','INDIA','JULIET','KILO','LIMA'].map((name,i)=>({id:i<10?1000+i:i===10?5:6,display_name:name,game_name:name,last_name:name,is_active:true,is_retired:false,is_legend:true,photo_url:null,primary_position:'Attacker'}));
const clubs=[{id:1,name:'Barcelona',badge_url:null,is_national_team:false,is_easy_player_pool:true,is_hard_player_pool:true,is_active:true,is_game_eligible:true,countries:{name:'Spain'}}];
const browser=await chromium.launch({channel:'msedge',headless:true});const errors=[];
async function openAccount(uid){
 const user={id:uid,aud:'authenticated',role:'authenticated',email:'badge-test@example.invalid',app_metadata:{provider:'google',providers:['google']},user_metadata:{},created_at:'2026-09-01T00:00:00Z'};
 const expires=Math.floor(Date.now()/1000)+3600;
 const token=Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url')+'.'+Buffer.from(JSON.stringify({sub:uid,exp:expires,aud:'authenticated',role:'authenticated'})).toString('base64url')+'.test';
 const context=await browser.newContext({viewport:{width:1280,height:900}});
 await context.addInitScript(({storageKey,user,token,expires})=>{if(!sessionStorage.getItem('test-auth-seeded')){localStorage.setItem(storageKey,JSON.stringify({access_token:token,refresh_token:'test-only',token_type:'bearer',expires_at:expires,expires_in:3600,user}));sessionStorage.setItem('test-auth-seeded','1');}},{storageKey,user,token,expires});
 await context.route('https://**/*',route=>route.abort());
 // All Supabase calls are intercepted: no remote writes are possible in this test.
 await context.route(endpoint+'/**',async route=>{
  const path=new URL(route.request().url()).pathname;
  try{
   let value;
   if(path.endsWith('/auth/v1/user'))value=user;
   else if(path.endsWith('/auth/v1/logout')){await route.fulfill({status:204});return;}
   else if(path.endsWith('/rpc/sync_own_badges'))value=(await asUser('select sync_own_badges($1::jsonb) as value',[JSON.stringify(route.request().postDataJSON().p_facts)],uid)).rows[0].value;
   else if(path.endsWith('/rpc/football_grid_play'))value=await rpc(route.request().postDataJSON(),uid);
   else if(path.endsWith('/players'))value=players;
   else if(path.endsWith('/clubs'))value=clubs;
   else if(path.endsWith('/player_club_seasons'))value=players.map(p=>({player_id:p.id,club_id:1,is_current:true,season_start_year:2025}));
   else if(path.endsWith('/player_season_stats'))value=[{player_id:5,club_id:1,season_start_year:2020,appearances:30,goals:5},{player_id:6,club_id:1,season_start_year:2020,appearances:30,goals:20}];
   else if(path.endsWith('/profiles'))value={username:'BadgeTester',display_name:'Badge Tester',avatar_url:null,avatar_club_id:null,username_changed_at:null,created_at:'2026-09-01T00:00:00Z',last_seen_at:null};
   else value=[];
   await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(value)});
  }catch(error){errors.push(error.message);await route.fulfill({status:500,contentType:'application/json',body:JSON.stringify({message:'test backend failed'})});}
 });
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));return{context,page};
}
try{
 const a=await openAccount(TEST_USER);let page=a.page;
 await page.goto(base+'/es/usuario');await page.getByText('Colección sincronizada con tu cuenta.',{exact:true}).waitFor();assert.equal(await page.locator('.collectible-card.is-earned').count(),0);assert.equal(await page.locator('.user-achievements').count(),0);await page.locator('[data-badge-id="player.collection"]').click();await page.locator('.badge-detail-dialog[open]').waitFor();assert.ok((await page.locator('.badge-detail-dialog').innerText()).includes('25 jugadores distintos'));await page.keyboard.press('Escape');await page.screenshot({path:'tmp/badges/compact-account.png',fullPage:true});
 await page.goto(base+'/es/juegos/conexiones');await page.locator('.connections-grid button').first().waitFor();
 const s=await page.evaluate(()=>JSON.parse(sessionStorage.getItem('10tg-game-session-v1:conexiones')).value),p=bank.find(p=>p.id===s.puzzleId);
 await page.evaluate(({s,p})=>sessionStorage.setItem('10tg-game-session-v1:conexiones',JSON.stringify({version:1,value:{...s,solved:p.groups.slice(0,3).map(g=>g.id),selected:[]}})),{s,p});await page.reload();for(const button of await page.locator('.connections-grid button').all())await button.click();await page.getByRole('button',{name:'Comprobar grupo',exact:true}).click();await page.getByText('Guardado en tu colección.',{exact:true}).waitFor();
 const saved=await asUser('select badge_id from user_badges',[],TEST_USER);assert.deepEqual(saved.rows.map(x=>x.badge_id).sort(),['connections.first','connections.perfect']);await a.context.close();
 // A separate browser context has no local badge cache: results come from SQL.
 const a2=await openAccount(TEST_USER);page=a2.page;await page.goto(base+'/es/usuario');await page.getByText('Colección sincronizada con tu cuenta.',{exact:true}).waitFor();assert.equal(await page.locator('.collectible-card.is-earned').count(),2);assert.equal(await page.locator('.badge-award-dialog[open]').count(),0);
 await page.getByRole('button',{name:'CERRAR SESIÓN',exact:true}).click();await page.locator('.user-login').waitFor();assert.equal(await page.locator('.collectible-card.is-earned').count(),0);
 const b=await openAccount(OTHER_USER);await b.page.goto(base+'/es/usuario');await b.page.getByText('Colección sincronizada con tu cuenta.',{exact:true}).waitFor();assert.equal(await b.page.locator('.collectible-card.is-earned').count(),0);
 const rest=await openAccount(TEST_USER);page=rest.page;
 const closeNotice=async()=>{await page.getByText('Guardado en tu colección.',{exact:true}).waitFor();await page.locator('.badge-award-dialog').getByRole('button',{name:'Seguir jugando',exact:true}).click();};
 await page.goto(base+'/es/juegos/adivina-jugador');await page.locator('.wordle-keyboard').waitFor();
 const session=await page.evaluate(()=>JSON.parse(sessionStorage.getItem('10tg-game-session-v1:adivina-jugador')).value);
 const target=players.find(p=>p.id===session.rounds[session.difficulty].targetId);
 for(const letter of target.game_name)await page.locator('.wordle-keyboard').getByRole('button',{name:letter,exact:true}).click();
 await page.locator('.wordle-keyboard').getByRole('button',{name:'✓',exact:true}).click();await closeNotice();
 await page.goto(base+'/es/juegos/mayor-o-menor');await page.locator('.hl-higher').waitFor();
 for(let i=0;i<20;i++){
  const state=await page.evaluate(()=>JSON.parse(sessionStorage.getItem('10tg-game-session-v1:mayor-o-menor')).value);
  await page.locator(state.rightKey.startsWith('6:')?'.hl-higher':'.hl-lower').click();
  if(i===4||i===19)await closeNotice();
  if(i<19)await page.locator('.hl-button').filter({hasText:/Siguiente/}).click();
 }
 const club={id:'academy',name:'Academy',country:'España',level:52,academyQuality:90,youthOpportunity:90,squadCompetition:70,sellingProfile:80,prestige:'standard',leagueBand:'europe_2'};
 const career=createCareer({name:'Test Career',shirtNumber:10,nationality:'España',position:'attacking_midfielder',seed:42,club,year:2026});career.player.age=32;
 await page.evaluate(career=>localStorage.setItem('10tg-career-v2',JSON.stringify({schemaVersion:2,savedAt:new Date().toISOString(),value:career})),career);
 await page.goto(base+'/es/juegos/carrera');await page.getByRole('button',{name:'Retirarme',exact:true}).click();await closeNotice();
 await page.goto(base+'/es/juegos/football-grid');await page.locator('.fg-modes button').first().click();await page.locator('.fg-cell').first().waitFor();
 const grid=await rpc({},TEST_USER);const catalog=JSON.parse(readFileSync('data/football-grid/catalog.json','utf8'));const solution=solve(candidates(grid.round.board,catalog.players));
 for(let cell=0;cell<16;cell++){await page.locator('.fg-cell').nth(cell).click();await page.locator('#fg-search').fill(catalog.players.find(p=>p.id===solution[cell]).name);await page.locator('#fg-option-'+solution[cell]).click();}
 await closeNotice();
 const earned=(await asUser('select badge_id from user_badges',[],TEST_USER)).rows.map(r=>r.badge_id);
 for(const id of ['player.first','player.perfect','higher.first','higher.perfect','career.first','grid.first','grid.perfect'])assert.ok(earned.includes(id),id);
 assert.deepEqual(errors,[]);console.log('PASS: authenticated browser → SQL, all remaining games including 16/16 Grid, new-device restore, sign-out and account isolation. No remote writes.');
}finally{await browser.close();await db.close();}
