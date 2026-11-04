import PDFDocument from "pdfkit";
import { reportFonts } from "./report-fonts.ts";
import { brand } from "../shared/brand.ts";
import { reportBlocks, type Snapshot } from "./export.ts";

export function renderPDF(snapshot: Snapshot): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "LETTER",
      margins: { top: 82, bottom: 64, left: 54, right: 54 },
      bufferPages: true,
      tagged: true,
      lang: "en",
      info: {
        Title: "Acronym Vendor Assessment Preparation Guide",
        Author: "Acronym",
        Subject: snapshot.notice,
        CreationDate: new Date(snapshot.createdAt),
      },
    });
    const chunks: Buffer[] = [];
    doc.on("data", (b) => chunks.push(b));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    const fonts = reportFonts();
    for (const [role, path] of Object.entries(fonts.files))
      doc.registerFont(role, path);
    const root = doc.struct("Document");
    doc.addStructure(root);
    const blocks = reportBlocks(snapshot);
    if (fonts.note) blocks.splice(1, 0, { kind: "body", text: fonts.note });
    for (const block of blocks) {
      const heading = block.kind !== "body",
        size =
          block.kind === "title"
            ? 23
            : block.kind === "heading1"
              ? 14
              : block.kind === "heading2"
                ? 11
                : 9;
      doc.font(heading ? "HeadingBold" : "BodyRegular").fontSize(size);
      const required =
        doc.heightOfString(block.text, { width: 504, lineGap: 2 }) +
        (heading ? 30 : 8);
      if (heading && doc.y + Math.min(required, 200) > doc.page.height - 64)
        doc.addPage();
      root.add(
        doc.struct(
          block.kind === "title"
            ? "H1"
            : block.kind === "heading1"
              ? "H2"
              : block.kind === "heading2"
                ? "H3"
                : "P",
          {},
          () => {
            doc
              .fillColor(heading ? "#" + brand.primary : "#" + brand.ink)
              .text(block.text, { lineGap: 2, paragraphGap: heading ? 10 : 6 });
          },
        ),
      );
    }
    root.end();
    const pages = doc.bufferedPageRange();
    for (let i = pages.start; i < pages.start + pages.count; i++) {
      doc.switchToPage(i);
      doc.markContent("Artifact");
      doc.rect(0, 0, 612, 47).fill("#" + brand.primary);
      doc.rect(0, 47, 612, 4).fill("#" + brand.secondary);
      doc
        .font("HeadingBold")
        .fontSize(10)
        .fillColor("#" + brand.secondary)
        .text("ACRONYM  /  VENDOR ASSESSMENT GUIDE", 54, 17, {
          lineBreak: false,
        });
      doc
        .font("HeadingRegular")
        .fontSize(8)
        .fillColor("#" + brand.primary)
        .text(
          `${snapshot.status}  |  Page ${i + 1} of ${pages.count}`,
          54,
          754,
          { lineBreak: false },
        );
      doc.endMarkedContent();
    }
    doc.end();
  });
}
