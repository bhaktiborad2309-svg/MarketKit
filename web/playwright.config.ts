import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests for the admin panel.
 *
 * These need the dev stack running — `make up` for the API, Mailhog and
 * Postgres, and `make seed-demo` for something to look at. Mailhog matters
 * because admin login is email-OTP: the test reads the code out of the inbox
 * exactly as scripts/smoke.sh does for the app.
 *
 * Run them with `npx playwright test`. They are deliberately not part of
 * `npm test` (vitest), which must stay runnable with nothing else up.
 */
export default defineConfig({
  testDir: "./e2e",
  // The OTP round-trip through Mailhog is slower than a normal assertion.
  timeout: 60_000,
  expect: { timeout: 15_000 },
  // Serial: these share one admin account, and logging in twice at once trips
  // the OTP rate limiter.
  workers: 1,
  fullyParallel: false,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: process.env.WEB_URL ?? "http://localhost:5173",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  // Start the dev server if it is not already up, so `make web-e2e` is one
  // command. Reused when you already have `npm run dev` running.
  webServer: {
    command: "npm run dev -- --port 5173 --strictPort",
    url: "http://localhost:5173",
    reuseExistingServer: true,
    timeout: 120_000,
  },
  projects: [
    // Logs in once and saves the session; everything else reuses it, so a run
    // costs one OTP rather than one per test.
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], storageState: "e2e/.auth/admin.json" },
      dependencies: ["setup"],
    },
  ],
});
