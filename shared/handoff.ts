import {
  answerComplete,
  conflicts,
  isUnknown,
  outstanding,
  questions,
  type Assessment,
} from "./model.ts";

export type Destination =
  | "Product setup"
  | "Evidence"
  | "Questionnaire"
  | "Accessibility"
  | "Review queue";
export type HandoffStep = {
  title: string;
  instruction: string;
  destination?: Destination;
};
export const submissionSteps: HandoffStep[] = [
  {
    title: "Confirm the purchaser’s requested deliverables",
    instruction:
      "Ask for the exact questionnaire version and accessibility report edition, standards, level, product scope, due date, and submission contact. Record their answers in Product setup.",
    destination: "Product setup",
  },
  {
    title: "Open the requested documents",
    instruction:
      "Obtain the requested HECVAT workbook from EDUCAUSE and the appropriate VPAT® edition from ITI, or use the purchaser’s supplied files. Keep an unchanged original and work in a copy.",
  },
  {
    title: "Transfer reviewed material and finish the remaining coverage",
    instruction:
      "Use the reviewed response blocks below as source material. Read each actual question or criterion before transferring text. Our preparation identifiers are not official question identifiers and we do not map them automatically. Follow the actual workbook’s scoping instructions and cover every required criterion; the starter areas are only a starting point.",
  },
  {
    title: "Keep limitations and unresolved items visible",
    instruction:
      "Carry over negative answers, failed tests, scope limits, and supporting references accurately. Obtain missing facts and finish required testing. Do not turn unknowns into positive answers or non-applicability.",
    destination: "Accessibility",
  },
  {
    title: "Have a human check the completed documents",
    instruction:
      "Check product/version, dates, contact, methods, standards, explanations, source currency, and purchaser requirements. Preserve workbook formulas and evaluation functionality and the report template’s required wording and structure.",
  },
  {
    title: "Send the requested files and retain your record",
    instruction:
      "Review evidence for sensitive information and share only appropriate supporting files through the purchaser’s agreed channel. Send the functioning HECVAT workbook when requested and the requested accessibility report. Retain the issued files, this preparation snapshot, and a backup. A completed preparation package still needs this handoff.",
  },
];

export function handoff(a: Assessment) {
  const issues = outstanding(a),
    approved = questions.filter(
      (q) =>
        a.answers[q.id].status === "Approved" &&
        answerComplete(a.answers[q.id]),
    );
  const next: HandoffStep[] = [];
  if (conflicts(a).length)
    next.push({
      title: "Clarify conflicting product statements",
      instruction: conflicts(a).join(" "),
      destination: "Product setup",
    });
  if (
    ["questionnaire", "standard", "level", "edition", "scope"].some(
      (k) =>
        isUnknown(a.product.details[k as keyof typeof a.product.details]) ||
        !a.product.confirmed.includes(k as keyof typeof a.product.details),
    )
  )
    next.push(submissionSteps[0]);
  const unanswered = questions.filter((q) => !answerComplete(a.answers[q.id]));
  if (unanswered.length)
    next.push({
      title: `Work through ${unanswered.length} unresolved preparation questions`,
      instruction:
        "Start with what you know. Record Unknown when a fact is missing and ask the responsible product, support, or institution contact. Add a source or an explicit firsthand attestation.",
      destination: "Questionnaire",
    });
  const unreviewed = questions.filter(
    (q) =>
      answerComplete(a.answers[q.id]) && a.answers[q.id].status !== "Approved",
  );
  if (unreviewed.length)
    next.push({
      title: `Review ${unreviewed.length} drafted responses`,
      instruction:
        "Check the explanation and supporting sources, then record a named human review. No can be an accurate, complete response.",
      destination: "Review queue",
    });
  if (
    !a.product.criteriaInventoryConfirmed ||
    a.criteria.some((c) => !c.judgment) ||
    a.tests.some((t) => ["Untested", "Blocked"].includes(t.result))
  )
    next.push({
      title: "Finish the accessibility scope and evaluation",
      instruction:
        "Confirm the purchaser’s full criterion inventory, record representative tests and limitations, and make separate human criterion judgments. Document failures honestly; successful starter tests alone do not establish conformance.",
      destination: "Accessibility",
    });
  if (
    a.evidence.some(
      (e) =>
        e.status !== "Current" ||
        e.extraction === "Manual transcription required",
    )
  )
    next.push({
      title: "Check evidence relevance and readable text",
      instruction:
        "Resolve uncertain or superseded sources before relying on them. Inspect scanned or unreadable pages and attach a transcription when needed.",
      destination: "Evidence",
    });
  if (issues.length && !next.length)
    next.push({
      title: "Finish the preparation checklist",
      instruction:
        "Confirm remaining product facts and reviews in the detailed completion checklist before marking the preparation package complete.",
      destination: "Product setup",
    });
  if (!issues.length) next.push(submissionSteps[1], submissionSteps[2]);
  const responses = approved.map((q) => {
    const v = a.answers[q.id];
    const sources = v.references.map((r) => {
      const e = a.evidence.find((e) => e.id === r.evidenceId);
      return `${e?.fileName || r.evidenceId} — ${r.locator}${r.quote ? ` — "${r.quote}"` : ""}`;
    });
    const tests = v.testIds.map((id) => {
      const t = a.tests.find((t) => t.id === id);
      return t
        ? `${t.workflow} — ${t.result}; ${t.version}; ${t.date}; ${t.observed}`
        : id;
    });
    return {
      id: q.id,
      title: q.wording,
      text: [
        `Preparation topic: ${q.wording}`,
        `Product: ${a.product.details.product} ${a.product.details.version}`,
        `Applicability: ${v.applicability}`,
        ...(v.applicability === "Not applicable"
          ? [`Reason: ${v.applicabilityReason}`]
          : [`Response: ${v.response}`, `Explanation: ${v.explanation}`]),
        ...sources.map((s) => `Documentary evidence: ${s}`),
        ...tests.map((t) => `Test result: ${t}`),
        ...(v.attestation ? [`Human attestation: ${v.attestation}`] : []),
        `Author: ${v.author}`,
        `Reviewed by: ${v.reviewer} on ${v.reviewedAt}`,
        `Reviewer notes: ${v.reviewerNotes || "None recorded"}`,
      ].join("\n"),
    };
  });
  return {
    preparationComplete: !issues.length,
    summary: issues.length
      ? `${approved.length} of ${questions.length} preparation responses reviewed; ${issues.length} preparation tasks remain.`
      : "Preparation checklist complete for the recorded scope. Complete the requested documents and human submission review next.",
    targets: {
      questionnaire: a.product.details.questionnaire,
      standard: a.product.details.standard,
      level: a.product.details.level,
      edition: a.product.details.edition,
      scope: a.product.details.scope,
    },
    next,
    submissionSteps,
    responses,
    accessibility: a.criteria
      .filter((c) => c.judgment)
      .map((c) => ({
        id: c.id,
        title: c.title,
        text: [
          `Criterion: ${c.id} ${c.title}`,
          `Standard: ${c.standard}; level: ${c.level}`,
          `Scope: ${c.scope}`,
          `Product: ${a.product.details.product} ${a.product.details.version}`,
          `Human criterion judgment: ${c.judgment!.result}`,
          `Explanation: ${c.judgment!.explanation}`,
          `Reviewed by: ${c.judgment!.reviewer} on ${c.judgment!.reviewedAt}`,
          ...a.tests
            .filter((t) => t.criterionId === c.id)
            .flatMap((t) => [
              `Test: ${t.workflow}; screens: ${t.screen}; outcome: ${t.result}; version: ${t.version}; OS: ${t.os}; configuration: ${t.configuration}`,
              `Method: ${t.method}; tools and assistive technologies: ${t.tools}; tester: ${t.tester}; date: ${t.date}`,
              `Expected: ${t.expected}`,
              `Observed: ${t.observed}`,
              `Findings: ${t.findings || "None recorded"}`,
              `Limitations: ${t.limitations || "None recorded"}`,
              `Remediation: ${t.remediation || "None recorded"}`,
              ...t.references.map(
                (r) =>
                  `Test evidence: ${a.evidence.find((e) => e.id === r.evidenceId)?.fileName || r.evidenceId} — ${r.locator}${r.quote ? ` — "${r.quote}"` : ""}`,
              ),
            ]),
        ].join("\n"),
      })),
    remaining: questions
      .filter((q) => !approved.includes(q))
      .map((q) => ({
        id: q.id,
        title: q.wording,
        status: a.answers[q.id].status,
      })),
    notice:
      "Unofficial preparation guide. Reviewed material is reusable source text, not a completed HECVAT workbook or VPAT-based Accessibility Conformance Report. Original preparation identifiers must not be treated as official mappings.",
  };
}
