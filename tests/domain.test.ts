import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Store } from "../server/store.ts";
import { edit, prepared, answer, sampleTest } from "./helpers.ts";
import {
  newAssessment,
  conflicts,
  outstanding,
  questions,
  metrics,
} from "../shared/model.ts";
import { snapshot } from "../server/export.ts";
import { requireAdapter } from "../server/adapters.ts";
import { aiConfiguration, validateSuggestion } from "../server/ai.ts";
import { backup, restore } from "../server/backup.ts";

test("SQLite saves the entire assessment and recovers after closing and restarting", () => {
  const dir = mkdtempSync(join(tmpdir(), "acronym-"));
  let store = new Store(dir);
  let a = prepared();
  store.insert(a);
  a = edit(a, { type: "answer", id: questions[0].id, value: answer(a) });
  store.save(a, 0);
  store.close();
  store = new Store(dir);
  assert.deepEqual(store.get(a.id), a);
  assert.equal(
    store.db.prepare("SELECT count(*) AS n FROM migrations").get()!.n,
    1,
  );
  assert.throws(() => store.save({ ...a, revision: 2 }, 0), /another tab/);
  store.close();
});
test("unknown setup and answers remain unresolved; no silent inference for postal demo", () => {
  let a = newAssessment("demo", true);
  assert.equal(a.product.claims.externalTransmissions, "Unknown");
  assert.ok(outstanding(a).some((x) => x.includes("Confirm users")));
  a = edit(a, {
    type: "answer",
    id: questions[0].id,
    value: { ...answer(a), response: "Unknown", status: "Needs clarification" },
  });
  assert.throws(
    () =>
      edit(a, {
        type: "approve",
        id: questions[0].id,
        reviewer: "Reviewer",
        notes: "",
      }),
    /Unknown/,
  );
  assert.throws(() => snapshot(a, true, "Reviewer"), /blocked/);
  assert.equal(a.answers[questions[0].id].response, "Unknown");
});
test("not applicable requires a reason, human confirmation and supporting acknowledgment", () => {
  let a = prepared();
  const value = {
    ...answer(a),
    applicability: "Not applicable",
    applicabilityReason:
      "No payment processing exists in the assessed configuration.",
    applicabilityConfirmed: false,
  };
  assert.throws(
    () => edit(a, { type: "answer", id: "DEMO-OPS-03", value }),
    /confirmation/,
  );
  a = edit(a, {
    type: "answer",
    id: "DEMO-OPS-03",
    value: { ...value, applicabilityConfirmed: true },
  });
  a = edit(a, {
    type: "approve",
    id: "DEMO-OPS-03",
    reviewer: "Reviewer",
    notes: "Scope checked",
  });
  assert.equal(a.answers["DEMO-OPS-03"].status, "Approved");
});
test("negative responses are complete and remain negative through named human review and export", () => {
  let a = prepared();
  a = edit(a, { type: "answer", id: questions[0].id, value: answer(a) });
  assert.throws(() =>
    edit(a, { type: "approve", id: questions[0].id, reviewer: "", notes: "" }),
  );
  a = edit(a, {
    type: "approve",
    id: questions[0].id,
    reviewer: "Reviewer",
    notes: "An honest No.",
  });
  assert.equal(a.answers[questions[0].id].response, "No");
  const s = snapshot(a, false, "");
  a.answers[questions[0].id].response = "Yes";
  assert.equal(s.assessment.answers[questions[0].id].response, "No");
  assert.equal(s.assessment.history.at(-1)?.actor, "Demo author");
});
test("conflicting transmissions, support access, and encryption claims block approval", () => {
  let a = prepared();
  a.product.claims.carrierTraffic = "Yes";
  a.product.claims.remoteAccess = "Yes";
  a.answers["DEMO-DATA-03"].explanation = "Encrypted at rest";
  assert.equal(conflicts(a).length, 3);
  a = edit(a, { type: "answer", id: questions[0].id, value: answer(a) });
  assert.throws(
    () =>
      edit(a, {
        type: "approve",
        id: questions[0].id,
        reviewer: "Reviewer",
        notes: "",
      }),
    /conflicting/,
  );
});
test("evidence references and exact citations are validated and approvals become stale on evidence edits", () => {
  let a = prepared();
  a.evidence = [
    {
      id: "e1",
      fileName: "policy.txt",
      hash: "a".repeat(64),
      uploadedAt: "2026-11-04",
      product: a.product.details.product,
      version: "1.0",
      status: "Current",
      extraction: "Extracted",
      segments: [{ locator: "Line 1", text: "No backups are tested." }],
      notes: "Policy only",
      excludeFromAI: true,
    },
  ];
  const value = {
    ...answer(a),
    attestation: "",
    references: [
      { evidenceId: "e1", locator: "Line 1", quote: "No backups are tested." },
    ],
  };
  assert.throws(
    () =>
      edit(a, {
        type: "answer",
        id: questions[0].id,
        value: {
          ...value,
          references: [{ ...value.references[0], quote: "All backups tested" }],
        },
      }),
    /does not exist/,
  );
  a = edit(a, { type: "answer", id: questions[0].id, value });
  a = edit(a, {
    type: "approve",
    id: questions[0].id,
    reviewer: "Reviewer",
    notes: "",
  });
  assert.deepEqual(
    snapshot(a, false, "").assessment.answers[questions[0].id].references,
    value.references,
  );
  a = edit(a, {
    type: "evidence",
    id: "e1",
    value: {
      status: "Superseded",
      product: a.product.details.product,
      version: "1.0",
      notes: "Old version",
      excludeFromAI: true,
    },
  });
  assert.equal(a.answers[questions[0].id].status, "Needs clarification");
  assert.throws(
    () =>
      edit(a, {
        type: "approve",
        id: questions[0].id,
        reviewer: "Reviewer",
        notes: "",
      }),
    /current/,
  );
});
test("changing approved answer or product requires review and retains history", () => {
  let a = prepared();
  a = edit(a, { type: "answer", id: questions[0].id, value: answer(a) });
  a = edit(a, {
    type: "approve",
    id: questions[0].id,
    reviewer: "Reviewer",
    notes: "",
  });
  const previous = structuredClone(a);
  a = edit(a, {
    type: "answer",
    id: questions[0].id,
    value: { ...answer(a), explanation: "Revised explanation" },
  });
  assert.equal(a.answers[questions[0].id].status, "Needs clarification");
  assert.equal(
    (a.history.at(-1)?.before as typeof a).answers[questions[0].id].reviewer,
    "Reviewer",
  );
  a = edit(previous, {
    type: "product",
    value: {
      ...previous.product,
      details: { ...previous.product.details, version: "2.0" },
    },
  });
  assert.equal(a.answers[questions[0].id].status, "Needs clarification");
});
test("untested criterion cannot become Supports, and a passing test still requires coverage confirmation", () => {
  let a = prepared();
  const value = {
    result: "Supports",
    explanation: "Test passed.",
    coverageConfirmed: true,
    reviewer: "Reviewer",
  };
  assert.throws(
    () => edit(a, { type: "judgment", id: a.criteria[0].id, value }),
    /Complete/,
  );
  a = edit(a, {
    type: "test",
    value: { ...sampleTest(a), result: "Untested" },
  });
  assert.throws(
    () => edit(a, { type: "judgment", id: a.criteria[0].id, value }),
    /Complete/,
  );
  a = edit(a, {
    type: "test",
    id: a.tests[0].id,
    value: {
      ...sampleTest(a),
      result: "Pass",
      observed: "All controls reachable",
      findings: "",
    },
  });
  assert.throws(
    () =>
      edit(a, {
        type: "judgment",
        id: a.criteria[0].id,
        value: { ...value, coverageConfirmed: false },
      }),
    /coverage/,
  );
  a = edit(a, { type: "judgment", id: a.criteria[0].id, value });
  a = edit(a, { type: "test", id: a.tests[0].id, value: sampleTest(a) });
  assert.equal(a.criteria[0].judgment, null);
  assert.throws(
    () => edit(a, { type: "judgment", id: a.criteria[0].id, value }),
    /failed/,
  );
});
test("a complete generic report can accurately document failures; incomplete is distinct", () => {
  let a = prepared();
  for (const c of a.criteria) {
    a = edit(a, { type: "test", value: sampleTest(a, c.id) });
    a = edit(a, {
      type: "judgment",
      id: c.id,
      value: {
        result: "Does Not Support",
        explanation: "Most synthetic functionality fails; see recorded test.",
        coverageConfirmed: true,
        reviewer: "Reviewer",
      },
    });
  }
  for (const q of questions) {
    a = edit(a, { type: "answer", id: q.id, value: answer(a, q.id) });
    a = edit(a, {
      type: "approve",
      id: q.id,
      reviewer: "Reviewer",
      notes: "Known failure documented",
    });
  }
  assert.deepEqual(outstanding(a), []);
  assert.equal(metrics(a).findings, 6);
  assert.equal(
    snapshot(a, true, "Reviewer").status,
    "Completed preparation package",
  );
  a.criteria[0].judgment = null;
  assert.throws(() => snapshot(a, true, "Reviewer"), /blocked/);
  assert.equal(snapshot(a, false, "").status, "Draft preparation package");
});
test("unsupported official versions fail closed; no unsupported workbook is rewritten", () => {
  for (const family of ["HECVAT", "VPAT"])
    for (const version of ["4.1.6", "2.5Rev", "future"])
      assert.throws(
        () => requireAdapter(family, version, "INT"),
        /Unsupported official template/,
      );
});
test("AI is disabled and excluded evidence cannot enter a future suggestion", () => {
  assert.deepEqual(aiConfiguration, {
    enabled: false,
    externalProcessing: false,
  });
  const a = prepared();
  assert.throws(
    () =>
      validateSuggestion(a, {
        questionId: "DEMO-DATA-01",
        text: "Invented",
        references: [
          { evidenceId: "missing", locator: "Page 1", quote: "Invented" },
        ],
      }),
    /not found/,
  );
});
test("portable backup validates hashes and restores a separate copy without trusting approvals", () => {
  const store = new Store(mkdtempSync(join(tmpdir(), "acronym-backup-")));
  let a = prepared();
  const digest = store.putFile(Buffer.from("source"));
  a.evidence = [
    {
      id: "e1",
      fileName: "safe.txt",
      hash: digest,
      uploadedAt: "2026-11-04",
      product: a.product.details.product,
      version: "1.0",
      status: "Current",
      extraction: "Extracted",
      segments: [{ locator: "Line 1", text: "source" }],
      notes: "",
      excludeFromAI: true,
    },
  ];
  a = edit(a, { type: "answer", id: questions[0].id, value: answer(a) });
  a = edit(a, {
    type: "approve",
    id: questions[0].id,
    reviewer: "Reviewer",
    notes: "",
  });
  store.insert(a);
  const b = backup(store, a.id),
    copy = restore(store, b);
  assert.notEqual(copy.id, a.id);
  assert.equal(copy.answers[questions[0].id].status, "Needs clarification");
  assert.equal(store.get(a.id).answers[questions[0].id].status, "Approved");
  b.files[0].data = Buffer.from("tampered").toString("base64");
  assert.throws(() => restore(store, b), /hash mismatch/);
  store.close();
});

test("unknown test details and invented Not Evaluated judgments are rejected", () => {
  let a = prepared();
  assert.throws(
    () =>
      edit(a, {
        type: "test",
        value: { ...sampleTest(a), observed: "Unknown" },
      }),
    /cannot be unknown/,
  );
  assert.throws(() =>
    edit(a, {
      type: "judgment",
      id: a.criteria[0].id,
      value: {
        result: "Not Evaluated",
        explanation: "Not tested",
        coverageConfirmed: true,
        reviewer: "Reviewer",
      },
    }),
  );
  a.product.details.assessmentDate = "not a date";
  assert.ok(
    outstanding(a).some((issue) => issue.includes("valid assessment date")),
  );
});
