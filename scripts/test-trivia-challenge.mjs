import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const catalog = JSON.parse(readFileSync('data/trivia/challenges.json','utf8'));
const questions = catalog.challenges[0].questions;
const browser = await chromium.launch({channel:'msedge',headless:true});
const context = await browser.newContext({viewport:{width:390,height:844}});
const page = await context.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
await context.addInitScript(() => {
  Object.defineProperty(navigator,'share',{value:undefined,configurable:true});
  Object.defineProperty(navigator,'clipboard',{value:{writeText:async text=>{window.sharedText=text;}},configurable:true});
});
const url = 'http://localhost:3210/es/juegos/trivia/reto/mundiales-01';
try {
  await page.goto('http://localhost:3210/es/juegos/trivia/retos');
  await page.locator('.challenge-catalog').waitFor();
  assert.equal(await page.locator('.challenge-card').count(),5);
  assert.equal(await page.locator('.challenge-card a').count(),1);
  assert.equal(await page.locator('.challenge-card button:disabled').count(),4);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.screenshot({path:'tmp/challenge-catalog-mobile.png',fullPage:true});
  await page.setViewportSize({width:1440,height:1000});
  await page.screenshot({path:'tmp/challenge-catalog-desktop.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});
  for(const challenge of catalog.challenges.slice(1)) {
    const response=await page.goto(`http://localhost:3210/es/juegos/trivia/reto/${challenge.id}`);
    assert.equal(response.status(),200);
    await page.getByRole('heading',{name:'Bloqueado',exact:true}).waitFor();
    assert.equal(await page.locator('.trivia-options').count(),0);
    const html=await response.text();
    assert.ok(!html.includes(challenge.questions[0].id),'locked questions leaked in HTML/RSC');
    assert.match(response.headers()['cache-control'],/no-store|private/);
  }
  await page.goto(url);
  await page.locator('.trivia-options button').first().waitFor();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth),true);
  for(let i=0;i<25;i++) {
    const correct=questions[i].options.find(o=>o.id===questions[i].correctOptionId).text.es;
    await page.locator('.trivia-options').getByRole('button',{name:correct,exact:true}).click();
    if(i===0) {
      await page.reload();
      await page.getByRole('button',{name:'Siguiente pregunta'}).waitFor();
      assert.equal(await page.locator('.trivia-options button:disabled').count(),4);
    }
    await page.getByRole('button',{name:i===24?'Ver resultado':'Siguiente pregunta',exact:true}).click();
  }
  if(await page.locator('.badge-award-dialog[open]').count())await page.locator('.badge-award-dialog').getByRole('button',{name:'Seguir jugando'}).click();
  await page.getByRole('button',{name:'Retar a un amigo'}).click();
  await page.getByText('Resultado copiado',{exact:true}).waitFor();
  const shared=await page.evaluate(()=>window.sharedText);
  assert.ok(shared.includes('25/25') && shared.includes('Intento: 1') && shared.endsWith(url));
  assert.ok(!shared.includes(questions[0].prompt.es));
  await page.screenshot({path:'tmp/challenge-mobile.png',fullPage:true});
  await page.reload();
  await page.getByRole('button',{name:'Repetir reto'}).click();
  await page.getByText(/Pregunta 1\/25 · Intento 2/).waitFor();
  for(const locale of ['en','fr']) {
    await page.goto(url.replace('/es/',`/${locale}/`));
    await page.locator('.trivia-options button').first().waitFor();
    assert.equal(await page.locator('html').getAttribute('lang'),locale);
    assert.equal(await page.locator('.trivia-round h2').textContent(),questions[0].prompt[locale]);
  }
  await page.goto('http://localhost:3210/es/juegos/trivia');
  await page.getByRole('link',{name:/Retos de Trivia/}).waitFor();
  await page.goto(url);
  await page.evaluate(() => {
    const key = '10tg-challenge:mundiales-01:v2';
    const saved = JSON.parse(localStorage.getItem(key));
    saved.state = {answers: Array(25).fill('o1'), revealed:false, attempt:2};
    localStorage.setItem(key,JSON.stringify(saved));
  });
  await page.reload();
  await page.evaluate(() => Object.defineProperty(navigator,'clipboard',{value:{writeText:async()=>{throw new Error('denied');}},configurable:true}));
  if(await page.locator('.badge-award-dialog[open]').count())await page.locator('.badge-award-dialog').getByRole('button',{name:'Seguir jugando'}).click();
  await page.getByRole('button',{name:'Retar a un amigo'}).click();
  await page.getByLabel('Copia este texto para compartir').waitFor();
  assert.ok((await page.getByRole('textbox').inputValue()).endsWith(url));
  await page.evaluate(() => Object.defineProperty(navigator,'share',{value:async()=>{throw new DOMException('cancelled','AbortError');},configurable:true}));
  if(await page.locator('.badge-award-dialog[open]').count())await page.locator('.badge-award-dialog').getByRole('button',{name:'Seguir jugando'}).click();
  await page.getByRole('button',{name:'Retar a un amigo'}).click();
  assert.equal(await page.getByRole('textbox').count(),0);
  assert.deepEqual(errors,[]);
  console.log('PASS: mobile, 25/25 result, copy URL, reload, replay, translated progress, Trivia entry, no browser errors');
} finally { await browser.close(); }
