import express from "express";
import { resolve } from "node:path";
import { existsSync } from "node:fs";
import { createApp } from "./app.ts";
import { runtimeOptions } from "./http.ts";
import { createTemporaryApp } from "./temporary.ts";
process.umask(0o077);
const options = runtimeOptions();
const store =
  options.mode === "local"
    ? new (await import("./store.ts")).Store(process.env.DATA_DIR || "data")
    : undefined;
const app = store ? createApp(store) : createTemporaryApp(options);
const port = Number(process.env.PORT || 4310);
if (process.env.NODE_ENV === "production") {
  if (!existsSync("dist/index.html"))
    throw new Error("Run npm run build before production startup.");
  app.use(express.static(resolve("dist")));
  app.get("/{*path}", (_req, res) => res.sendFile(resolve("dist/index.html")));
} else {
  const { createServer } = await import("vite");
  const vite = await createServer({
    server: { middlewareMode: true },
    appType: "spa",
  });
  app.use(vite.middlewares);
}
const host = options.publicOrigin ? "0.0.0.0" : "127.0.0.1";
const server = app.listen(port, host, () =>
  console.log(
    `Acronym is ready on port ${(server.address() as { port: number }).port} — ${options.mode} workspace, AI disabled`,
  ),
);
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.on(signal, () =>
    server.close(() => {
      store?.close();
      process.exit(0);
    }),
  );
