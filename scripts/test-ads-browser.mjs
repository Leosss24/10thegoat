import { spawnSync } from "node:child_process";

// Fictional identifiers are only used behind Playwright's network interception.
// Localhost cannot load Google even though this fixture is built in live mode.
const env = {
  ...process.env, ADS_MODE: "live", ADS_DEPLOYMENT: "production", ADS_CMP_READY: "true",
  ADSENSE_CLIENT_ID: "ca-pub-1234567890123456", ADS_VERIFICATION_ENABLED: "true",
  VERCEL_ENV: "production",
};
for (const name of ["HOME_TOP", "HOME_BOTTOM", "CATALOG_TOP", "CATALOG_BOTTOM", "GAME_TOP", "GAME_BOTTOM"]) env[`ADS_SLOT_${name}`] = "1234567890";
function run(file, args, overrides = {}) {
  const result = spawnSync(process.execPath, [file, ...args], { env: { ...env, ...overrides }, stdio: "inherit" });
  return result.status ?? 1;
}
let status = run("node_modules/next/dist/bin/next", ["build"]);
if (status === 0) status = run("node_modules/@playwright/test/cli.js", ["test", ...process.argv.slice(2)]);
// Always replace the fixture build with an inert build before returning.
const cleanupStatus = run("node_modules/next/dist/bin/next", ["build"], { ADS_MODE: "off", ADS_VERIFICATION_ENABLED: "false" });
process.exitCode = status || cleanupStatus;
