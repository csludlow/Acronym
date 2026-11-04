import {
  newAssessment,
  productFields,
  type Assessment,
  type Test,
} from "../shared/model.ts";
import { applyCommand } from "../server/domain.ts";
export const edit = (a: Assessment, command: unknown) =>
  applyCommand(a, command, "Demo author");
export function prepared() {
  const a = newAssessment(crypto.randomUUID(), true);
  for (const key of Object.keys(
    productFields,
  ) as (keyof typeof productFields)[])
    a.product.details[key] = `Confirmed ${productFields[key]}`;
  Object.assign(a.product.details, {
    product: "Campus Parcel Desk",
    version: "1.0",
    assessmentDate: "2026-11-04",
    standard: "Explicit synthetic test scope",
    level: "Custom",
    edition: "Generic preparation report",
  });
  a.product.confirmed = Object.keys(
    productFields,
  ) as (keyof typeof productFields)[];
  a.product.claims = {
    externalTransmissions: "No",
    carrierTraffic: "No",
    vendorDataAccess: "No",
    remoteAccess: "No",
    encryption: "None",
  };
  a.product.criteriaInventoryConfirmed = true;
  for (const c of a.criteria) {
    c.standard = "Explicit synthetic test scope";
    c.level = "Custom";
    c.scope = "Synthetic workflow";
  }
  return a;
}
export const answer = (a: Assessment, id = "DEMO-DATA-01") => ({
  ...a.answers[id],
  response: "No",
  explanation: "This control is not implemented in the synthetic product.",
  author: "Demo author",
  attestation:
    "Demo author confirms firsthand observation in the synthetic fixture.",
  status: "Ready for review",
});
export function sampleTest(
  a: Assessment,
  criterionId = a.criteria[0].id,
): Omit<Test, "id"> {
  return {
    criterionId,
    screen: "Shipment form",
    workflow: "Create a shipment",
    version: a.product.details.version,
    os: "Windows 11",
    configuration: "Synthetic demo",
    method: "Manual keyboard test",
    tools: "Keyboard; synthetic fixture",
    expected: "All controls reachable",
    observed: "Print button cannot be reached",
    tester: "Demo tester",
    date: "2026-11-04",
    result: "Fail",
    references: [],
    findings: "Print label button is skipped by keyboard focus.",
    limitations: "Synthetic example, not a real product evaluation",
    remediation: "Add print control to tab order.",
  };
}
