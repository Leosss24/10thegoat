const { chromium } = require(process.env.TRIVIA_PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const bank = JSON.parse(fs.readFileSync('data/trivia/questions.json', 'utf8'));
const key = '10tg-game-session-v1:trivia';
const scoresKey = '10tg-game-scores-v1';
const base = process.env.TRIVIA_BASE_URL || 'http://localhost:3100';
fs.mkdirSync('tmp', { recursive: true });
(async () => {
  const browser = await chromium.launch({ headless: true, ...(process.env.TRIVIA_BROWSER_CHANNEL ? { channel: process.env.TRIVIA_BROWSER_CHANNEL } : {}) });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.clock.install();
    const read = () => page.evaluate(k => JSON.parse(sessionStorage.getItem(k)).value, key);
    const scores = () => page.evaluate(k => JSON.parse(localStorage.getItem(k)), scoresKey);
    async function respond(correct = true) {
      const r = (await read()).rounds.timed, q = bank.find(q => q.id === r.queue[r.index]);
      const id = correct ? q.correctOptionId : q.options.find(o => o.id !== q.correctOptionId).id;
      await page.locator('.trivia-option').nth(r.optionOrder.indexOf(id)).evaluate(b => { b.click(); b.click(); });
    }
    await page.goto(`${base}/es/juegos/trivia`);
    await page.locator('.trivia-mode').nth(2).waitFor();
    assert.equal(await page.locator('.trivia-save-note').count(), 0);
    assert.equal(await page.locator('.trivia-mode-top > span').count(), 0);
    for (const title of await page.locator('.trivia-mode > strong').all()) {
      assert.deepEqual(await title.evaluate(e => [getComputedStyle(e).textTransform, getComputedStyle(e).textAlign]), ['uppercase', 'center']);
    }
    assert.equal(await page.locator('.trivia-intro h2').evaluate(e => getComputedStyle(e).textTransform), 'uppercase');
    await page.screenshot({ path: 'tmp/trivia-timed-intro.png', fullPage: true });
    await page.locator('.trivia-mode').nth(2).click();
    const deadline = (await read()).rounds.timed.deadline;
    await respond();
    assert.equal((await read()).rounds.timed.streak, 1);
    await page.clock.runFor(700);
    assert.equal((await read()).rounds.timed.index, 1);
    await page.getByRole('button', { name: 'English' }).click();
    await page.waitForURL('**/en/juegos/trivia');
    await page.locator('.trivia-clock').waitFor();
    assert.equal((await read()).rounds.timed.deadline, deadline);
    await page.reload();
    await page.locator('.trivia-clock').waitFor();
    assert.equal((await read()).rounds.timed.deadline, deadline);
    await respond();
    await page.clock.runFor(700);
    assert.equal((await read()).rounds.timed.points, 30);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: 'tmp/trivia-timed-mobile.png', fullPage: true });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.clock.fastForward(61000);
    await page.locator('.trivia-summary').waitFor();
    for (const button of await page.locator('.trivia-actions button').all()) {
      assert.equal(await button.evaluate(e => getComputedStyle(e).textTransform), 'uppercase');
      assert.ok((await button.boundingBox()).height >= 44);
    }
    assert.equal((await read()).rounds.timed.timedOut, true);
    assert.equal(await page.locator('.trivia-summary h2').textContent(), 'Time’s up!');
    assert.equal(await page.locator('.trivia-summary-stats dd').nth(1).textContent(), '2');
    assert.equal(await page.locator('.trivia-summary-stats dd').nth(2).textContent(), '100%');
    const settled = await scores();
    assert.equal(settled['trivia-timed'].points, 30);
    assert.equal(settled['trivia-timed'].played, 1);
    await page.reload(); await page.locator('.trivia-summary').waitFor();
    assert.deepEqual(await scores(), settled);
    await page.screenshot({ path: 'tmp/trivia-timed-summary.png', fullPage: true });
    await page.getByRole('button', { name: 'Play again', exact: true }).click();
    for (let i = 0; i < 3; i++) { await respond(); await page.clock.runFor(700); }
    assert.equal((await read()).rounds.timed.points, 30, 'only the third correct answer beats record 2');
    await respond(false); await page.locator('.trivia-summary').waitFor();
    assert.equal((await read()).rounds.timed.timedOut, false);
    assert.equal((await scores())['trivia-timed'].points, 60);
    assert.equal((await scores())['trivia-timed'].played, 2);
    await page.getByRole('button', { name: 'Play again', exact: true }).click();
    await page.getByRole('button', { name: 'Change mode' }).click();
    await page.locator('.trivia-mode').first().click();
    await page.clock.fastForward(61000);
    assert.equal((await read()).difficulty, 'easy');
    assert.equal((await read()).rounds.timed.timedOut, true);
    assert.equal((await read()).rounds.easy.finished, false);
    assert.equal((await scores())['trivia-timed'].played, 3);
    // Expiration while the page is closed/reloaded, with no duplicate settlement.
    await page.getByRole('button', { name: 'Change mode' }).click();
    await page.locator('.trivia-mode').nth(2).click();
    await page.evaluate(k => { const s = JSON.parse(sessionStorage.getItem(k)); s.value.rounds.timed.deadline = Date.now() - 1000; sessionStorage.setItem(k, JSON.stringify(s)); }, key);
    await page.reload(); await page.locator('.trivia-summary').waitFor();
    assert.equal((await scores())['trivia-timed'].played, 4);
    assert.equal(await page.locator('.trivia-summary-stats dd').nth(1).textContent(), '0');
    await page.getByRole('button', { name: 'Français' }).click(); await page.waitForURL('**/fr/juegos/trivia');
    await page.locator('.trivia-summary').waitFor();
    assert.equal(await page.locator('.trivia-summary h2').textContent(), 'Temps écoulé !');
    assert.equal((await scores())['trivia-timed'].played, 4);
    await page.getByRole('button', { name: 'Changer de mode' }).click();
    await page.setViewportSize({ width: 320, height: 740 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    assert.deepEqual(errors, []);
    const colors = await browser.newPage();
    const fixed = new Date('2026-09-08T12:00:00Z');
    await colors.clock.install({ time: fixed });
    await colors.clock.pauseAt(new Date(fixed.getTime() + 1000));
    await colors.goto(`${base}/es/juegos/trivia`);
    await colors.locator('.trivia-mode').nth(2).click();
    for (const [advance, expected] of [[0, 'rgb(104, 224, 156)'], [15000, 'rgb(116, 189, 255)'], [15000, 'rgb(255, 216, 92)'], [10000, 'rgb(255, 159, 82)'], [10000, 'rgb(255, 102, 112)'], [5000, 'rgb(255, 102, 112)']]) {
      if (advance) await colors.clock.runFor(advance);
      assert.equal(await colors.locator('.trivia-clock strong').evaluate(e => getComputedStyle(e).color), expected);
      assert.equal(await colors.locator('.trivia-clock progress').evaluate(e => getComputedStyle(e).accentColor), expected);
    }
    await colors.close();
    console.log('PASS: timed mode, mixed bank, auto advance, double clicks, deadline, mistake, records, summaries, reload, languages, mode switching, mobile and typography.');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
