import { DomainError } from "./domain.ts";
import type { Assessment } from "../shared/model.ts";
export interface OfficialAdapter {
  family: "HECVAT" | "VPAT";
  version: string;
  edition: string;
  templateSha256: string;
  permissionReference: string;
  export(snapshot: Assessment, template: Buffer): Promise<Buffer>;
}
// Deliberately empty. Registration requires permission plus a version-specific fidelity test suite.
export const officialAdapters: ReadonlyArray<OfficialAdapter> = [];
export function requireAdapter(
  family: string,
  version: string,
  edition: string,
) {
  const adapter = officialAdapters.find(
    (a) =>
      a.family === family && a.version === version && a.edition === edition,
  );
  if (!adapter)
    throw new DomainError(
      `Unsupported official template: ${family} ${version} ${edition}. No verified adapter is installed. Use the generic assessment package.`,
      422,
    );
  return adapter;
}
