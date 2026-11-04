import { unzipSync } from "fflate";
import { XMLParser } from "fast-xml-parser";
import mammoth from "mammoth";
import { extname } from "node:path";
import { demand } from "./domain.ts";
export const MAX_FILE = 10 * 1024 * 1024;
const maxExpanded = 40 * 1024 * 1024;
export function safeZip(bytes: Uint8Array) {
  let total = 0,
    entries = 0;
  return unzipSync(bytes, {
    filter: (f) => {
      total += f.originalSize;
      entries++;
      demand(
        total <= maxExpanded && entries <= 3000,
        "Document archive exceeds safe extraction limits.",
      );
      demand(
        !/vbaProject|embeddings\//i.test(f.name),
        "Macros and embedded objects are not accepted.",
      );
      return true;
    },
  });
}
const decode = (b: Uint8Array) =>
  new TextDecoder("utf-8", { fatal: true }).decode(b);
export async function extract(
  bytes: Buffer,
  fileName: string,
): Promise<{ locator: string; text: string }[]> {
  demand(
    bytes.length > 0 && bytes.length <= MAX_FILE,
    "Files must be between 1 byte and 10 MB.",
  );
  const ext = extname(fileName).toLowerCase();
  demand(
    [".pdf", ".docx", ".txt", ".xlsx", ".csv", ".tsv"].includes(ext),
    "Supported files: PDF, DOCX, TXT, XLSX, CSV, TSV.",
  );
  if ([".txt", ".csv", ".tsv"].includes(ext)) {
    const value = decode(bytes);
    demand(!value.includes("\0"), "Binary content is not accepted as text.");
    const lines = value.split(/\r?\n/);
    demand(
      lines.length <= 50000,
      "Text line limit is 50,000; split this file before uploading.",
    );
    return lines
      .map((text, i) => ({ locator: `Line ${i + 1}`, text }))
      .filter((s) => s.text.trim());
  }
  if (ext === ".pdf") {
    demand(
      bytes.subarray(0, 5).toString() === "%PDF-",
      "Invalid PDF signature.",
    );
    const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const doc = await getDocument({
      data: new Uint8Array(bytes),
      useSystemFonts: false,
    }).promise;
    try {
      demand(doc.numPages <= 300, "PDF page limit is 300.");
      const result = [];
      for (let i = 1; i <= doc.numPages; i++) {
        const page = await doc.getPage(i);
        const content = await page.getTextContent();
        result.push({
          locator: `Page ${i}`,
          text: content.items.map((x) => ("str" in x ? x.str : "")).join(" "),
        });
      }
      // Retain empty pages so a mixed scanned/text PDF cannot silently appear complete.
      return result;
    } finally {
      await doc.destroy();
    }
  }
  demand(
    bytes[0] === 0x50 && bytes[1] === 0x4b,
    "Invalid Office document signature.",
  );
  const zip = safeZip(bytes);
  if (ext === ".docx") {
    demand(zip["word/document.xml"], "This is not a DOCX document.");
    const r = await mammoth.extractRawText({ buffer: bytes });
    return r.value
      .split(/\n\s*\n/)
      .map((text, i) => ({ locator: `Paragraph ${i + 1}`, text: text.trim() }))
      .filter((s) => s.text);
  }
  demand(zip["xl/workbook.xml"], "This is not an XLSX workbook.");
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@",
    parseTagValue: false,
    processEntities: false,
  });
  const read = (p: string) => {
    const v = decode(zip[p]);
    demand(!/<!DOCTYPE|<!ENTITY/i.test(v), "XML entities are not accepted.");
    return parser.parse(v);
  };
  const array = (x: any): any[] =>
    x == null ? [] : Array.isArray(x) ? x : [x];
  const plain = (x: any): string =>
    typeof x === "string"
      ? x
      : typeof x === "number"
        ? String(x)
        : (x?.["#text"] ?? "");
  const string = (x: any) =>
    x?.t !== undefined
      ? plain(x.t)
      : array(x?.r)
          .map((r) => plain(r.t))
          .join("");
  const strings = zip["xl/sharedStrings.xml"]
    ? array(read("xl/sharedStrings.xml").sst.si).map(string)
    : [];
  const rels = array(
    read("xl/_rels/workbook.xml.rels").Relationships.Relationship,
  );
  const result: { locator: string; text: string }[] = [];
  for (const sheet of array(read("xl/workbook.xml").workbook.sheets.sheet)) {
    const rel = rels.find((r) => r["@Id"] === sheet["@r:id"]);
    demand(
      rel && rel["@TargetMode"] !== "External",
      "Invalid worksheet relationship.",
    );
    const target = String(rel["@Target"]).replace(/^\//, "");
    const path = target.startsWith("xl/") ? target : `xl/${target}`;
    demand(!path.includes("..") && zip[path], "Unsupported worksheet path.");
    for (const row of array(read(path).worksheet.sheetData?.row))
      for (const cell of array(row.c)) {
        const value =
          cell["@t"] === "s"
            ? strings[Number(cell.v)]
            : cell["@t"] === "inlineStr"
              ? string(cell.is)
              : plain(cell.v);
        const display =
          cell.f !== undefined
            ? `Formula (not executed): ${plain(cell.f)}; cached value: ${value ?? ""}`
            : value;
        if (display)
          result.push({
            locator: `${sheet["@name"]}!${cell["@r"]}`,
            text: display,
          });
        demand(result.length <= 50000, "Spreadsheet cell limit exceeded.");
      }
  }
  return result;
}
