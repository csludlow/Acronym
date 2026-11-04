import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { renderPDF } from "../server/pdf.ts";
import { snapshot } from "../server/export.ts";
import { Store } from "../server/store.ts";
import { prepared, edit, answer, sampleTest } from "./helpers.ts";
import { brand } from "../shared/brand.ts";

test("PDF includes reviewed negative answers, failures, handoff and tagged text across pages", async () => {
  let a = prepared();
  a = edit(a, { type: "answer", id: "DEMO-DATA-01", value: answer(a) });
  a = edit(a, {
    type: "approve",
    id: "DEMO-DATA-01",
    reviewer: "Morgan",
    notes: "No preserved",
  });
  a = edit(a, { type: "test", value: sampleTest(a) });
  const pdf = await renderPDF(snapshot(a, false, ""));
  assert.equal(pdf.subarray(0, 5).toString(), "%PDF-");
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const document = await getDocument({ data: new Uint8Array(pdf) }).promise;
  try {
    assert.ok(document.numPages > 1);
    assert.ok((await document.getMarkInfo())?.Marked);
    const text = [];
    for (let i = 1; i <= document.numPages; i++) {
      const p = await document.getPage(i);
      text.push(
        (await p.getTextContent()).items
          .map((x) => ("str" in x ? x.str : ""))
          .join(" "),
      );
    }
    const all = text.join(" ");
    for (const phrase of [
      "Response: No",
      "Morgan",
      "Your next steps",
      "Print label button is skipped",
      "Draft preparation package",
      "Reviewed response blocks for transfer",
    ])
      assert.ok(all.includes(phrase), phrase);
  } finally {
    await document.destroy();
  }
});
test("PDF migration preserves old issued DOCX and snapshots without rewriting them", () => {
  const dir = mkdtempSync(join(tmpdir(), "acronym-legacy-"));
  const db = new DatabaseSync(join(dir, "acronym.sqlite"));
  db.exec(
    readFileSync(
      new URL("../migrations/001_initial.sql", import.meta.url),
      "utf8",
    ),
  );
  const a = prepared();
  db.prepare("INSERT INTO assessments VALUES (?,?,?)").run(
    a.id,
    0,
    JSON.stringify(a),
  );
  const old = Buffer.from("Previously issued document bytes");
  db.prepare("INSERT INTO snapshots VALUES (?,?,?,?,?)").run(
    "issued",
    a.id,
    "2026-11-04",
    '{"status":"Draft generic assessment"}',
    old,
  );
  db.close();
  const store = new Store(dir);
  const row = store.db
    .prepare("SELECT docx,pdf,body FROM snapshots WHERE id=?")
    .get("issued")!;
  assert.deepEqual(Buffer.from(row.docx as Uint8Array), old);
  assert.equal(row.pdf, null);
  assert.equal(row.body, '{"status":"Draft generic assessment"}');
  store.close();
  const reopened = new Store(dir);
  assert.equal(
    reopened.db.prepare("SELECT count(*) AS n FROM migrations").get()!.n,
    2,
  );
  reopened.close();
});
test("CU brand foreground combinations meet normal text contrast", () => {
  const luminance = (hex: string) => {
    const c = [0, 2, 4]
      .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
      .map((x) => (x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4));
    return c[0] * 0.2126 + c[1] * 0.7152 + c[2] * 0.0722;
  };
  for (const [a, b] of [
    [brand.primary, "FFFFFF"],
    [brand.primary, brand.secondary],
  ]) {
    const l = [luminance(a), luminance(b)].sort((a, b) => a - b);
    assert.ok((l[1] + 0.05) / (l[0] + 0.05) >= 4.5);
  }
});
