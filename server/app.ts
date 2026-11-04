import express from "express";
import { renderPDF } from "./pdf.ts";
import multer from "multer";
import { z, ZodError } from "zod";
import { basename } from "node:path";
import { Store } from "./store.ts";
import { applyCommand, addEvidence, demand, DomainError } from "./domain.ts";
import { newAssessment, name } from "../shared/model.ts";
import { MAX_FILE } from "./extraction.ts";
import { extractIsolated } from "./extract-process.ts";
import { snapshot, renderReport } from "./export.ts";
import { requireAdapter } from "./adapters.ts";
import { backup, restore } from "./backup.ts";
export function createApp(store: Store) {
  const app = express();
  app.disable("x-powered-by");
  app.use((req, res, next) => {
    const host = req.headers.host ?? "";
    if (!/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(host))
      return res.status(403).json({ error: "Localhost access only." });
    const origin = req.headers.origin;
    if (origin && origin !== `http://${host}`)
      return res
        .status(403)
        .json({ error: "Cross-origin access is disabled." });
    if (req.headers["sec-fetch-site"] === "cross-site")
      return res
        .status(403)
        .json({ error: "Cross-site requests are disabled." });
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("Cache-Control", "no-store");
    if (process.env.NODE_ENV === "production")
      res.setHeader(
        "Content-Security-Policy",
        "default-src 'self'; script-src 'self'; style-src 'self' https://use.typekit.net https://p.typekit.net; font-src 'self' https://use.typekit.net; img-src 'self' data: https://p.typekit.net; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
      );
    next();
  });
  app.use("/api", (req, res, next) => {
    if (
      !["GET", "HEAD"].includes(req.method) &&
      req.headers["x-acronym-request"] !== "local"
    )
      return res.status(403).json({ error: "Missing local request header." });
    next();
  });
  app.use(express.json({ limit: "80mb" }));
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_FILE, files: 1, fields: 5, fieldSize: 1000 },
  });
  app.get("/api/health", (_req, res) =>
    res.json({ ok: true, aiEnabled: false, officialAdapters: [] }),
  );
  app.get("/api/assessments", (_req, res) =>
    res.json(
      store.list().map((a) => ({
        id: a.id,
        product: a.product.details.product,
        vendor: a.product.details.vendor,
        synthetic: a.synthetic,
        revision: a.revision,
      })),
    ),
  );
  app.post("/api/assessments", (req, res) => {
    const b = z
      .object({ synthetic: z.boolean().default(false) })
      .parse(req.body);
    const a = newAssessment(crypto.randomUUID(), b.synthetic);
    store.insert(a);
    res.status(201).json(a);
  });
  app.get("/api/assessments/:id", (req, res) =>
    res.json(store.get(req.params.id)),
  );
  app.post("/api/assessments/:id/commands", (req, res) => {
    const b = z
      .object({ revision: z.number().int(), actor: name, command: z.unknown() })
      .parse(req.body);
    const old = store.get(req.params.id);
    if (old.revision !== b.revision)
      throw new DomainError(
        "This assessment changed. Reload before saving.",
        409,
      );
    const a = applyCommand(old, b.command, b.actor);
    store.save(a, old.revision);
    res.json(a);
  });
  app.post(
    "/api/assessments/:id/evidence",
    upload.single("file"),
    async (req, res) => {
      demand(req.file, "Choose a file.");
      const actor = name.parse(req.body.actor),
        old = store.get(String(req.params.id));
      demand(
        Number(req.body.revision) === old.revision,
        "Assessment changed. Reload before uploading.",
      );
      const fileName = basename(req.file.originalname.replaceAll("\\", "/"))
        .replace(/[\x00-\x1f]/g, "")
        .slice(0, 200);
      demand(fileName, "A file name is required.");
      const segments = await extractIsolated(req.file.buffer, fileName);
      const digest = store.putFile(req.file.buffer);
      const a = addEvidence(
        old,
        {
          id: crypto.randomUUID(),
          fileName,
          hash: digest,
          uploadedAt: new Date().toISOString(),
          product: old.product.details.product,
          version: old.product.details.version,
          status: "Uncertain",
          extraction:
            segments.length && segments.every((s) => s.text.trim())
              ? "Extracted"
              : "Manual transcription required",
          segments,
          notes:
            "Confirm relevance and currency before using this source for approval.",
          excludeFromAI: true,
        },
        actor,
      );
      store.save(a, old.revision);
      res.status(201).json(a);
    },
  );
  app.get("/api/assessments/:id/evidence/:eid", (req, res) => {
    const e = store
      .get(req.params.id)
      .evidence.find((e) => e.id === req.params.eid);
    demand(e, "Evidence not found.");
    res
      .attachment(e.fileName)
      .type("application/octet-stream")
      .send(store.file(e.hash));
  });
  app.post("/api/assessments/:id/exports", async (req, res) => {
    const b = z
        .object({
          revision: z.number().int(),
          final: z.boolean(),
          reviewer: z.string().max(200),
        })
        .parse(req.body),
      a = store.get(req.params.id);
    demand(
      a.revision === b.revision,
      "Reload the assessment before exporting.",
    );
    for (const e of a.evidence) store.file(e.hash);
    const s = snapshot(a, b.final, b.reviewer),
      docx = await renderReport(s),
      pdf = await renderPDF(s);
    store.db
      .prepare(
        "INSERT INTO snapshots (id,assessment_id,created_at,body,docx,pdf) VALUES (?,?,?,?,?,?)",
      )
      .run(s.id, a.id, s.createdAt, JSON.stringify(s), docx, pdf);
    res
      .status(201)
      .json({ id: s.id, status: s.status, createdAt: s.createdAt });
  });
  app.get("/api/assessments/:id/exports", (req, res) => {
    store.get(req.params.id);
    res.json(
      store.db
        .prepare(
          "SELECT id,created_at as createdAt,json_extract(body,'$.status') as status, pdf IS NOT NULL as hasPDF FROM snapshots WHERE assessment_id=? ORDER BY created_at DESC",
        )
        .all(req.params.id),
    );
  });
  app.get("/api/exports/:id/:format", (req, res) => {
    const row = store.db
      .prepare("SELECT body,docx,pdf FROM snapshots WHERE id=?")
      .get(req.params.id) as
      { body: string; docx: Uint8Array; pdf: Uint8Array | null } | undefined;
    demand(row, "Export not found.");
    if (req.params.format === "json")
      res
        .attachment(`assessment-${req.params.id}.json`)
        .type("application/json")
        .send(row.body);
    else if (req.params.format === "docx")
      res
        .attachment(`assessment-${req.params.id}.docx`)
        .type(
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        )
        .send(Buffer.from(row.docx));
    else if (req.params.format === "pdf") {
      if (!row.pdf)
        throw new DomainError(
          "This older snapshot predates PDF support. Create a new preparation snapshot to download a PDF.",
          422,
        );
      res
        .attachment(`assessment-${req.params.id}.pdf`)
        .type("application/pdf")
        .send(Buffer.from(row.pdf));
    } else throw new DomainError("Unsupported export format.");
  });
  app.post("/api/official-export", (req, res) => {
    const b = z
      .object({ family: name, version: name, edition: name })
      .parse(req.body);
    requireAdapter(b.family, b.version, b.edition);
    throw new DomainError("Official export unavailable.", 422);
  });
  app.get("/api/assessments/:id/backup", (req, res) =>
    res
      .attachment(`acronym-backup-${req.params.id}.json`)
      .json(backup(store, req.params.id)),
  );
  app.post("/api/restore", (req, res) =>
    res.status(201).json(restore(store, req.body)),
  );
  app.use("/api", (_req, res) =>
    res.status(404).json({ error: "API route not found." }),
  );
  app.use(
    (
      err: Error,
      req: express.Request,
      res: express.Response,
      _next: express.NextFunction,
    ) => {
      const status =
        err instanceof DomainError
          ? err.status
          : err instanceof ZodError || err instanceof multer.MulterError
            ? 400
            : 500;
      res.status(status).json({
        error:
          err instanceof ZodError
            ? err.issues
                .map((i) => `${i.path.join(".")}: ${i.message}`)
                .join("; ")
            : status === 500
              ? "The operation failed. Check the local server log."
              : err.message,
      });
      if (status === 500) console.error(err);
    },
  );
  return app;
}
