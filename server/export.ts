import {
  Document,
  Header,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  Footer,
  PageNumber,
} from "docx";
import {
  outstanding,
  questions,
  productFields,
  claimLabels,
  type Assessment,
} from "../shared/model.ts";
import { handoff } from "../shared/handoff.ts";
import { brand, typography } from "../shared/brand.ts";
import { demand } from "./domain.ts";
export function snapshot(a: Assessment, final: boolean, reviewer: string) {
  const issues = outstanding(a);
  if (final) {
    demand(reviewer.trim(), "A report reviewer is required.");
    demand(
      !issues.length,
      "Final report is blocked by outstanding required information or review.",
    );
  }
  return {
    format: "acronym-generic-v1" as const,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    status: final
      ? "Completed preparation package"
      : "Draft preparation package",
    reviewer: final ? reviewer : "",
    notice:
      "Original preparation content. Not an official HECVAT, VPAT-based ACR, OpenACR document, certification, or endorsement.",
    outstanding: issues,
    handoff: handoff(a),
    assessment: structuredClone(a),
  };
}
export type Snapshot = ReturnType<typeof snapshot>;
export type ReportBlock = {
  kind: "title" | "heading1" | "heading2" | "body";
  text: string;
};
export function reportBlocks(s: Snapshot): ReportBlock[] {
  const a = s.assessment;
  const p = (text: string): ReportBlock => ({ kind: "body", text });
  const h = (text: string): ReportBlock => ({ kind: "heading1", text });
  const label = (label: string, value: string): ReportBlock =>
    p(`${label}: ${value || "Not provided"}`);
  const ref = (r: Assessment["answers"][string]["references"][number]) => {
    const e = a.evidence.find((e) => e.id === r.evidenceId);
    return `${e?.fileName ?? r.evidenceId}, ${r.locator}${r.quote ? ` — ${r.quote}` : ""} [SHA-256 ${e?.hash ?? "missing"}]`;
  };
  const guide = s.handoff ?? handoff(a);
  const children = [
    { kind: "title" as const, text: "Vendor Assessment Preparation Guide" },
    p(s.status),
    p(
      `${a.product.details.vendor} · ${a.product.details.product} · ${a.product.details.version}`,
    ),
    p(s.notice),
    p(
      "This package records the stated product scope, responses, supporting sources, tests, and human review. Documentation completeness is not a security or accessibility rating.",
    ),
    label("Snapshot", `${s.id} · ${s.createdAt} · revision ${a.revision}`),
    label("Report reviewer", s.reviewer || "Draft — no final acknowledgment"),
    ...(a.synthetic
      ? [p("SYNTHETIC DEMONSTRATION — no real vendor or customer records")]
      : []),
    h("Your next steps"),
    p(guide.summary),
    p(guide.notice),
    ...guide.next.flatMap((step) => [label(step.title, step.instruction)]),
    h("Finish and submit the requested documents"),
    ...guide.submissionSteps.map((step, i) =>
      label(`${i + 1} ${step.title}`, step.instruction),
    ),
    h("Reviewed response blocks for transfer"),
    p(
      "Read the actual question before reusing any block. Verify its fit and keep its limitations and evidence references. Unapproved and stale responses remain in the assessment section, not in these transfer blocks.",
    ),
    ...(guide.responses.length
      ? guide.responses.flatMap((r) => [
          label(r.id, r.title),
          ...r.text.split("\n").map(p),
        ])
      : [
          p(
            "No reviewed response blocks are available yet. Drafts and missing responses appear below for follow-up.",
          ),
        ]),
    h("Reviewed accessibility blocks for transfer"),
    ...(guide.accessibility.length
      ? guide.accessibility.flatMap((r) => [
          label(r.id, r.title),
          ...r.text.split("\n").map(p),
        ])
      : [
          p(
            "No reviewed criterion judgments are ready for transfer. Record evaluations and human judgments; keep unresolved criteria visible in the draft.",
          ),
        ]),
    h("Product and assessment details"),
    ...Object.entries(productFields).map(([key, title]) =>
      label(
        title,
        `${a.product.details[key as keyof typeof productFields]}${a.product.confirmed.includes(key as keyof typeof productFields) ? " [confirmed]" : " [unconfirmed]"}`,
      ),
    ),
    ...Object.entries(a.product.claims).map(([key, value]) =>
      label(claimLabels[key as keyof typeof claimLabels], value),
    ),
    h("Security preparation responses"),
  ];
  for (const q of questions) {
    const v = a.answers[q.id];
    children.push(
      { kind: "heading2", text: `${q.id} ${q.wording}` },
      label("Response", v.response || "Unanswered"),
      label("Applicability", v.applicability),
      label("Applicability reason", v.applicabilityReason),
      label(
        "Non-applicability confirmed",
        v.applicability === "Not applicable"
          ? v.applicabilityConfirmed
            ? "Yes"
            : "No"
          : "No exclusion requested",
      ),
      label("Explanation", v.explanation),
      label("Author", v.author),
      label("Review status", v.status),
      label(
        "Reviewer",
        v.reviewer ? `${v.reviewer} ${v.reviewedAt}` : "Not reviewed",
      ),
      label("Comments", v.comments),
      label("Reviewer notes", v.reviewerNotes),
      label("Human attestation", v.attestation),
      label("Linked tests", v.testIds.join(", ")),
      ...v.references.map((r) => label("Documentary evidence", ref(r))),
    );
  }
  children.push(
    h("Evidence register"),
    p(
      "Policies describe stated policy; they do not establish implementation. Source text is untrusted data, never an instruction to the application.",
    ),
  );
  for (const e of a.evidence)
    children.push(
      label(
        e.fileName,
        `${e.status}; ${e.product} ${e.version}; uploaded ${e.uploadedAt}; SHA-256 ${e.hash}; ${e.extraction}`,
      ),
      label("Locations", e.segments.map((s) => s.locator).join(", ")),
      label("Relevance notes", e.notes),
    );
  children.push(
    h("Accessibility judgments and test findings"),
    p(
      "Starter areas are not a complete standards inventory. Judgments apply only to the explicitly recorded scope. Test outcomes and human criterion judgments are separate.",
    ),
  );
  for (const c of a.criteria)
    children.push(
      label(
        `${c.id} ${c.title}`,
        `${c.standard}; ${c.level}; scope: ${c.scope}`,
      ),
      label(
        "Human judgment",
        c.judgment
          ? `${c.judgment.result} — ${c.judgment.explanation}; reviewer ${c.judgment.reviewer}; ${c.judgment.reviewedAt}`
          : "Unresolved required criterion — no judgment recorded",
      ),
    );
  for (const t of a.tests) {
    children.push({ kind: "heading2", text: `Test ${t.id}` });
    for (const [key, val] of Object.entries(t).filter(
      ([k]) => k !== "references",
    ))
      children.push(
        label(
          (
            {
              criterionId: "Criterion",
              screen: "Screens and controls",
              workflow: "Workflow",
              version: "Tested product version",
              os: "Operating system",
              configuration: "Configuration",
              method: "Test method",
              tools: "Tools and assistive technologies",
              expected: "Expected behavior",
              observed: "Observed behavior",
              tester: "Tester",
              date: "Test date",
              result: "Test result",
              findings: "Findings",
              limitations: "Testing limitations",
              remediation: "Remediation notes",
              id: "Test identifier",
            } as Record<string, string>
          )[key] || key,
          String(val),
        ),
      );
    children.push(...t.references.map((r) => label("Test evidence", ref(r))));
  }
  children.push(
    h("Outstanding issues"),
    ...(s.outstanding.length
      ? s.outstanding.map(p)
      : [
          p(
            "No outstanding documentation or review tasks in the stated generic scope. Documented failures may remain below. This does not establish conformance or certification.",
          ),
        ]),
    ...a.tests
      .filter((t) => t.result === "Fail" || t.result === "Blocked")
      .map((t) =>
        p(
          `${t.workflow}: ${t.result} — ${t.findings}; remediation: ${t.remediation}`,
        ),
      ),
    h("Review and revision history"),
  );
  for (const e of a.history) {
    children.push(p(`${e.at} · ${e.actor} · ${e.action}`));
    const after = e.after as {
      type?: string;
      id?: string;
      reviewer?: string;
      notes?: string;
    };
    if (after?.type === "approve")
      children.push(
        p(
          `Answer ${after.id}; reviewer ${after.reviewer}; notes ${after.notes || "none"}`,
        ),
      );
  }
  children.push(
    p(
      "The companion JSON preserves complete prior values and command payloads for every recorded revision. Reviewer names are acknowledgments, not verified identities or cryptographic signatures.",
    ),
  );
  return children;
}
export async function renderReport(s: Snapshot) {
  const children = reportBlocks(s).map(
    (block) =>
      new Paragraph({
        text: block.text,
        heading:
          block.kind === "title"
            ? HeadingLevel.TITLE
            : block.kind === "heading1"
              ? HeadingLevel.HEADING_1
              : block.kind === "heading2"
                ? HeadingLevel.HEADING_2
                : undefined,
        spacing: {
          before: block.kind === "heading1" ? 240 : 0,
          after: block.kind === "body" ? 100 : 140,
        },
        keepNext: block.kind !== "body",
        widowControl: true,
      }),
  );
  return Packer.toBuffer(
    new Document({
      creator: "Acronym local assessment workspace",
      title: "Vendor Assessment Report",
      description: s.notice,
      styles: {
        default: {
          document: {
            run: { font: typography.body, size: 22, color: "000000" },
            paragraph: { spacing: { line: 276 } },
          },
        },
        paragraphStyles: [
          {
            id: "Title",
            name: "Title",
            basedOn: "Normal",
            run: {
              font: typography.heading,
              size: 40,
              bold: true,
              color: "000000",
            },
          },
          {
            id: "Heading1",
            name: "Heading 1",
            basedOn: "Normal",
            next: "Normal",
            quickFormat: true,
            run: {
              font: typography.heading,
              size: 28,
              bold: true,
              color: "000000",
            },
          },
          {
            id: "Heading2",
            name: "Heading 2",
            basedOn: "Normal",
            next: "Normal",
            quickFormat: true,
            run: {
              font: typography.heading,
              size: 24,
              bold: true,
              color: "000000",
            },
          },
        ],
      },
      sections: [
        {
          properties: {
            page: {
              size: { width: 12240, height: 15840 },
              margin: { top: 1080, bottom: 1080, left: 1080, right: 1080 },
            },
          },
          headers: {
            default: new Header({
              children: [
                new Paragraph({
                  shading: { fill: brand.primary },
                  spacing: { after: 180 },
                  children: [
                    new TextRun({
                      text: "  ACRONYM  |  VENDOR ASSESSMENT GUIDE",
                      font: typography.heading,
                      bold: true,
                      color: brand.secondary,
                      size: 20,
                    }),
                  ],
                }),
              ],
            }),
          },
          footers: {
            default: new Footer({
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: `${s.status} · Page `,
                      font: typography.heading,
                      color: brand.primary,
                    }),
                    new TextRun({
                      font: typography.heading,
                      children: [PageNumber.CURRENT],
                    }),
                  ],
                }),
              ],
            }),
          },
          children,
        },
      ],
    }),
  );
}
