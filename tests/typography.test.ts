import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { unzipSync, strFromU8 } from "fflate";
import { snapshot, renderReport } from "../server/export.ts";
import { reportFonts } from "../server/report-fonts.ts";
import { prepared } from "./helpers.ts";

test("DOCX assigns Minion body text and Myriad headings without bundling commercial fonts", async () => {
  const zip = unzipSync(await renderReport(snapshot(prepared(), false, "")));
  const styles = strFromU8(zip["word/styles.xml"]);
  assert.match(styles, /Minion Pro/);
  assert.match(styles, /Myriad Pro/);
  assert.ok(!Object.keys(zip).some((p) => p.startsWith("word/fonts/")));
});
test("offline PDF fallback is explicit; incomplete licensed font configuration fails visibly", () => {
  const f = reportFonts({});
  assert.equal(f.configured, false);
  assert.match(f.note, /offline PDF uses Noto Serif/);
  assert.match(f.files.BodyRegular, /NotoSerif/);
  assert.throws(
    () =>
      reportFonts({
        CU_PDF_FONT_DIR: mkdtempSync(join(tmpdir(), "cu-fonts-")),
      }),
    /missing minion-regular/,
  );
});
