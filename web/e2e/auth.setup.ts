import { test as setup, expect, type APIRequestContext } from "@playwright/test";

/**
 * Logs in once per run and saves the session for every other spec to reuse.
 *
 * This exists because admin login is email-OTP behind a rate limiter of five
 * sends per minute per IP. A spec that logged in per test would lock itself out
 * on the sixth test and fail for reasons that have nothing to do with the code
 * under test.
 *
 * Saving cookies is enough: the access token is deliberately held in memory
 * only, and the app bootstraps a fresh one from the httpOnly refresh cookie.
 */

// Must match the storageState path in playwright.config.ts.
const ADMIN_STORAGE_STATE = "e2e/.auth/admin.json";

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? "admin@example.com";
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? "";
const MAILHOG_URL = process.env.MAILHOG_URL ?? "http://localhost:8025";

/**
 * Pulls the newest six-digit login code for an address out of Mailhog.
 *
 * Polls because the API sends the mail from a background task, so it lands a
 * moment after the request that triggered it returns.
 */
async function readLatestOTP(request: APIRequestContext, email: string): Promise<string> {
  for (let attempt = 0; attempt < 20; attempt++) {
    const res = await request.get(
      `${MAILHOG_URL}/api/v2/search?kind=to&query=${encodeURIComponent(email)}&limit=20`
    );
    if (res.ok()) {
      const inbox = await res.json();
      for (const item of inbox.items ?? []) {
        const body: string = item?.Content?.Body ?? "";
        // Mailhog soft-wraps quoted-printable bodies; strip the wrap markers
        // before looking for the code or it can be split across lines.
        const match = /Your OTP is\s*(\d{6})/.exec(body.replace(/=\r?\n/g, ""));
        if (match) return match[1];
      }
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`no OTP for ${email} arrived in Mailhog within 10s`);
}

setup("authenticate as admin", async ({ page, request }) => {
  setup.skip(
    !ADMIN_PASSWORD,
    "Set E2E_ADMIN_PASSWORD (see ADMIN_PASSWORD in api/.env) to run the admin E2E tests."
  );

  // Clear the inbox so readLatestOTP cannot pick up a code from an earlier run.
  await request.delete(`${MAILHOG_URL}/api/v1/messages`).catch(() => {});

  await page.goto("/login");
  await page.locator('input[type="email"]').fill(ADMIN_EMAIL);
  await page.locator('input[type="password"]').fill(ADMIN_PASSWORD);
  await page.locator("#send-otp-btn").click();

  const otp = await readLatestOTP(request, ADMIN_EMAIL);
  const otpField = page.locator('input[placeholder="------"]');
  await otpField.waitFor({ state: "visible" });
  await otpField.fill(otp);
  await page.locator("#verify-otp-btn").click();

  await expect(page).not.toHaveURL(/\/login/, { timeout: 20_000 });

  await page.context().storageState({ path: ADMIN_STORAGE_STATE });
});
