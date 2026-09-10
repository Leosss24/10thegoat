import test from "node:test";
import assert from "node:assert/strict";
import { adsTxt, getAdsConfig, isProductionOrigin, placements } from "../lib/ads/config.ts";
import { mayRequestAds, type ConsentData } from "../lib/ads/consent.ts";

const production = {
  ADS_MODE: "live", NODE_ENV: "production", ADS_DEPLOYMENT: "production",
  ADS_CMP_READY: "true", ADSENSE_CLIENT_ID: "ca-pub-1234567890123456",
  ADS_SLOT_HOME_TOP: "1234567890",
};

test("ads fail closed without explicit deployment and CMP setup", () => {
  assert.equal(getAdsConfig({}).mode, "off");
  assert.equal(getAdsConfig(production).mode, "live");
  for (const [key, value] of Object.entries({ NODE_ENV: "development", ADS_DEPLOYMENT: "preview", ADS_CMP_READY: "false", ADSENSE_CLIENT_ID: "invalid", VERCEL_ENV: "preview", ADS_MODE: "unknown" })) {
    assert.equal(getAdsConfig({ ...production, [key]: value }).mode, "off", key);
  }
  assert.equal(getAdsConfig({ ...production, ADS_MODE: "preview" }).mode, "preview");
});

test("only the two HTTPS production origins can load the vendor", () => {
  for (const origin of ["https://10thegoat.com", "https://www.10thegoat.com"]) assert.equal(isProductionOrigin(origin), true);
  for (const origin of ["http://10thegoat.com", "https://10thegoat.com:3000", "https://preview.10thegoat.com", "https://10thegoat.com.evil.test", "http://localhost:3000", "https://10thegoat.vercel.app"]) assert.equal(isProductionOrigin(origin), false);
});

test("ad slots are explicit, validated and never fabricated", () => {
  assert.equal(placements.length, 6);
  assert.deepEqual(getAdsConfig({ ...production, ADS_SLOT_GAME_TOP: '" onload="bad' }).slots, { "home-top": "1234567890" });
});

test("ads.txt requires explicit verification and never publishes placeholders", () => {
  assert.equal(adsTxt(production), null);
  assert.equal(adsTxt({ ...production, ADS_VERIFICATION_ENABLED: "true" }), "google.com, pub-1234567890123456, DIRECT, f08c47fec0942fa0\n");
  assert.equal(adsTxt({ ADS_VERIFICATION_ENABLED: "true", ADSENSE_CLIENT_ID: "ca-pub-REPLACE_ME" }), null);
});

const accepted: ConsentData = { cmpStatus: "loaded", gdprApplies: true, eventStatus: "useractioncomplete", purpose: { consents: { 1: true } }, vendor: { consents: { 755: true } } };

test("consent errors, unknown geography and unfinished dialogs cannot request ads", () => {
  assert.equal(mayRequestAds(undefined, true), false);
  assert.equal(mayRequestAds(accepted, false), false);
  for (const data of [{}, { ...accepted, cmpStatus: "error" }, { ...accepted, gdprApplies: undefined }, { ...accepted, eventStatus: "cmpuishown" }]) assert.equal(mayRequestAds(data, true), false);
});

test("rejection and withdrawal stop ad requests; Google still evaluates all other purposes", () => {
  assert.equal(mayRequestAds(accepted, true), true);
  assert.equal(mayRequestAds({ ...accepted, eventStatus: "tcloaded" }, true), true);
  assert.equal(mayRequestAds({ ...accepted, purpose: { consents: { 1: false } } }, true), false);
  assert.equal(mayRequestAds({ ...accepted, vendor: { consents: { 755: false } } }, true), false);
  assert.equal(mayRequestAds({ cmpStatus: "loaded", gdprApplies: false, eventStatus: "tcloaded" }, true), true);
});
