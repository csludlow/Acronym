import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { questions, productFields } from "../../shared/model";

test("guided setup and questions skip without inventing answers and advance only after saving", async ({
  page,
}, info) => {
  await page.route(/https:\/\/(?:use|p)\.typekit\.net\//, (r) => r.abort());
  await page.goto("/");
  if (info.project.name === "public") {
    await expect(
      page.getByText("Your work is not saved automatically", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("TEMPORARY WORKSPACE · AI OFF", { exact: true }),
    ).toHaveCount(0);
  }
  await page
    .getByRole("button", { name: "Create assessment", exact: true })
    .click();
  await expect(page.getByLabel("Vendor name", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Product name", { exact: true })).toHaveCount(0);
  await page
    .getByLabel("Vendor name", { exact: true })
    .fill("Synthetic guided vendor");
  await page
    .getByRole("button", { name: "Save and next", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("Enter your name");
  await expect(page.getByLabel("Vendor name", { exact: true })).toBeVisible();
  await page.getByLabel("Your name", { exact: true }).fill("Guide tester");
  await page
    .getByRole("button", { name: "Save and next", exact: true })
    .click();
  await expect(page.getByLabel("Product name", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(page.getByLabel("Vendor name", { exact: true })).toHaveValue(
    "Synthetic guided vendor",
  );
  // Skipping all setup prompts never confirms unknown information.
  const total = Object.keys(productFields).length + 6;
  for (let i = 0; i < total; i++) {
    await expect(
      page.getByText(`Setup question ${i + 1} of ${total}`, { exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Skip for now", exact: true })
      .click();
  }
  await page
    .getByRole("button", { name: "Start questionnaire", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: questions[0].wording, exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: questions[1].wording, exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Skip for now", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: questions[1].wording, exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(page.getByLabel("Response", { exact: true })).toHaveValue("");
  await page.getByLabel("Response", { exact: true }).selectOption("No");
  await page
    .getByLabel("Answer explanation")
    .fill("Synthetic negative answer.");
  await page.getByLabel("Workflow status").selectOption("Draft");
  await page
    .getByRole("button", { name: "Save and next", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: questions[1].wording, exact: true }),
  ).toBeFocused();
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(page.getByLabel("Response", { exact: true })).toHaveValue("No");
  await page.getByLabel("Answer explanation").fill("Unsaved text to discard");
  page.once("dialog", (d) => d.dismiss());
  await page.getByRole("button", { name: "Skip for now", exact: true }).click();
  await expect(page.getByLabel("Answer explanation")).toHaveValue(
    "Unsaved text to discard",
  );
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Skip for now", exact: true }).click();
  for (let i = 1; i < questions.length; i++)
    await page
      .getByRole("button", { name: "Skip for now", exact: true })
      .click();
  await expect(
    page.getByRole("heading", {
      name: "You’ve reached the end of the questions",
    }),
  ).toBeVisible();
  await expect(
    page.getByText("8 of 8 questions still need", { exact: false }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Return to unresolved questions" })
    .click();
  await expect(page.getByLabel("Answer explanation")).toHaveValue(
    "Synthetic negative answer.",
  );
  await page.getByRole("button", { name: /07 Exports/ }).click();
  await expect(
    page.getByRole("button", { name: "Complete preparation package" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Create draft snapshot" }).click();
  const downloaded = page.waitForEvent("download");
  await page.getByRole("link", { name: "Download JSON", exact: true }).click();
  const report = JSON.parse(
    await readFile((await (await downloaded).path())!, "utf8"),
  );
  expect(report.assessment.product.confirmed).toEqual([]);
  expect(report.assessment.answers[questions[0].id].response).toBe("No");
  expect(report.assessment.answers[questions[1].id].response).toBe("");
  expect(report.assessment.answers[questions[1].id].status).toBe("Unanswered");
});
