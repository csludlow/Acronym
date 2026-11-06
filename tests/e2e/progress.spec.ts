import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { prepared, answer, edit } from "../helpers";
import { questions } from "../../shared/model";

test("save progress from setup, reopen after reload, and resume without losing edits", async ({
  page,
}) => {
  await page.route(/https:\/\/(?:use|p)\.typekit\.net\//, (r) => r.abort());
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Open progress file", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Create assessment", exact: true })
    .click();
  await page.getByLabel("Your name", { exact: true }).fill("Progress tester");
  await page
    .getByLabel("Vendor name", { exact: true })
    .fill("Synthetic progress vendor");
  await page.getByLabel("Vendor name confirmed", { exact: true }).check();
  await page
    .getByRole("button", { name: "Save and next", exact: true })
    .click();
  await page
    .getByLabel("Product name", { exact: true })
    .fill("Synthetic progress product");
  await page
    .getByRole("button", { name: "Save progress file", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText(
    "Save the current question or form first",
  );
  await expect(page.getByLabel("Product name", { exact: true })).toHaveValue(
    "Synthetic progress product",
  );
  await page
    .getByRole("button", { name: "Save product setup", exact: true })
    .click();
  const download = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Save progress file", exact: true })
    .click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/^acronym-progress-.*\.json$/);
  const path = (await file.path())!;
  const data = JSON.parse(await readFile(path, "utf8"));
  expect(data.assessment.product.details.product).toBe(
    "Synthetic progress product",
  );
  expect(data.assessment.product.confirmed).toContain("vendor");
  page.on("dialog", (d) => d.accept());
  await page.reload();
  await page.getByLabel("Progress file (.json)").setInputFiles(path);
  await page
    .getByRole("button", { name: "Open progress file", exact: true })
    .click();
  await expect(page.getByLabel("Product name", { exact: true })).toHaveValue(
    "Synthetic progress product",
  );
  await expect(page.getByRole("status").first()).toContainText(
    "next unfinished item",
  );
  await page
    .getByRole("button", { name: "Open another progress file" })
    .click();
  await page
    .getByLabel("Progress file (.json)")
    .setInputFiles({
      name: "bad.json",
      mimeType: "application/json",
      buffer: Buffer.from("{bad"),
    });
  await page
    .getByRole("button", { name: "Open progress file", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText(
    "not a readable progress file",
  );
  await expect(page.getByLabel("Product name", { exact: true })).toHaveValue(
    "Synthetic progress product",
  );
});

test("older backup opens at the next unanswered question and requires approval again", async ({
  page,
}) => {
  await page.route(/https:\/\/(?:use|p)\.typekit\.net\//, (r) => r.abort());
  let a = prepared();
  a = edit(a, { type: "answer", id: questions[0].id, value: answer(a) });
  a = edit(a, {
    type: "approve",
    id: questions[0].id,
    reviewer: "Original reviewer",
    notes: "Synthetic",
  });
  await page.goto("/");
  await page
    .getByLabel("Progress file (.json)")
    .setInputFiles({
      name: "older-backup.json",
      mimeType: "application/json",
      buffer: Buffer.from(
        JSON.stringify({
          format: "acronym-backup-v1",
          assessment: a,
          files: [],
        }),
      ),
    });
  await page
    .getByRole("button", { name: "Open progress file", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: questions[1].wording, exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(page.getByLabel("Response", { exact: true })).toHaveValue("No");
  await expect(page.getByLabel("Workflow status")).toHaveValue(
    "Needs clarification",
  );
});
