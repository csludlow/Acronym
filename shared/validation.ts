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
} from "./model.ts";
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
export const backupSchema = z.object({
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
