import type { Assessment, Reference } from "../shared/model.ts";
import { validateReferences } from "./domain.ts";
export interface Suggestion {
  questionId: string;
  text: string;
  references: Reference[];
}
export interface AssistanceProvider {
  suggest(
    context: Readonly<Assessment>,
    questionId: string,
  ): Promise<Suggestion>;
}
export const aiConfiguration = Object.freeze({
  enabled: false,
  externalProcessing: false,
});
export function validateSuggestion(a: Assessment, s: Suggestion) {
  validateReferences(a, s.references);
  if (
    s.references.some(
      (r) => a.evidence.find((e) => e.id === r.evidenceId)?.excludeFromAI,
    )
  )
    throw new Error("Evidence is excluded from AI processing.");
  return s;
}
// No provider is instantiated. Suggestions have no authority to mutate answers or approvals.
