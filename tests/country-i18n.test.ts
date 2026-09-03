import test from "node:test";
import assert from "node:assert/strict";
import { translatedCountry } from "../lib/football/country-i18n.ts";

test("country names are localized for profile badges",()=>{
  assert.equal(translatedCountry("Spain","es"),"España");
  assert.equal(translatedCountry("Germany","fr"),"Allemagne");
  assert.equal(translatedCountry("Netherlands","en"),"Netherlands");
  assert.equal(translatedCountry("England","fr"),"Angleterre");
  assert.equal(translatedCountry("Wales","es"),"Gales");
});
