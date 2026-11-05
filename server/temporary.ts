import express from "express";
import { basename } from "node:path";
import { z } from "zod";
import {
  baseApp,
  evidenceUpload,
  errorHandler,
  type AppOptions,
} from "./http.ts";
import { demand, DomainError } from "./domain.ts";
import { assessmentSchema } from "../shared/validation.ts";
import { extractIsolated } from "./extract-process.ts";
import { hash } from "./hash.ts";
import { snapshot, renderReport } from "./export.ts";
import { renderPDF } from "./pdf.ts";
import { restore } from "./backup.ts";
import { requireAdapter } from "./adapters.ts";

// Stateless document services. No Store, SQLite, sessions, files, or shared vendor state.
export function createTemporaryApp(
  options: AppOptions = { mode: "ephemeral" },
) {
  const app = baseApp(options);
  let active = 0;
  app.use("/api/temporary", (_req, res, next) => {
    if (active >= 2)
      return res.status(503).json({
        error:
          "Document processing is busy. Please try again shortly; your work remains in this tab.",
      });
    active++;
    let released = false;
    const release = () => {
      if (!released) {
        released = true;
        active--;
      }
    };
    res.locals.release = release;
    res.once("finish", release);
    res.once("close", () => {
      if (!res.locals.processing) release();
    });
    next();
  });
  const processing =
    (
      handler: (
        req: express.Request,
        res: express.Response,
      ) => Promise<void> | void,
    ): express.RequestHandler =>
    async (req, res) => {
      res.locals.processing = true;
      try {
        await handler(req, res);
      } finally {
        res.locals.release();
      }
    };
  app.post(
    "/api/temporary/extract",
    evidenceUpload().single("file"),
    processing(async (req, res) => {
      demand(req.file, "Choose a file.");
      const fileName = basename(req.file.originalname.replaceAll("\\", "/"))
        .replace(/[\x00-\x1f]/g, "")
        .slice(0, 200);
      demand(fileName, "A file name is required.");
      const segments = await extractIsolated(req.file.buffer, fileName);
      res.json({ fileName, hash: hash(req.file.buffer), segments });
    }),
  );
  app.use(express.json({ limit: "80mb" }));
  app.post(
    "/api/temporary/export",
    processing(async (req, res) => {
      const b = z
        .object({
          assessment: assessmentSchema,
          final: z.boolean(),
          reviewer: z.string().max(200),
        })
        .parse(req.body);
      const s = snapshot(b.assessment, b.final, b.reviewer);
      const docx = await renderReport(s),
        pdf = await renderPDF(s);
      res.json({
        snapshot: s,
        docx: docx.toString("base64"),
        pdf: pdf.toString("base64"),
      });
    }),
  );
  app.post(
    "/api/temporary/restore",
    processing((req, res) => {
      // Validate the original bytes/references and clear imported approvals. These
      // callbacks deliberately retain nothing after this response.
      res.json(restore({ putFile: hash, insert: () => {} }, req.body));
    }),
  );
  app.post("/api/official-export", (req, _res) => {
    const b = z
      .object({ family: z.string(), version: z.string(), edition: z.string() })
      .parse(req.body);
    requireAdapter(b.family, b.version, b.edition);
    throw new DomainError("Official export unavailable.", 422);
  });
  app.use("/api", (_req, res) =>
    res.status(404).json({
      error:
        "No saved work exists on this server. Use the temporary workspace in your open tab.",
    }),
  );
  app.use(errorHandler(true));
  return app;
}
