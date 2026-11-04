import { test, expect } from "@playwright/test";

test("a stalled Adobe font stylesheet cannot block setup or a PDF export", async ({
  page,
}) => {
  let requested = false;
  let release!: () => void;
  const stalled = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("https://use.typekit.net/yya5cit.css", async (route) => {
    requested = true;
    await stalled;
    await route.abort();
  });
  try {
    await page.goto("/", { waitUntil: "commit" });
    await expect.poll(() => requested).toBe(true);
    await page
      .getByLabel("Your name", { exact: true })
      .fill("Font outage tester", { timeout: 4000 });
    await page
      .getByRole("button", { name: "Explore synthetic demo", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Product setup", exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: /07 Exports/ }).click();
    await page.getByRole("button", { name: "Create draft snapshot" }).click();
    const download = page.waitForEvent("download");
    await page.getByRole("link", { name: "Download PDF", exact: true }).click();
    expect((await download).suggestedFilename()).toMatch(/\.pdf$/);
  } finally {
    release();
    await page.unrouteAll({ behavior: "wait" });
  }
});
