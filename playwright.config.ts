import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/browser",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  workers: 1,
  use: {
    channel: "msedge",
    headless: true,
    serviceWorkers: "block",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: [
    { command: "npm run dev -- --port 3100", url: "http://localhost:3100/es", timeout: 120_000,
      env: { ADS_MODE: "preview", ADS_VERIFICATION_ENABLED: "false" }, reuseExistingServer: false },
    { command: "npm run start -- --port 3101", url: "http://localhost:3101/es", timeout: 120_000, reuseExistingServer: false },
  ],
});
