import {
  Document,
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
    status: final ? "Final generic assessment" : "Draft generic assessment",
    reviewer: final ? reviewer : "",
    notice:
      "Original preparation content. Not an official HECVAT, VPAT-based ACR, OpenACR document, certification, or endorsement.",
    outstanding: issues,
    assessment: structuredClone(a),
  };
}
export type Snapshot = ReturnType<typeof snapshot>;
export async function renderReport(s: Snapshot) {
  const a = s.assessment;
  const p = (text: string) =>
    new Paragraph({
      children: [new TextRun(text)],
      spacing: { after: 100 },
      widowControl: true,
    });
  const h = (text: string) =>
    new Paragraph({
      text,
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 240, after: 140 },
      keepNext: true,
    });
  const label = (label: string, value: string) =>
    new Paragraph({
      children: [
        new TextRun({ text: `${label}: `, bold: true }),
        new TextRun(value || "Not provided"),
      ],
      spacing: { after: 100 },
      widowControl: true,
    });
  const ref = (r: Assessment["answers"][string]["references"][number]) => {
    const e = a.evidence.find((e) => e.id === r.evidenceId);
    return `${e?.fileName ?? r.evidenceId}, ${r.locator}${r.quote ? ` — ${r.quote}` : ""} [SHA-256 ${e?.hash ?? "missing"}]`;
  };
  const children = [
    new Paragraph({
      text: "Vendor Assessment Report",
      heading: HeadingLevel.TITLE,
    }),
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
      new Paragraph({
        text: `${q.id} ${q.wording}`,
        heading: HeadingLevel.HEADING_2,
        keepNext: true,
      }),
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
    children.push(
      new Paragraph({
        text: `Test ${t.id}`,
        heading: HeadingLevel.HEADING_2,
        keepNext: true,
      }),
    );
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
  return Packer.toBuffer(
    new Document({
      creator: "Acronym local assessment workspace",
      title: "Vendor Assessment Report",
      description: s.notice,
      styles: {
        default: {
          document: {
            run: { font: "Arial", size: 22, color: "000000" },
            paragraph: { spacing: { line: 276 } },
          },
        },
        paragraphStyles: [
          {
            id: "Title",
            name: "Title",
            basedOn: "Normal",
            run: { font: "Arial", size: 40, bold: true, color: "000000" },
          },
          {
            id: "Heading1",
            name: "Heading 1",
            basedOn: "Normal",
            next: "Normal",
            quickFormat: true,
            run: { size: 28, bold: true, color: "000000" },
          },
          {
            id: "Heading2",
            name: "Heading 2",
            basedOn: "Normal",
            next: "Normal",
            quickFormat: true,
            run: { size: 24, bold: true, color: "000000" },
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
          footers: {
            default: new Footer({
              children: [
                new Paragraph({
                  children: [
                    new TextRun(`${s.status} · Page `),
                    new TextRun({ children: [PageNumber.CURRENT] }),
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
