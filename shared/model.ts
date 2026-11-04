import { z } from "zod";
export const text = z.string().max(30000);
export const name = z.string().trim().min(1).max(200);
export const states = [
  "Unanswered",
  "Draft",
  "Needs clarification",
  "Ready for review",
  "Approved",
] as const;
export const productFields = {
  vendor: "Vendor name",
  product: "Product name",
  version: "Product version",
  assessmentDate: "Assessment date",
  description: "Product description",
  deployment: "Deployment model",
  operatingSystems: "Supported operating systems",
  users: "Users",
  workflows: "Main workflows",
  collected: "Data collected",
  stored: "Data stored",
  transmitted: "Data transmitted",
  deleted: "Data deletion and retention",
  locations: "Storage locations",
  backups: "Backups",
  connections: "External connections",
  integrations: "Campus and other integrations",
  remoteSupport: "Remote support and diagnostic access",
  payments: "Payment involvement",
  responsibilities: "Vendor and institution responsibilities",
  owner: "Assessment owner",
  contact: "Report contact",
  questionnaire: "Requested questionnaire and version",
  standard: "Requested accessibility standard",
  level: "Requested level",
  edition: "Requested report edition",
  scope: "Evaluation scope and exclusions",
  methods: "Evaluation methods",
} as const;
export type ProductKey = keyof typeof productFields;
export const claimLabels = {
  externalTransmissions: "External transmissions",
  carrierTraffic: "Carrier service traffic",
  vendorDataAccess: "Vendor data access",
  remoteAccess: "Remote support data access",
  encryption: "Encryption provider",
};
export const productSchema = z.object({
  details: z.record(
    z.enum(Object.keys(productFields) as [ProductKey, ...ProductKey[]]),
    text,
  ),
  confirmed: z.array(
    z.enum(Object.keys(productFields) as [ProductKey, ...ProductKey[]]),
  ),
  claims: z.object({
    externalTransmissions: z.enum(["Unknown", "Yes", "No"]),
    carrierTraffic: z.enum(["Unknown", "Yes", "No"]),
    vendorDataAccess: z.enum(["Unknown", "Yes", "No"]),
    remoteAccess: z.enum(["Unknown", "Yes", "No"]),
    encryption: z.enum([
      "Unknown",
      "None",
      "Application",
      "Workstation",
      "Both",
    ]),
  }),
  criteriaInventoryConfirmed: z.boolean(),
});
export const referenceSchema = z.object({
  evidenceId: name,
  locator: name,
  quote: text.default(""),
});
export const answerInput = z.object({
  response: z.enum(["", "Yes", "No", "Unknown", "Narrative"]),
  explanation: text,
  applicability: z.enum(["Applicable", "Unknown", "Not applicable"]),
  applicabilityReason: text,
  applicabilityConfirmed: z.boolean(),
  author: text,
  comments: text,
  reviewerNotes: text,
  references: z.array(referenceSchema).max(100),
  testIds: z.array(name).max(100),
  attestation: text,
  status: z.enum([
    "Unanswered",
    "Draft",
    "Needs clarification",
    "Ready for review",
  ]),
});
export const testInput = z.object({
  criterionId: name,
  screen: name,
  workflow: name,
  version: name,
  os: name,
  configuration: name,
  method: name,
  tools: name,
  expected: name,
  observed: text,
  tester: name,
  date: name,
  result: z.enum(["Untested", "Pass", "Fail", "Blocked"]),
  references: z.array(referenceSchema).max(100),
  findings: text,
  limitations: text,
  remediation: text,
});
export const criterionInput = z.object({
  id: name,
  title: name,
  standard: name,
  level: name,
  scope: name,
});
export const judgmentInput = z.object({
  result: z.enum([
    "Supports",
    "Partially Supports",
    "Does Not Support",
    "Not Applicable",
  ]),
  explanation: name,
  coverageConfirmed: z.boolean(),
  reviewer: name,
});
export type Product = z.infer<typeof productSchema>;
export type Reference = z.infer<typeof referenceSchema>;
export type Answer = Omit<z.infer<typeof answerInput>, "status"> & {
  status: (typeof states)[number];
  reviewer: string;
  reviewedAt: string;
};
export type Test = z.infer<typeof testInput> & { id: string };
export type Criterion = z.infer<typeof criterionInput> & {
  judgment: null | (z.infer<typeof judgmentInput> & { reviewedAt: string });
};
export type Evidence = {
  id: string;
  fileName: string;
  hash: string;
  uploadedAt: string;
  product: string;
  version: string;
  status: "Current" | "Superseded" | "Uncertain";
  extraction: "Extracted" | "Manual transcription required";
  segments: { locator: string; text: string }[];
  notes: string;
  excludeFromAI: boolean;
};
export type Event = {
  at: string;
  actor: string;
  action: string;
  before: unknown;
  after: unknown;
};
export type Assessment = {
  id: string;
  revision: number;
  synthetic: boolean;
  createdAt: string;
  product: Product;
  answers: Record<string, Answer>;
  evidence: Evidence[];
  tests: Test[];
  criteria: Criterion[];
  history: Event[];
};
export type Question = {
  id: string;
  group: string;
  wording: string;
  explanation: string;
  format: string;
  evidence: string;
  applicability: string;
};
export const questions: Question[] = [
  [
    "DEMO-DATA-01",
    "Data and connections",
    "Is information transmitted outside the installation?",
    "Consider carrier services, updates, telemetry, diagnostics, backups, and payment services. No campus integration does not mean no network traffic.",
    "Yes / No / Unknown, with destinations and purpose",
    "Data-flow diagram; network capture; configuration",
  ],
  [
    "DEMO-DATA-02",
    "Data and connections",
    "Can vendor personnel access customer data?",
    "Include remote support, diagnostic bundles, database copies, and backup access.",
    "Yes / No / Unknown, with access conditions",
    "Support procedure; access logs; named attestation",
  ],
  [
    "DEMO-DATA-03",
    "Data and connections",
    "How is stored information protected?",
    "Separate application encryption from workstation disk encryption and assign responsibility for configuration.",
    "Narrative or Unknown; identify the protection provider",
    "Configuration and key-management notes",
  ],
  [
    "DEMO-OPS-01",
    "Operations",
    "Are backups and recovery procedures tested?",
    "State what is backed up, who is responsible, and when recovery was last tested. A written policy is not proof of execution.",
    "Yes / No / Unknown, with explanation",
    "Restore test; backup configuration; policy",
  ],
  [
    "DEMO-OPS-02",
    "Operations",
    "How is access granted and removed?",
    "Describe employee and student-worker accounts, permissions, and removal procedures.",
    "Narrative or Unknown",
    "Account lifecycle procedure; role test",
  ],
  [
    "DEMO-OPS-03",
    "Operations",
    "Is payment information handled by this product?",
    "Check terminals, receipts, processors, and support logs before deciding applicability.",
    "Yes / No / Unknown, with payment boundaries",
    "Payment flow; processor documentation",
  ],
  [
    "DEMO-GOV-01",
    "Governance",
    "How are incidents and vulnerabilities handled?",
    "Describe actual reporting, triage, updates, and customer notification. A missing process can be stated honestly.",
    "Narrative or Unknown",
    "Incident procedure; remediation records",
  ],
  [
    "DEMO-GOV-02",
    "Governance",
    "How are accessibility limitations communicated?",
    "Describe the testing scope, known failures, and how customers receive limitations and remediation plans.",
    "Narrative or Unknown",
    "Testing log; release notes; support guidance",
  ],
].map(([id, group, wording, explanation, format, evidence]) => ({
  id,
  group,
  wording,
  explanation,
  format,
  evidence,
  applicability:
    "Original preparation question. No official HECVAT scoping rule is implemented. Keep visible; a human must justify and confirm any non-applicability.",
}));
export const starters = [
  {
    id: "STARTER-KEYBOARD",
    title: "Keyboard and focus",
    instruction:
      "Use only the keyboard to reach and operate every control in the chosen workflow. Check visible focus, logical order, dialogs, and escape paths.",
  },
  {
    id: "STARTER-NAMES",
    title: "Labels and accessible names",
    instruction:
      "Inspect names, roles, states, and relationships. Compare visible labels with assistive-technology output, including unlabeled icon buttons.",
  },
  {
    id: "STARTER-READER",
    title: "Screen-reader interaction",
    instruction:
      "Use the supported screen reader to navigate and act on controls. Record announcements, state changes, and dynamic updates.",
  },
  {
    id: "STARTER-ERRORS",
    title: "Error identification and correction",
    instruction:
      "Trigger a validation error. Check that the error is identified, associated with its field, announced, and can be corrected without losing work.",
  },
  {
    id: "STARTER-VISUAL",
    title: "Contrast and enlargement",
    instruction:
      "Measure relevant text and control contrast. Enlarge text or use supported display scaling and check for clipped information and unavailable actions.",
  },
  {
    id: "STARTER-TASKS",
    title: "Complete important tasks",
    instruction:
      "Complete representative end-to-end tasks with keyboard and assistive technology. Record interruptions, workarounds, and any task that cannot be completed.",
  },
];
export function emptyAnswer(): Answer {
  return {
    response: "",
    explanation: "",
    applicability: "Applicable",
    applicabilityReason: "",
    applicabilityConfirmed: false,
    author: "",
    comments: "",
    reviewerNotes: "",
    references: [],
    testIds: [],
    attestation: "",
    status: "Unanswered",
    reviewer: "",
    reviewedAt: "",
  };
}
export function newAssessment(id: string, synthetic = false): Assessment {
  const details = Object.fromEntries(
    Object.keys(productFields).map((k) => [k, "Unknown"]),
  ) as Product["details"];
  details.questionnaire = "Original preparation questions v1";
  if (synthetic)
    Object.assign(details, {
      vendor: "ParcelWorks Demo",
      product: "Campus Parcel Desk",
      version: "0.9 synthetic",
      description:
        "Synthetic postal-services point-of-sale software. Initial customer descriptions require confirmation.",
      deployment: "Native Windows desktop",
      operatingSystems: "Windows 11",
      users: "Employees and student workers",
      workflows:
        "Create shipment; edit address; respond to validation error; print label",
      stored: "Shipment names and addresses stored locally",
      integrations: "Customer reports no campus data-system integrations",
    });
  return {
    id,
    revision: 0,
    synthetic,
    createdAt: new Date().toISOString(),
    product: {
      details,
      confirmed: [],
      claims: {
        externalTransmissions: "Unknown",
        carrierTraffic: "Unknown",
        vendorDataAccess: "Unknown",
        remoteAccess: "Unknown",
        encryption: "Unknown",
      },
      criteriaInventoryConfirmed: false,
    },
    answers: Object.fromEntries(questions.map((q) => [q.id, emptyAnswer()])),
    evidence: [],
    tests: [],
    criteria: starters.map((s) => ({
      id: s.id,
      title: s.title,
      standard: "Unspecified starter area",
      level: "Unspecified",
      scope: "Define screens and workflows before judging",
      judgment: null,
    })),
    history: [],
  };
}
export function isUnknown(value: string) {
  return (
    !value.trim() || /^(unknown|unspecified|tbd|not sure)$/i.test(value.trim())
  );
}
export function conflicts(a: Assessment): string[] {
  const c = a.product.claims,
    result: string[] = [];
  if (c.externalTransmissions === "No" && c.carrierTraffic === "Yes")
    result.push(
      "No external transmissions conflicts with documented carrier traffic.",
    );
  if (c.vendorDataAccess === "No" && c.remoteAccess === "Yes")
    result.push(
      "No vendor data access conflicts with remote-support data access.",
    );
  if (
    a.answers["DEMO-DATA-01"].response === "No" &&
    (c.externalTransmissions === "Yes" || c.carrierTraffic === "Yes")
  )
    result.push(
      "The transmission answer says No while product setup records external traffic.",
    );
  if (
    a.answers["DEMO-DATA-02"].response === "No" &&
    (c.vendorDataAccess === "Yes" || c.remoteAccess === "Yes")
  )
    result.push(
      "The vendor access answer says No while product setup records access.",
    );
  if (
    /encrypt/i.test(a.answers["DEMO-DATA-03"].explanation) &&
    ["Unknown", "None"].includes(c.encryption)
  )
    result.push(
      "The encryption explanation needs clarification of application versus workstation protection.",
    );
  return result;
}
export function answerComplete(a: Answer) {
  return a.applicability === "Not applicable"
    ? !!a.applicabilityReason.trim() && a.applicabilityConfirmed
    : a.applicability === "Applicable" &&
        !!a.response &&
        a.response !== "Unknown" &&
        !!a.explanation.trim();
}
export function outstanding(a: Assessment): string[] {
  return [
    ...(!/^\d{4}-\d{2}-\d{2}$/.test(a.product.details.assessmentDate) ||
    !Number.isFinite(Date.parse(a.product.details.assessmentDate))
      ? ["Record a valid assessment date in YYYY-MM-DD format."]
      : []),
    ...Object.entries(productFields)
      .filter(
        ([k]) =>
          isUnknown(a.product.details[k as ProductKey]) ||
          !a.product.confirmed.includes(k as ProductKey),
      )
      .map(([, label]) => `Confirm ${label.toLowerCase()}.`),
    ...Object.entries(a.product.claims)
      .filter(([, v]) => v === "Unknown")
      .map(
        ([k]) =>
          `Resolve ${claimLabels[k as keyof typeof claimLabels].toLowerCase()}.`,
      ),
    ...conflicts(a),
    ...questions
      .filter(
        (q) =>
          !answerComplete(a.answers[q.id]) ||
          a.answers[q.id].status !== "Approved",
      )
      .map(
        (q) =>
          `${q.id}: ${a.answers[q.id].status}; response ${a.answers[q.id].response || "unanswered"}.`,
      ),
    ...a.criteria
      .filter((c) => !c.judgment)
      .map((c) => `Criterion ${c.id} needs a human judgment.`),
    ...a.tests
      .filter((t) => ["Untested", "Blocked"].includes(t.result))
      .map((t) => `Test ${t.id} is ${t.result.toLowerCase()}.`),
    ...(!a.criteria.length || !a.product.criteriaInventoryConfirmed
      ? [
          "Confirm that the criterion inventory covers the explicitly stated assessment scope.",
        ]
      : []),
  ];
}
export function metrics(a: Assessment) {
  return {
    answered: Object.values(a.answers).filter(answerComplete).length,
    reviewed: Object.values(a.answers).filter((v) => v.status === "Approved")
      .length,
    testsCompleted: a.tests.filter((t) => ["Pass", "Fail"].includes(t.result))
      .length,
    findings: a.tests.filter(
      (t) => t.result === "Fail" || t.result === "Blocked",
    ).length,
  };
}
