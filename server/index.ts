import express from "express";
import { resolve } from "node:path";
import { existsSync } from "node:fs";
import { createApp } from "./app.ts";
import { Store } from "./store.ts";
process.umask(0o077);
const store = new Store(process.env.DATA_DIR || "data");
const app = createApp(store);
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
const server = app.listen(port, "127.0.0.1", () =>
  console.log(
    `Acronym is ready at http://127.0.0.1:${port} — local only, AI disabled`,
  ),
);
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.on(signal, () =>
    server.close(() => {
      store.close();
      process.exit(0);
    }),
  );
