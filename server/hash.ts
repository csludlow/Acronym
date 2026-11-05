import { createHash } from "node:crypto";
export const hash = (bytes: Uint8Array | string) =>
  createHash("sha256").update(bytes).digest("hex");
