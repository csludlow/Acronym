import { test } from "node:test";
import assert from "node:assert/strict";
import { request } from "node:http";
import { baseApp, type AppOptions } from "../server/http.ts";

for (const mode of ["ephemeral", "local"] as const) {
  test(`${mode}: external navigation exception is limited to public entry pages`, async () => {
    const options: AppOptions = {
      mode,
      ...(mode === "ephemeral"
        ? { publicOrigin: "https://vendor.example" }
        : {}),
    };
    const app = baseApp(options);
    app.all("/{*path}", (_req, res) => res.send("Reached route"));
    const server = app.listen(0, "127.0.0.1");
    await new Promise<void>((resolve) => server.once("listening", resolve));
    const port = (server.address() as { port: number }).port;
    const host = mode === "ephemeral" ? "vendor.example" : `127.0.0.1:${port}`;
    const navigation = {
      "Sec-Fetch-Site": "cross-site",
      "Sec-Fetch-Mode": "navigate",
      "Sec-Fetch-Dest": "document",
    };
    const status = (
      path: string,
      headers: Record<string, string> = {},
      method = "GET",
    ) =>
      new Promise<number>((resolve, reject) => {
        const req = request(
          {
            hostname: "127.0.0.1",
            port,
            path,
            method,
            headers: { Host: host, ...headers },
          },
          (res) => {
            res.resume();
            res.on("end", () => resolve(res.statusCode!));
          },
        );
        req.on("error", reject);
        req.end();
      });
    try {
      assert.equal(await status("/"), 200);
      for (const path of ["/", "/?from=launch", "/index.html"]) {
        for (const method of ["GET", "HEAD"]) {
          assert.equal(
            await status(path, navigation, method),
            mode === "ephemeral" ? 200 : 403,
          );
        }
      }
      assert.equal(
        await status("/", {
          ...navigation,
          Origin: "https://unrelated.example",
        }),
        403,
      );
      assert.equal(
        await status("/", { ...navigation, Host: "unconfigured.example" }),
        403,
      );
      assert.equal(
        await status("/", { ...navigation, "Sec-Fetch-Dest": "iframe" }),
        403,
      );
      assert.equal(
        await status("/", { ...navigation, "Sec-Fetch-Mode": "cors" }),
        403,
      );
      assert.equal(await status("/", { "Sec-Fetch-Site": "cross-site" }), 403);
      assert.equal(await status("/", navigation, "POST"), 403);
      for (const path of [
        "/api/config",
        "/api/temporary/export",
        "/api/temporary/extract",
        "/api/temporary/restore",
        "/api/assessments",
        "/assets/example.js",
        "/other",
      ]) {
        assert.equal(await status(path, navigation), 403);
        assert.equal(
          await status(
            path,
            { ...navigation, "X-Acronym-Request": "local" },
            "POST",
          ),
          403,
        );
      }
      assert.equal(
        await status("/api/config", {
          Origin: options.publicOrigin || `http://${host}`,
          "Sec-Fetch-Site": "same-origin",
        }),
        200,
      );
      assert.equal(
        await status(
          "/api/temporary/export",
          { "X-Acronym-Request": "local" },
          "POST",
        ),
        200,
      );
      assert.equal(await status("/api/temporary/export", {}, "POST"), 403);
      assert.equal(
        await status("/api/health", {
          ...navigation,
          Host: "unconfigured.example",
          Origin: "https://unrelated.example",
        }),
        200,
      );
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
}
