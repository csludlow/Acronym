import { test } from "node:test";
import assert from "node:assert/strict";
import { questions } from "../shared/model.ts";
import { handoff } from "../shared/handoff.ts";
import { snapshot } from "../server/export.ts";
import { prepared, edit, answer, sampleTest } from "./helpers.ts";

test("handoff prioritizes conflicts and purchaser scope without inferring standards", () => {
  const a = prepared();
  a.product.details.standard = "Unknown";
  a.product.claims.carrierTraffic = "Yes";
  const h = handoff(a);
  assert.equal(h.next[0].title, "Clarify conflicting product statements");
  assert.ok(
    h.next.some(
      (s) => s.title === "Confirm the purchaser’s requested deliverables",
    ),
  );
  assert.equal(h.targets.standard, "Unknown");
  assert.equal(h.preparationComplete, false);
});
test("only reviewed current responses become transfer blocks; negatives and non-applicability survive", () => {
  let a = prepared();
  a = edit(a, { type: "answer", id: "DEMO-DATA-01", value: answer(a) });
  assert.equal(handoff(a).responses.length, 0);
  a = edit(a, {
    type: "approve",
    id: "DEMO-DATA-01",
    reviewer: "Morgan",
    notes: "Negative verified",
  });
  a = edit(a, {
    type: "answer",
    id: "DEMO-OPS-03",
    value: {
      ...answer(a, "DEMO-OPS-03"),
      applicability: "Not applicable",
      applicabilityReason: "Synthetic configuration has no payment feature.",
      applicabilityConfirmed: true,
    },
  });
  a = edit(a, {
    type: "approve",
    id: "DEMO-OPS-03",
    reviewer: "Morgan",
    notes: "Scope verified",
  });
  const s = snapshot(a, false, "");
  assert.equal(s.handoff.responses.length, 2);
  assert.match(s.handoff.responses[0].text, /Response: No/);
  assert.match(s.handoff.responses[0].text, /Human attestation:/);
  assert.match(
    s.handoff.responses[1].text,
    /Reason: Synthetic configuration has no payment feature/,
  );
  a = edit(a, {
    type: "answer",
    id: "DEMO-DATA-01",
    value: { ...answer(a), explanation: "Changed claim" },
  });
  assert.equal(handoff(a).responses.length, 1);
  assert.match(s.handoff.responses[0].text, /Negative verified/);
  assert.ok(
    s.handoff.submissionSteps.some((step) =>
      step.instruction.includes("every required criterion"),
    ),
  );
  assert.match(s.handoff.notice, /not a completed HECVAT/);
});

test("accessibility transfer preserves failures and disappears when a supporting test changes", () => {
  let a = prepared();
  a = edit(a, { type: "test", value: sampleTest(a) });
  assert.equal(handoff(a).accessibility.length, 0);
  a = edit(a, {
    type: "judgment",
    id: a.criteria[0].id,
    value: {
      result: "Does Not Support",
      explanation: "Most of the evaluated functionality fails.",
      coverageConfirmed: true,
      reviewer: "Morgan",
    },
  });
  const h = handoff(a);
  assert.equal(h.accessibility.length, 1);
  assert.match(
    h.accessibility[0].text,
    /Human criterion judgment: Does Not Support/,
  );
  assert.match(h.accessibility[0].text, /Print button cannot be reached/);
  assert.match(h.accessibility[0].text, /Limitations: Synthetic/);
  a = edit(a, {
    type: "test",
    id: a.tests[0].id,
    value: { ...sampleTest(a), observed: "Revised observation" },
  });
  assert.equal(handoff(a).accessibility.length, 0);
});

test("completed preparation still hands the user back to the requested documents", () => {
  let a = prepared();
  for (const q of questions) {
    a = edit(a, { type: "answer", id: q.id, value: answer(a, q.id) });
    a = edit(a, { type: "approve", id: q.id, reviewer: "Morgan", notes: "" });
  }
  for (const c of a.criteria) {
    a = edit(a, { type: "test", value: sampleTest(a, c.id) });
    a = edit(a, {
      type: "judgment",
      id: c.id,
      value: {
        result: "Does Not Support",
        explanation: "Failures documented across scope.",
        coverageConfirmed: true,
        reviewer: "Morgan",
      },
    });
  }
  const h = snapshot(a, true, "Morgan").handoff;
  assert.equal(h.preparationComplete, true);
  assert.match(h.summary, /Complete the requested documents/);
  assert.equal(h.next[0].title, "Open the requested documents");
  assert.ok(
    h.submissionSteps.some(
      (s) => s.title === "Have a human check the completed documents",
    ),
  );
});
