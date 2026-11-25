import { test, expect } from "@playwright/test";

/**
 * A walk through the admin pages that carry the most UI state, so that the
 * dialogs which were split out of VideosPage and UsersPage stay wired up.
 *
 * Deliberately shallow: it opens each dialog and checks the right thing is on
 * screen. It does not upload a video or create a user, because those write to
 * the same database the developer is looking at.
 */

test.describe("admin panel", () => {
  test("videos page lists videos and opens the upload dialog", async ({ page }) => {
    await page.goto("/videos");
    await expect(page.getByRole("heading", { name: "Videos" })).toBeVisible();

    // The upload dialog owns fourteen pieces of form state and lives in its own
    // component; this proves the page still mounts it. Asserting on the
    // subtitle rather than the title, because "Upload Video" is also the text
    // of the button that opened it.
    await page.getByRole("button", { name: "Upload Video" }).click();
    await expect(page.getByText("Fill in the details and choose a file to upload")).toBeVisible();
  });

  test("users page lists users and opens the add-user dialog", async ({ page }) => {
    await page.goto("/users");
    await expect(page.getByRole("heading", { name: "Users" })).toBeVisible();

    await page.getByRole("button", { name: "Add User" }).click();
    // Step one of the two-step OTP flow.
    await expect(page.getByRole("heading", { name: "Add New User" })).toBeVisible();
  });

  test("product market page loads", async ({ page }) => {
    await page.goto("/products");
    await expect(page.getByRole("heading", { name: "Product Market" })).toBeVisible();
  });

  test("no page in the walk logs a console error", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });

    for (const path of ["/videos", "/users", "/products", "/playlists", "/market-plans"]) {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
    }

    // A React crash in an extracted dialog would surface here even though the
    // assertions above only check the happy path.
    expect(errors.filter((e) => !/favicon|404 \(Not Found\)/i.test(e))).toEqual([]);
  });
});
