import { extract } from "./extraction.ts";
// Keep parser diagnostics off the structured stdout channel.
console.log = console.warn = (...items: unknown[]) => {
  process.stderr.write(items.map(String).join(" ") + "\n");
};
let input = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => (input += chunk));
process.stdin.on("end", async () => {
  try {
    const { data, fileName } = JSON.parse(input);
    const segments = await extract(Buffer.from(data, "base64"), fileName);
    process.stdout.write(JSON.stringify({ segments }));
  } catch (e) {
    process.stdout.write(
      JSON.stringify({
        error: e instanceof Error ? e.message : "Extraction failed",
      }),
    );
    process.exitCode = 1;
  }
});
