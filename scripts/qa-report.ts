import { writeFileSync, mkdirSync } from "node:fs";
import { newAssessment } from "../shared/model.ts";
import { renderPDF } from "../server/pdf.ts";
import { snapshot, renderReport } from "../server/export.ts";
import { prepared, edit, answer, sampleTest } from "../tests/helpers.ts";
mkdirSync(".local/qa", { recursive: true });
let a = prepared();
a = edit(a, { type: "answer", id: "DEMO-DATA-01", value: answer(a) });
a = edit(a, {
  type: "approve",
  id: "DEMO-DATA-01",
  reviewer: "Morgan reviewer",
  notes: "Negative response checked against synthetic fixture.",
});
a = edit(a, { type: "test", value: sampleTest(a) });
const s = snapshot(a, false, "");
writeFileSync(".local/qa/generic-report.docx", await renderReport(s));
writeFileSync(".local/qa/generic-report.json", JSON.stringify(s, null, 2));

mkdirSync("output/pdf", { recursive: true });
writeFileSync("output/pdf/acronym-cu-sample.pdf", await renderPDF(s));
