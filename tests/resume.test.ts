import { test } from "node:test";
import assert from "node:assert/strict";
import { resumePoint } from "../shared/resume.ts";
import { prepared, answer, edit } from "./helpers.ts";
import { productFields, questions } from "../shared/model.ts";

test("resume selects unfinished setup, unknown claims and scope without assuming confirmation", () => {
  const a = prepared();
  a.product.confirmed = a.product.confirmed.filter((k) => k !== "version");
  assert.deepEqual(resumePoint(a), {
    tab: "Product setup",
    section: "setup",
    step: Object.keys(productFields).indexOf("version"),
  });
  a.product.confirmed.push("version");
  a.product.claims.remoteAccess = "Unknown";
  assert.equal(resumePoint(a).step, Object.keys(productFields).length + 3);
  a.product.claims.remoteAccess = "No";
  a.product.criteriaInventoryConfirmed = false;
  assert.equal(resumePoint(a).step, Object.keys(productFields).length + 5);
});
test("resume passes a completed negative answer but returns to missing or unknown responses", () => {
  let a = prepared();
  a = edit(a, { type: "answer", id: questions[0].id, value: answer(a) });
  assert.deepEqual(resumePoint(a), {
    tab: "Questionnaire",
    section: "questions",
    step: 1,
  });
  a.answers[questions[0].id].response = "Unknown";
  assert.equal(resumePoint(a).step, 0);
  for (const q of questions)
    a = edit(a, { type: "answer", id: q.id, value: answer(a, q.id) });
  assert.equal(resumePoint(a).tab, "Accessibility");
});
