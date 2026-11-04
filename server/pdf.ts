import PDFDocument from "pdfkit";
import { fileURLToPath } from "node:url";
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
    doc.registerFont(
      "Regular",
      fileURLToPath(
        new URL("../assets/fonts/NotoSans-Regular.ttf", import.meta.url),
      ),
    );
    doc.registerFont(
      "Bold",
      fileURLToPath(
        new URL("../assets/fonts/NotoSans-Bold.ttf", import.meta.url),
      ),
    );
    const root = doc.struct("Document");
    doc.addStructure(root);
    for (const block of reportBlocks(snapshot)) {
      const heading = block.kind !== "body",
        size =
          block.kind === "title"
            ? 23
            : block.kind === "heading1"
              ? 14
              : block.kind === "heading2"
                ? 11
                : 9;
      doc.font(heading ? "Bold" : "Regular").fontSize(size);
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
        .font("Bold")
        .fontSize(10)
        .fillColor("#" + brand.secondary)
        .text("ACRONYM  /  VENDOR ASSESSMENT GUIDE", 54, 17, {
          lineBreak: false,
        });
      doc
        .font("Regular")
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
