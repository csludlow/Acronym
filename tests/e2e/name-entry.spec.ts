import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";

test("a visible browser-filled personal name is used when saving the first question", async ({
  page,
}) => {
  await page.route(/https:\/\/(?:use|p)\.typekit\.net\//, (r) => r.abort());
  await page.goto("/");
  await page
    .getByRole("button", { name: "Create assessment", exact: true })
    .click();
  await page
    .getByLabel("Vendor name", { exact: true })
    .fill("Synthetic name regression vendor");
  // Some autofill tools update the displayed DOM value without an input event.
  await page
    .getByLabel("Your name", { exact: true })
    .evaluate((input: HTMLInputElement) => {
      input.value = "Synthetic autofill author";
    });
  await expect(page.getByLabel("Your name", { exact: true })).toHaveValue(
    "Synthetic autofill author",
  );
  await page
    .getByRole("button", { name: "Save and next", exact: true })
    .click();
  await expect(page.getByLabel("Product name", { exact: true })).toBeVisible();
});

test("setup details are reviewed together and unknowns remain unconfirmed", async ({
  page,
}) => {
  await page.route(/https:\/\/(?:use|p)\.typekit\.net\//, (r) => r.abort());
  await page.goto("/");
  await page
    .getByLabel("Your name", { exact: true })
    .fill("Synthetic setup reviewer");
  await page
    .getByRole("button", { name: "Create assessment", exact: true })
    .click();
  await expect(
    page.getByLabel("Vendor name confirmed", { exact: true }),
  ).toHaveCount(0);
  await page
    .getByLabel("Vendor name", { exact: true })
    .fill("Synthetic reviewed vendor");
  await page
    .getByRole("button", { name: "Save product setup", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Review setup details together" })
    .click();
  await expect(page.getByRole("table")).toContainText(
    "Synthetic reviewed vendor",
  );
  await page
    .getByRole("button", { name: "Confirm reviewed setup details" })
    .click();
  await expect(page.getByRole("status").first()).toContainText(
    /Saved locally|Updated in this tab/,
  );
  const download = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Save progress file", exact: true })
    .click();
  const file = JSON.parse(
    await readFile((await (await download).path())!, "utf8"),
  );
  expect(file.assessment.product.confirmed).toContain("vendor");
  expect(file.assessment.product.confirmed).not.toContain("product");
  expect(file.assessment.history.at(-1).actor).toBe("Synthetic setup reviewer");
  await page
    .getByRole("button", { name: "Edit Vendor name", exact: true })
    .click();
  await page
    .getByLabel("Vendor name", { exact: true })
    .fill("Changed synthetic vendor");
  await page
    .getByRole("button", { name: "Save product setup", exact: true })
    .click();
  const changed = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Save progress file", exact: true })
    .click();
  const revised = JSON.parse(
    await readFile((await (await changed).path())!, "utf8"),
  );
  expect(revised.assessment.product.confirmed).not.toContain("vendor");
});
