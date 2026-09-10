import { test, expect, type Page } from "@playwright/test";

const liveOrigin = "https://10thegoat.com";
const localLive = "http://localhost:3101";
const preview = "http://localhost:3100";

// Replaces the entire vendor response. No Google script or creative is fetched.
const fakeVendor = `
window.__adRequests = 0;
window.__revocations = 0;
const listeners = new Map(); let listenerId = 0;
window.__sendConsent = (consent) => listeners.forEach((cb, id) => cb({ listenerId: id, cmpStatus: 'loaded', gdprApplies: true, eventStatus: 'useractioncomplete', purpose: {consents: {1: consent}}, vendor: {consents: {755: consent}} }, true));
window.__tcfapi = (command, version, callback, id) => {
  if (command === 'removeEventListener') { listeners.delete(id); return; }
  listeners.set(++listenerId, callback);
  callback({ listenerId, cmpStatus: 'loaded', gdprApplies: true, eventStatus: 'cmpuishown' }, true);
};
const fc = window.googlefc || {callbackQueue: []};
const pending = [...fc.callbackQueue];
fc.showRevocationMessage = () => { window.__revocations++; window.__sendConsent(false); };
fc.callbackQueue = { push: entry => { if (typeof entry === 'function') entry(); else entry.CONSENT_API_READY?.(); } };
window.googlefc = fc;
pending.forEach(entry => fc.callbackQueue.push(entry));
window.adsbygoogle = { push: () => {
  window.__adRequests++;
  const ad = document.querySelector('ins.adsbygoogle:not([data-adsbygoogle-status])');
  if (!ad) throw new Error('Ad requested without an eligible slot');
  ad.dataset.adsbygoogleStatus = 'done';
  ad.dataset.adStatus = 'filled';
  ad.style.background = '#23394a';
  ad.textContent = 'SIMULATED AD';
} };
`;

async function protectNetwork(page: Page, vendor: "fake" | "blocked" = "blocked") {
  const requests: string[] = [];
  await page.route("**/*", async route => {
    const url = new URL(route.request().url());
    if (url.hostname === "10thegoat.com") {
      // Map the approved origin to the local fixture; never contact production.
      const response = await route.fetch({ url: `${localLive}${url.pathname}${url.search}`, maxRedirects: 0 });
      await route.fulfill({ response });
    } else if (url.hostname === "localhost") {
      await route.continue();
    } else {
      requests.push(url.href);
      if (vendor === "fake" && url.hostname === "pagead2.googlesyndication.com") await route.fulfill({ contentType: "application/javascript", body: fakeVendor });
      else await route.abort();
    }
  });
  return requests;
}

async function consent(page: Page, value: boolean) {
  await page.waitForFunction(() => typeof (window as unknown as { __sendConsent?: unknown }).__sendConsent === "function");
  await page.evaluate(value => (window as unknown as { __sendConsent: (value: boolean) => void }).__sendConsent(value), value);
}

async function adRequests(page: Page) {
  return page.evaluate(() => (window as unknown as { __adRequests: number }).__adRequests);
}

test("preview layouts fit ES/EN/FR on mobile and desktop without vendor traffic", async ({ page }) => {
  const external = await protectNetwork(page);
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const locale of ["es", "en", "fr"]) {
      for (const path of ["", "/juegos", "/juegos/trivia"]) {
        await page.goto(`${preview}/${locale}${path}`);
        await expect(page.locator('.ad-space[data-ad-mode="preview"]')).toHaveCount(2);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
        for (const frame of await page.locator(".ad-space-frame").all()) {
          const rect = await frame.boundingBox();
          expect(rect!.x).toBeGreaterThanOrEqual(0);
          expect(rect!.x + rect!.width).toBeLessThanOrEqual(width);
        }
      }
    }
    await page.screenshot({ path: `test-results/ads-preview-${width}.png`, fullPage: true });
  }
  expect(external.filter(url => /googlesyndication|doubleclick|fundingchoices|google-analytics/.test(url))).toEqual([]);
  expect(errors).toEqual([]);
});

test("all games have two separated slots; legal, account, beta and error routes have none", async ({ page }) => {
  await protectNetwork(page);
  await page.setViewportSize({ width: 390, height: 844 });
  for (const game of ["mayor-o-menor", "adivina-jugador", "adivina-escudo", "football-grid", "carrera", "trivia", "el-intruso", "conexiones", "ordena-historia"]) {
    await page.goto(`${preview}/es/juegos/${game}`);
    await expect(page.locator(".ad-space")).toHaveCount(2);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    expect(await page.locator(".ad-space").evaluateAll(ads => ads.every(ad => ad.querySelectorAll("button,input").length === 0))).toBe(true);
  }
  for (const path of ["privacidad", "cookies", "aviso-legal", "usuario", "beta", "juegos/mi-once", "missing-page"]) {
    await page.goto(`${preview}/fr/${path}`);
    await expect(page.locator(".ad-space")).toHaveCount(0);
  }
});

test("a live fixture on localhost still cannot load Google", async ({ page }) => {
  const requests = await protectNetwork(page, "fake");
  await page.goto(`${localLive}/es/juegos`);
  await page.getByRole("link", { name: "Cookies", exact: true }).click();
  await expect(page.locator("h1")).toContainText("Cookies");
  expect(requests.filter(url => /googlesyndication|doubleclick|fundingchoices/.test(url))).toEqual([]);
  await expect(page.locator("#adsense-bootstrap")).toHaveCount(0);
});

test("consent gates requests, below-fold slots are lazy and consent withdrawal removes ads", async ({ page }) => {
  const requests = await protectNetwork(page, "fake");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${liveOrigin}/es/juegos`);
  await page.waitForFunction(() => typeof (window as unknown as { __adRequests?: number }).__adRequests === "number");
  expect(await adRequests(page)).toBe(0);
  await consent(page, false);
  await expect(page.locator("ins.adsbygoogle")).toHaveCount(0);
  const before = await page.locator(".game-catalog-grid").boundingBox();
  await consent(page, true);
  await expect.poll(() => adRequests(page)).toBe(1);
  const after = await page.locator(".game-catalog-grid").boundingBox();
  expect(after!.y).toBe(before!.y);
  await page.locator('[data-placement="catalog-bottom"]').scrollIntoViewIfNeeded();
  await expect.poll(() => adRequests(page)).toBe(2);
  await page.getByRole("button", { name: "Preferencias de privacidad", exact: true }).click();
  await expect(page.locator("ins.adsbygoogle")).toHaveCount(0);
  expect(await page.evaluate(() => (window as unknown as { __revocations: number }).__revocations)).toBe(1);
  expect(await adRequests(page)).toBe(2);
  expect(requests.filter(url => url.includes("adsbygoogle.js"))).toHaveLength(1);
});

test("game interactions do not refresh ads and client navigation initializes a new slot", async ({ page }) => {
  await protectNetwork(page, "fake");
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`${liveOrigin}/en/juegos/trivia`);
  await consent(page, true);
  await expect.poll(() => adRequests(page)).toBeGreaterThan(0);
  const count = await adRequests(page);
  // Exercise a real game button, then elapsed time without refreshing ads.
  const firstMode = page.locator(".trivia-mode").first();
  await firstMode.click();
  await page.clock.install();
  await page.clock.fastForward(120_000);
  expect(await adRequests(page)).toBe(count);
  await page.getByRole("link", { name: "Games", exact: true }).click();
  await expect(page).toHaveURL(`${liveOrigin}/en/juegos`);
  await expect.poll(() => adRequests(page)).toBeGreaterThan(count);
});

test("blocked vendor leaves games usable and privacy failure is announced", async ({ page }) => {
  await protectNetwork(page);
  await page.goto(`${liveOrigin}/fr/juegos/trivia`);
  await page.locator(".trivia-mode").first().click();
  await expect(page.locator("ins.adsbygoogle")).toHaveCount(0);
  await page.getByRole("button", { name: "Préférences de confidentialité", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "indisponible" })).toBeVisible();
});
