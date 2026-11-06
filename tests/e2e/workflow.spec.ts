import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
test.beforeEach(async ({ page }) => {
  if (process.env.CU_VERIFY_FONTS !== "1")
    await page.route(/https:\/\/(?:use|p)\.typekit\.net\//, (route) =>
      route.abort(),
    );
});
test("synthetic vendor can create, attach evidence, answer, test, review, export and reload", async ({
  page,
}, testInfo) => {
  const temporary = testInfo.project.name === "public";
  const savedMessage = temporary ? "Updated in this tab" : "Saved locally";
  await page.goto("/");
  if (process.env.CU_VERIFY_FONTS === "1") {
    await expect(async () => {
      const faces = await page.evaluate(async () => {
        const result = await Promise.all(
          ['400 17px "minion-pro"', '700 20px "myriad-pro"'].map((f) =>
            document.fonts.load(f),
          ),
        );
        return result.map((fonts) =>
          fonts.map((f) => ({ family: f.family, status: f.status })),
        );
      });
      expect(
        faces.every(
          (fonts) =>
            fonts.length > 0 && fonts.every((f) => f.status === "loaded"),
        ),
      ).toBe(true);
    }).toPass({ timeout: 15000 });
  }
  await page.getByLabel("Your name", { exact: true }).fill("Morgan Demo");
  await page
    .getByRole("button", { name: "Explore synthetic demo", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Product setup", exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("Vendor name", { exact: true })
    .fill("Synthetic Vendor E2E");
  await expect(
    page.getByRole("button", { name: "Save and next", exact: true }),
  ).toHaveCSS("background-color", "rgb(0, 58, 99)");
  await page.getByRole("button", { name: "Save product setup" }).click();
  await expect(page.getByRole("status")).toContainText(savedMessage);
  await page.getByRole("button", { name: /03 Evidence/ }).click();
  await page.locator("input[type=file]").setInputFiles({
    name: "synthetic-policy.txt",
    mimeType: "text/plain",
    buffer: Buffer.from(
      "Synthetic attestation: no external transmissions are configured in the test fixture.",
    ),
  });
  await page.getByRole("button", { name: "Upload evidence" }).click();
  await expect(
    page.getByRole("heading", { name: "synthetic-policy.txt" }),
  ).toBeVisible();
  await page.getByLabel("Evidence relevance").selectOption("Current");
  await page.getByRole("button", { name: "Save evidence details" }).click();
  await expect(page.getByRole("status")).toContainText(savedMessage);
  await page.getByRole("button", { name: /04 Questionnaire/ }).click();
  await page.getByLabel("Response", { exact: true }).selectOption("No");
  await page
    .getByLabel("Answer explanation")
    .fill("No external transmissions in this synthetic fixture.");
  await page
    .getByLabel("Evidence file")
    .selectOption({ label: "synthetic-policy.txt — Current" });
  await page.getByLabel("Source location").selectOption("Line 1");
  await page.getByRole("button", { name: "Attach reference" }).click();
  await page.getByLabel("Workflow status").selectOption("Ready for review");
  await page.getByRole("button", { name: "Save answer", exact: true }).click();
  await expect(page.getByRole("status")).toContainText(savedMessage);
  await page.getByRole("button", { name: /06 Review queue/ }).click();
  await page
    .getByRole("button", { name: "Approve DEMO-DATA-01", exact: true })
    .click();
  await expect(
    page.getByText("Approved by Morgan Demo", { exact: false }),
  ).toBeVisible();
  await page.getByRole("button", { name: /05 Accessibility/ }).click();
  const fields = {
    "Screens and controls": "Shipment dialog",
    Workflow: "Print a label",
    "Test configuration": "Synthetic default settings",
    "Tools and assistive technologies": "Keyboard and synthetic observations",
    "Expected behavior": "Print control reachable",
    "Observed behavior": "Print button skipped",
    Findings: "Keyboard cannot reach print button",
    "Testing limitations": "Synthetic example only",
    "Remediation notes": "Add button to focus order",
  };
  for (const [label, value] of Object.entries(fields))
    await page.getByLabel(label, { exact: true }).fill(value);
  await page.getByLabel("Test result", { exact: true }).selectOption("Fail");
  await page.getByRole("button", { name: "Save test", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Print a label", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: /07 Exports/ }).click();
  await expect(
    page.getByRole("button", { name: "Complete preparation package" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Create draft snapshot" }).click();
  await expect(
    page.getByRole("heading", { name: "Draft preparation package" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Your document handoff" }),
  ).toBeVisible();
  await page
    .getByText(
      "DEMO-DATA-01 · Is information transmitted outside the installation?",
      { exact: true },
    )
    .click();
  await expect(
    page.getByLabel("Reviewed transfer text DEMO-DATA-01"),
  ).toHaveValue(/Response: No/);
  await expect(
    page.getByRole("button", { name: "Copy reviewed response DEMO-DATA-01" }),
  ).toBeVisible();
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await page
    .getByRole("button", {
      name: "Copy reviewed response DEMO-DATA-01",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: "Copied DEMO-DATA-01" }),
  ).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain(
    "Response: No",
  );
  await page.screenshot({ path: ".local/qa/handoff.png", fullPage: true });
  const download = page.waitForEvent("download");
  await page.getByRole("link", { name: "Download DOCX" }).click();
  expect((await download).suggestedFilename()).toMatch(/\.docx$/);
  const pdfDownload = page.waitForEvent("download");
  await page.getByRole("link", { name: "Download PDF", exact: true }).click();
  expect((await pdfDownload).suggestedFilename()).toMatch(/\.pdf$/);
  if (temporary) {
    const jsonEvent = page.waitForEvent("download");
    await page
      .getByRole("link", { name: "Download JSON", exact: true })
      .click();
    const report = JSON.parse(
      await readFile((await (await jsonEvent).path())!, "utf8"),
    );
    expect(report.assessment.answers["DEMO-DATA-01"].response).toBe("No");
    expect(report.assessment.answers["DEMO-DATA-01"].status).toBe("Approved");
    expect(
      report.assessment.answers["DEMO-DATA-01"].references[0].locator,
    ).toBe("Line 1");
    expect(report.assessment.tests[0].result).toBe("Fail");
    const backupEvent = page.waitForEvent("download");
    await page
      .getByRole("link", { name: "Download assessment backup", exact: true })
      .click();
    const backupFile = await (await backupEvent).path();
    expect(backupFile).toBeTruthy();
    const other = await page.context().newPage();
    await other.route(/https:\/\/(?:use|p)\.typekit\.net\//, (route) =>
      route.abort(),
    );
    await other.goto("/");
    await expect(other.getByLabel("Your name", { exact: true })).toHaveValue(
      "",
    );
    expect(
      await other.getByLabel("Current assessment").locator("option").count(),
    ).toBe(1);
    await other.close();
    expect(
      await page.evaluate(() => [localStorage.length, sessionStorage.length]),
    ).toEqual([0, 0]);
    const cookieNames = (await page.context().cookies()).map((c) => c.name);
    // Azure adds routing cookies independently of the application. They do not
    // contain the assessment or identify an application workspace.
    expect(
      cookieNames.filter((name) =>
        process.env.ACRONYM_TEST_URL &&
        ["ARRAffinity", "ARRAffinitySameSite"].includes(name)
          ? false
          : true,
      ),
    ).toEqual([]);
    expect(await page.evaluate(() => indexedDB.databases())).toEqual([]);
    expect(existsSync(".local/must-not-exist-public")).toBe(false);
    page.on("dialog", (dialog) => dialog.accept());
    await page.reload();
    await expect(page.getByLabel("Your name", { exact: true })).toHaveValue("");
    expect(
      await page.getByLabel("Current assessment").locator("option").count(),
    ).toBe(1);
    await page.getByLabel("Assessment backup file").setInputFiles(backupFile!);
    await page
      .getByRole("button", { name: "Restore as a copy", exact: true })
      .click();
    await expect(page.getByLabel("Current assessment")).not.toHaveValue("");
    await page.getByRole("button", { name: /04 Questionnaire/ }).click();
    await expect(page.getByLabel("Response", { exact: true })).toHaveValue(
      "No",
    );
    await expect(page.getByLabel("Workflow status")).toHaveValue(
      "Needs clarification",
    );
    await expect(page.getByText("synthetic-policy.txt · Line 1")).toBeVisible();
    await page
      .getByRole("button", { name: "End session and clear work", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Prepare with confidence." }),
    ).toBeVisible();
    expect(
      await page.getByLabel("Current assessment").locator("option").count(),
    ).toBe(1);
    return;
  }
  const id = await page.getByLabel("Current assessment").inputValue();
  await page.reload();
  await page.getByLabel("Current assessment").selectOption(id);
  await expect(
    page.getByRole("heading", { name: "Overview", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("1 / 8")).toHaveCount(2);
  await page.getByRole("button", { name: /04 Questionnaire/ }).click();
  await expect(page.getByLabel("Response", { exact: true })).toHaveValue("No");
  await expect(page.getByText("synthetic-policy.txt · Line 1")).toBeVisible();
  await page.getByRole("button", { name: /01 Overview/ }).click();
  await page.evaluate(() => {
    window.scrollTo(0, 0);
    if (document.activeElement instanceof HTMLElement)
      document.activeElement.blur();
  });
  await page.screenshot({ path: ".local/qa/dashboard.png", fullPage: true });
  await page.getByRole("button", { name: "Open your handoff guide →" }).click();
  await expect(
    page.getByRole("heading", { name: "Your document handoff" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Open Product setup →", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Product setup", exact: true }),
  ).toBeVisible();
});
test("keyboard access and core labels are present", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByLabel("Your name", { exact: true })).toBeVisible();
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Skip to main content" }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#main")).toBeFocused();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.getByLabel("Your name", { exact: true })).toBeVisible();
});
