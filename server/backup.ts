import { z } from "zod";
import {
  answerInput,
  productSchema,
  testInput,
  criterionInput,
  judgmentInput,
  states,
  text,
  name,
  referenceSchema,
  questions,
  type Assessment,
} from "../shared/model.ts";
import { Store, hash } from "./store.ts";
import { demand, validateReferences } from "./domain.ts";
const evidenceSchema = z.object({
  id: name,
  fileName: name,
  hash: z.string().regex(/^[a-f0-9]{64}$/),
  uploadedAt: name,
  product: text,
  version: text,
  status: z.enum(["Current", "Superseded", "Uncertain"]),
  extraction: z.enum(["Extracted", "Manual transcription required"]),
  segments: z
    .array(z.object({ locator: name, text: z.string().max(8 * 1024 * 1024) }))
    .max(50000),
  notes: text,
  excludeFromAI: z.boolean(),
});
export const assessmentSchema = z.object({
  id: name,
  revision: z.number().int().nonnegative(),
  synthetic: z.boolean(),
  createdAt: name,
  product: productSchema,
  answers: z.record(
    z.string(),
    answerInput.extend({
      status: z.enum(states),
      reviewer: text,
      reviewedAt: text,
    }),
  ),
  evidence: z.array(evidenceSchema).max(500),
  tests: z.array(testInput.extend({ id: name })).max(5000),
  criteria: z
    .array(
      criterionInput.extend({
        judgment: judgmentInput.extend({ reviewedAt: name }).nullable(),
      }),
    )
    .max(1000),
  history: z
    .array(
      z.object({
        at: name,
        actor: text,
        action: text,
        before: z.unknown(),
        after: z.unknown(),
      }),
    )
    .max(10000),
});
const backupSchema = z.object({
  format: z.literal("acronym-backup-v1"),
  assessment: assessmentSchema,
  files: z
    .array(
      z.object({
        hash: z.string().regex(/^[a-f0-9]{64}$/),
        data: z.string().max(14 * 1024 * 1024),
      }),
    )
    .max(500),
});
export function backup(store: Store, id: string) {
  const assessment = store.get(id);
  return {
    format: "acronym-backup-v1",
    assessment,
    files: [...new Set(assessment.evidence.map((e) => e.hash))].map(
      (digest) => ({
        hash: digest,
        data: store.file(digest).toString("base64"),
      }),
    ),
  };
}
export function restore(store: Store, input: unknown) {
  const b = backupSchema.parse(input);
  const a = b.assessment as Assessment;
  demand(
    questions.every((q) => a.answers[q.id]) &&
      Object.keys(a.answers).length === questions.length,
    "Unsupported question set in backup.",
  );
  for (const collection of [a.evidence, a.tests, a.criteria])
    demand(
      new Set(collection.map((x) => x.id)).size === collection.length,
      "Duplicate identifiers in backup.",
    );
  const files = new Map(
    b.files.map((f) => [f.hash, Buffer.from(f.data, "base64")]),
  );
  for (const e of a.evidence) {
    const bytes = files.get(e.hash);
    demand(
      bytes && bytes.length <= 10 * 1024 * 1024 && hash(bytes) === e.hash,
      "Backup evidence hash mismatch or missing file.",
    );
  }
  for (const v of Object.values(a.answers)) {
    validateReferences(a, v.references);
    demand(
      v.testIds.every((id) => a.tests.some((t) => t.id === id)),
      "Backup has a missing test reference.",
    );
  }
  for (const t of a.tests) {
    validateReferences(a, t.references);
    demand(
      a.criteria.some((c) => c.id === t.criterionId),
      "Backup has a missing criterion.",
    );
  }
  const originalId = a.id;
  a.id = crypto.randomUUID();
  a.revision++;
  for (const v of Object.values(a.answers))
    if (v.status === "Approved") {
      v.status = "Needs clarification";
      v.reviewer = "";
      v.reviewedAt = "";
    }
  for (const c of a.criteria) c.judgment = null;
  a.history.push({
    at: new Date().toISOString(),
    actor: "Local restore",
    action: "Restored as a copy; approvals require review",
    before: { originalId },
    after: { newId: a.id },
  });
  for (const e of a.evidence) store.putFile(files.get(e.hash)!);
  store.insert(a);
  return a;
}
