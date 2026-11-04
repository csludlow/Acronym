import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { DomainError } from "./domain.ts";
export function extractIsolated(
  bytes: Buffer,
  fileName: string,
): Promise<{ locator: string; text: string }[]> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [
        "--max-old-space-size=192",
        "--import",
        "tsx",
        fileURLToPath(new URL("./extract-worker.ts", import.meta.url)),
      ],
      { stdio: ["pipe", "pipe", "pipe"], env: { PATH: process.env.PATH } },
    );
    let output = "",
      error = "";
    const timer = setTimeout(() => {
      child.kill();
      reject(
        new DomainError(
          "Extraction timed out; use a smaller file or a TXT transcription.",
        ),
      );
    }, 15000);
    child.stdout.on("data", (b) => {
      output += b;
      if (output.length > 8 * 1024 * 1024) {
        child.kill();
        reject(new DomainError("Extracted text exceeds the 8 MB limit."));
      }
    });
    child.stderr.on("data", (b) => {
      error += b;
    });
    child.on("error", (e) => {
      clearTimeout(timer);
      reject(e);
    });
    child.on("close", () => {
      clearTimeout(timer);
      try {
        const result = JSON.parse(output);
        if (result.error) reject(new DomainError(result.error));
        else resolve(result.segments);
      } catch {
        reject(
          new DomainError(
            "Unable to extract this file. Supply an unencrypted file or TXT transcription.",
          ),
        );
      }
    });
    child.stdin.on("error", () => {});
    child.stdin.end(
      JSON.stringify({ data: bytes.toString("base64"), fileName }),
    );
  });
}
