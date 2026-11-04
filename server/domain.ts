import { z } from "zod";
import {
  answerInput,
  productSchema,
  testInput,
  criterionInput,
  judgmentInput,
  name,
  text,
  questions,
  answerComplete,
  conflicts,
  isUnknown,
  type Assessment,
  type Reference,
  type Evidence,
} from "../shared/model.ts";
export class DomainError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export function demand(condition: unknown, message: string): asserts condition {
  if (!condition) throw new DomainError(message);
}
export function validateReferences(
  a: Assessment,
  refs: Reference[],
  current = false,
) {
  for (const r of refs) {
    const e = a.evidence.find((e) => e.id === r.evidenceId);
    demand(e, "Evidence reference was not found.");
    demand(
      e.segments.some((s) => s.locator === r.locator),
      "Choose an existing source location.",
    );
    if (r.quote)
      demand(
        e.segments.some(
          (s) => s.locator === r.locator && s.text.includes(r.quote),
        ),
        "Quoted passage does not exist at that location.",
      );
    if (current)
      demand(
        e.status === "Current" &&
          e.product === a.product.details.product &&
          e.version === a.product.details.version,
        "Supporting evidence must be current and match the product and version.",
      );
  }
}
function invalidate(
  a: Assessment,
  predicate: (answer: Assessment["answers"][string]) => boolean = () => true,
) {
  for (const answer of Object.values(a.answers))
    if (answer.status === "Approved" && predicate(answer)) {
      answer.status = "Needs clarification";
      answer.reviewer = "";
      answer.reviewedAt = "";
    }
}
function clearJudgments(a: Assessment, ids?: Set<string>) {
  for (const c of a.criteria) if (!ids || ids.has(c.id)) c.judgment = null;
}
export const commandSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("product"), value: productSchema }),
  z.object({ type: z.literal("answer"), id: name, value: answerInput }),
  z.object({
    type: z.literal("approve"),
    id: name,
    reviewer: name,
    notes: text,
  }),
  z.object({ type: z.literal("test"), id: name.optional(), value: testInput }),
  z.object({ type: z.literal("criterion"), value: criterionInput }),
  z.object({ type: z.literal("judgment"), id: name, value: judgmentInput }),
  z.object({
    type: z.literal("evidence"),
    id: name,
    value: z.object({
      status: z.enum(["Current", "Superseded", "Uncertain"]),
      product: text,
      version: text,
      notes: text,
      excludeFromAI: z.boolean(),
    }),
  }),
]);
export function applyCommand(
  original: Assessment,
  input: unknown,
  actor: string,
): Assessment {
  const command = commandSchema.parse(input),
    a = structuredClone(original);
  demand(actor.trim(), "A named author is required.");
  switch (command.type) {
    case "product": {
      if (JSON.stringify(a.product) !== JSON.stringify(command.value)) {
        a.product = command.value;
        invalidate(a);
        clearJudgments(a);
      }
      break;
    }
    case "answer": {
      demand(
        questions.some((q) => q.id === command.id),
        "Unsupported question identifier.",
      );
      const v = command.value;
      validateReferences(a, v.references);
      for (const id of v.testIds)
        demand(
          a.tests.some((t) => t.id === id),
          "Linked test was not found.",
        );
      if (v.applicability === "Not applicable")
        demand(
          v.applicabilityReason.trim() && v.applicabilityConfirmed,
          "Not applicable requires a reason and human confirmation.",
        );
      if (v.status === "Ready for review")
        demand(
          answerComplete({ ...v, reviewer: "", reviewedAt: "" }),
          "Resolve the answer and applicability before review.",
        );
      a.answers[command.id] = {
        ...v,
        status:
          a.answers[command.id].status === "Approved"
            ? "Needs clarification"
            : v.status,
        reviewer: "",
        reviewedAt: "",
      };
      break;
    }
    case "approve": {
      const v = a.answers[command.id];
      demand(v, "Question not found.");
      demand(
        answerComplete(v),
        "Unknown or incomplete answers cannot be approved.",
      );
      demand(v.author.trim(), "An answer author is required.");
      demand(
        v.references.length || v.testIds.length || v.attestation.trim(),
        "Add documentary evidence, a test, or an explicit human attestation.",
      );
      validateReferences(a, v.references, true);
      for (const id of v.testIds) {
        const t = a.tests.find((t) => t.id === id);
        demand(
          t &&
            ["Pass", "Fail"].includes(t.result) &&
            t.version === a.product.details.version,
          "A linked test must be completed for this product version.",
        );
      }
      demand(
        !conflicts(a).length,
        "Resolve conflicting statements before approval.",
      );
      Object.assign(v, {
        status: "Approved",
        reviewer: command.reviewer,
        reviewedAt: new Date().toISOString(),
        reviewerNotes: command.notes,
      });
      break;
    }
    case "test": {
      const v = command.value;
      demand(
        a.criteria.some((c) => c.id === v.criterionId),
        "Select an existing criterion.",
      );
      validateReferences(a, v.references);
      if (["Pass", "Fail"].includes(v.result)) {
        demand(v.observed.trim(), "Completed tests require observed behavior.");
        demand(
          [
            v.screen,
            v.workflow,
            v.version,
            v.os,
            v.configuration,
            v.method,
            v.tools,
            v.expected,
            v.observed,
            v.tester,
            v.date,
          ].every((x) => !isUnknown(x)),
          "Completed test details cannot be unknown.",
        );
        demand(
          /^\d{4}-\d{2}-\d{2}$/.test(v.date) &&
            Number.isFinite(Date.parse(v.date)),
          "Use a valid YYYY-MM-DD test date.",
        );
      }
      if (v.result === "Fail")
        demand(v.findings.trim(), "Failed tests require a finding.");
      const old = a.tests.find((t) => t.id === command.id);
      if (command.id) demand(old, "Test not found.");
      const t = { ...v, id: old?.id ?? crypto.randomUUID() };
      a.tests = a.tests.filter((x) => x.id !== t.id).concat(t);
      invalidate(a, (x) => x.testIds.includes(t.id));
      clearJudgments(
        a,
        new Set([t.criterionId, ...(old ? [old.criterionId] : [])]),
      );
      break;
    }
    case "criterion": {
      const old = a.criteria.find((c) => c.id === command.value.id);
      a.criteria = a.criteria
        .filter((c) => c.id !== command.value.id)
        .concat({ ...command.value, judgment: null });
      a.product.criteriaInventoryConfirmed = false;
      if (old) invalidate(a);
      break;
    }
    case "judgment": {
      const c = a.criteria.find((c) => c.id === command.id);
      demand(c, "Criterion not found.");
      const v = command.value;
      demand(
        !isUnknown(a.product.details.standard) &&
          !isUnknown(a.product.details.level) &&
          !isUnknown(a.product.details.edition),
        "Set the requested standard, level, and edition first.",
      );
      demand(
        !isUnknown(c.standard) &&
          !isUnknown(c.level) &&
          !c.standard.startsWith("Unspecified") &&
          !c.level.startsWith("Unspecified"),
        "Define the criterion standard and level before judging.",
      );
      demand(
        v.coverageConfirmed,
        "Confirm coverage of the criterion across the stated scope; a single test is not sufficient by itself.",
      );
      if (v.result !== "Not Applicable") {
        const tests = a.tests.filter((t) => t.criterionId === c.id);
        demand(
          tests.length &&
            tests.every(
              (t) =>
                ["Pass", "Fail"].includes(t.result) &&
                t.version === a.product.details.version,
            ),
          "Complete all recorded tests for this criterion and product version.",
        );
        for (const t of tests) validateReferences(a, t.references, true);
        if (v.result === "Supports")
          demand(
            tests.every((t) => t.result === "Pass"),
            "Supports cannot be recorded with failed or untested results.",
          );
      }
      c.judgment = { ...v, reviewedAt: new Date().toISOString() };
      break;
    }
    case "evidence": {
      const e = a.evidence.find((e) => e.id === command.id);
      demand(e, "Evidence not found.");
      Object.assign(e, command.value);
      const affectedTests = a.tests.filter((t) =>
        t.references.some((r) => r.evidenceId === e.id),
      );
      invalidate(
        a,
        (x) =>
          x.references.some((r) => r.evidenceId === e.id) ||
          affectedTests.some((t) => x.testIds.includes(t.id)),
      );
      clearJudgments(a, new Set(affectedTests.map((t) => t.criterionId)));
      break;
    }
  }
  a.revision++;
  a.history.push({
    at: new Date().toISOString(),
    actor,
    action: command.type,
    before: withoutHistory(original),
    after: command,
  });
  return a;
}
function withoutHistory(a: Assessment) {
  const { history, ...rest } = a;
  return rest;
}
export function addEvidence(a: Assessment, e: Evidence, actor: string) {
  const next = structuredClone(a);
  next.evidence.push(e);
  next.revision++;
  next.history.push({
    at: new Date().toISOString(),
    actor,
    action: "upload evidence",
    before: null,
    after: e,
  });
  return next;
}
