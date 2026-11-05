import express from "express";
import multer from "multer";
import { ZodError } from "zod";
import { DomainError } from "./domain.ts";
import { MAX_FILE } from "./extraction.ts";

export type AppOptions = { mode: "local" | "ephemeral"; publicOrigin?: string };
export function runtimeOptions(env = process.env): AppOptions {
  if (env.APP_MODE && !["local", "ephemeral"].includes(env.APP_MODE))
    throw new Error("APP_MODE must be local or ephemeral.");
  // Azure must never open the persistent single-user store, even if misconfigured.
  const azure = Boolean(env.WEBSITE_HOSTNAME || env.WEBSITE_INSTANCE_ID);
  if (azure && !env.WEBSITE_HOSTNAME)
    throw new Error("Azure hostname is missing.");
  const mode = azure || env.APP_MODE === "ephemeral" ? "ephemeral" : "local";
  const publicOrigin =
    env.PUBLIC_ORIGIN ||
    (azure ? `https://${env.WEBSITE_HOSTNAME}` : undefined);
  if (publicOrigin) {
    const url = new URL(publicOrigin);
    if (
      url.origin !== publicOrigin ||
      url.protocol !== "https:" ||
      url.username ||
      url.password
    )
      throw new Error("PUBLIC_ORIGIN must be an HTTPS origin without a path.");
    if (mode !== "ephemeral")
      throw new Error("Public hosting requires ephemeral mode.");
  }
  return { mode, publicOrigin };
}

export function baseApp(options: AppOptions) {
  const app = express();
  app.disable("x-powered-by");
  app.use((_req, res, next) => {
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
  // Health is intentionally public and independent of data, sessions and services.
  app.get("/api/health", (_req, res) =>
    res.json({ ok: true, aiEnabled: false, officialAdapters: [] }),
  );
  app.use((req, res, next) => {
    const host = req.headers.host ?? "";
    const local = /^(127\.0\.0\.1|localhost)(:\d+)?$/.test(host);
    const hosted =
      options.mode === "ephemeral" &&
      options.publicOrigin &&
      host === new URL(options.publicOrigin).host;
    if (!local && !hosted)
      return res.status(403).json({ error: "This host is not configured." });
    const expected = hosted ? options.publicOrigin : `http://${host}`;
    if (
      (req.headers.origin && req.headers.origin !== expected) ||
      req.headers["sec-fetch-site"] === "cross-site"
    )
      return res
        .status(403)
        .json({ error: "Cross-origin access is disabled." });
    next();
  });
  app.get("/api/config", (_req, res) => res.json({ mode: options.mode }));
  app.use("/api", (req, res, next) => {
    if (
      !["GET", "HEAD"].includes(req.method) &&
      req.headers["x-acronym-request"] !== "local"
    )
      return res
        .status(403)
        .json({ error: "Missing application request header." });
    next();
  });
  return app;
}
export const evidenceUpload = () =>
  multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_FILE, files: 1, fields: 5, fieldSize: 1000 },
  });
export function errorHandler(ephemeral: boolean): express.ErrorRequestHandler {
  return (err, _req, res, _next) => {
    const status =
      err instanceof DomainError
        ? err.status
        : err instanceof ZodError || err instanceof multer.MulterError
          ? 400
          : err.type === "entity.too.large"
            ? 413
            : err.type === "entity.parse.failed"
              ? 400
              : 500;
    res
      .status(status)
      .json({
        error:
          err instanceof ZodError
            ? "Some fields are missing or invalid. Check the assessment or backup format."
            : status === 500
              ? "The operation failed. Try a smaller file or report; your open tab still has your work."
              : err.type
                ? "The request is too large or invalid."
                : err.message,
      });
    // Never log request bodies, document text, filenames, or parser error details in public mode.
    if (status === 500 && !ephemeral) console.error(err);
  };
}
