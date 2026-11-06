import {
  productFields,
  questions,
  isUnknown,
  answerComplete,
  type Assessment,
  type ProductKey,
} from "./model.ts";

// Resume from recorded content, never from a trusted approval or a guessed
// saved screen number. Older portable backups work without a format change.
export function resumePoint(a: Assessment) {
  const fields = Object.keys(productFields) as ProductKey[];
  const detail = fields.findIndex(
    (key) =>
      isUnknown(a.product.details[key]) ||
      !a.product.confirmed.includes(key) ||
      (key === "assessmentDate" &&
        (!/^\d{4}-\d{2}-\d{2}$/.test(a.product.details[key]) ||
          !Number.isFinite(Date.parse(a.product.details[key])))),
  );
  if (detail >= 0)
    return { tab: "Product setup" as const, section: "setup", step: detail };
  const claims = [
    "externalTransmissions",
    "carrierTraffic",
    "vendorDataAccess",
    "remoteAccess",
    "encryption",
  ] as const;
  const claim = claims.findIndex((key) => a.product.claims[key] === "Unknown");
  if (claim >= 0)
    return {
      tab: "Product setup" as const,
      section: "setup",
      step: fields.length + claim,
    };
  if (!a.product.criteriaInventoryConfirmed)
    return {
      tab: "Product setup" as const,
      section: "setup",
      step: fields.length + claims.length,
    };
  const question = questions.findIndex((q) => !answerComplete(a.answers[q.id]));
  if (question >= 0)
    return {
      tab: "Questionnaire" as const,
      section: "questions",
      step: question,
    };
  if (a.criteria.some((c) => !c.judgment))
    return { tab: "Accessibility" as const, section: "", step: 0 };
  return { tab: "Review queue" as const, section: "", step: 0 };
}
