import { test, expect } from "@playwright/test";

test("vendors can open the public workspace through an external link", async ({
  page,
  baseURL,
}, testInfo) => {
  test.skip(testInfo.project.name !== "public", "Public entry-page behavior");
  await page.route(/https:\/\/(?:use|p)\.typekit\.net\//, (r) => r.abort());
  await page.route("https://vendor-link.example/", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: `<a href="${baseURL}/">Open Acronym</a>`,
    }),
  );
  await page.goto("https://vendor-link.example/");
  const navigation = page.waitForResponse(
    (r) => r.request().isNavigationRequest() && r.url() === `${baseURL}/`,
  );
  await page.getByRole("link", { name: "Open Acronym" }).click();
  expect((await navigation).status()).toBe(200);
  await expect(page.getByLabel("Your name", { exact: true })).toBeVisible();
  await page
    .getByLabel("Your name", { exact: true })
    .fill("Synthetic link visitor");
  await page
    .getByRole("button", { name: "Create assessment", exact: true })
    .click();
  await page
    .getByLabel("Vendor name", { exact: true })
    .fill("Synthetic linked vendor");
  await page
    .getByRole("button", { name: "Save and next", exact: true })
    .click();
  await expect(page.getByLabel("Product name", { exact: true })).toBeVisible();
});
