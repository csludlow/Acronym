import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createTemporaryApp } from "../server/temporary.ts";
import { runtimeOptions } from "../server/http.ts";
import { newAssessment } from "../shared/model.ts";
import { hash } from "../server/hash.ts";

test("public document services retain no workspace and enforce origin, review and file rules", async () => {
  const server = createTemporaryApp({
    mode: "ephemeral",
    publicOrigin: "https://vendor.example",
  }).listen(0, "127.0.0.1");
  await new Promise<void>((r) => server.once("listening", r));
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}/api`;
  const headers = {
    "Content-Type": "application/json",
    "X-Acronym-Request": "local",
  };
  const post = (path: string, body: unknown) =>
    fetch(base + path, { method: "POST", headers, body: JSON.stringify(body) });
  try {
    assert.equal(
      (
        await fetch(base + "/health", {
          headers: { Origin: "https://unrelated.example" },
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await fetch(base + "/config", {
          headers: { Origin: "https://unrelated.example" },
        })
      ).status,
      403,
    );
    assert.deepEqual(await (await fetch(base + "/config")).json(), {
      mode: "ephemeral",
    });
    assert.equal((await post("/assessments", { synthetic: true })).status, 404);
    const a = newAssessment(crypto.randomUUID(), true);
    const source = "Synthetic evidence, no real addresses.";
    const form = new FormData();
    form.append("file", new Blob([source]), "source.txt");
    const extracted = await fetch(base + "/temporary/extract", {
      method: "POST",
      headers: { "X-Acronym-Request": "local" },
      body: form,
    });
    assert.equal(extracted.status, 200);
    const e = await extracted.json();
    assert.equal(e.hash, hash(source));
    assert.equal(e.segments[0].text, source);
    assert.equal(extracted.headers.get("cache-control"), "no-store");
    assert.equal(extracted.headers.get("set-cookie"), null);
    const invalid = new FormData();
    invalid.append("file", new Blob(["not supported"]), "macro.xlsm");
    assert.equal(
      (
        await fetch(base + "/temporary/extract", {
          method: "POST",
          headers: { "X-Acronym-Request": "local" },
          body: invalid,
        })
      ).status,
      400,
    );
    const result = await post("/temporary/export", {
      assessment: a,
      final: false,
      reviewer: "",
    });
    assert.equal(result.status, 200);
    const exported = await result.json();
    assert.equal(
      Buffer.from(exported.pdf, "base64").subarray(0, 5).toString(),
      "%PDF-",
    );
    assert.equal(
      Buffer.from(exported.docx, "base64").subarray(0, 2).toString(),
      "PK",
    );
    assert.equal(
      (await fetch(base + `/exports/${exported.snapshot.id}/json`)).status,
      404,
    );
    assert.equal((await fetch(base + `/assessments/${a.id}`)).status, 404);
    assert.equal(
      (
        await post("/temporary/export", {
          assessment: a,
          final: true,
          reviewer: "Named reviewer",
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await post("/temporary/export", {
          assessment: { id: "broken" },
          final: false,
          reviewer: "",
        })
      ).status,
      400,
    );
    const restored = await post("/temporary/restore", {
      format: "acronym-backup-v1",
      assessment: a,
      files: [],
    });
    assert.equal(restored.status, 200);
    assert.notEqual((await restored.json()).id, a.id);
    assert.equal((await fetch(base + "/assessments")).status, 404);
    assert.equal(
      (
        await post("/official-export", {
          family: "HECVAT",
          version: "unverified",
          edition: "full",
        })
      ).status,
      422,
    );
    assert.equal(
      (
        await fetch(base + "/temporary/export", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{}",
        })
      ).status,
      403,
    );
  } finally {
    await new Promise<void>((r) => server.close(() => r()));
  }
});

test("Azure forces temporary mode; public persistent configuration fails closed", () => {
  assert.deepEqual(runtimeOptions({}), {
    mode: "local",
    publicOrigin: undefined,
  });
  assert.equal(
    runtimeOptions({ APP_MODE: "local", WEBSITE_HOSTNAME: "app.example" }).mode,
    "ephemeral",
  );
  assert.throws(
    () => runtimeOptions({ PUBLIC_ORIGIN: "https://app.example" }),
    /requires ephemeral/,
  );
  assert.throws(
    () =>
      runtimeOptions({
        APP_MODE: "ephemeral",
        PUBLIC_ORIGIN: "http://app.example",
      }),
    /HTTPS/,
  );
  assert.throws(() => runtimeOptions({ APP_MODE: "misspelled" }), /APP_MODE/);
});

test("production startup on Azure does not create a data directory or database", async () => {
  const data = join(
    mkdtempSync(join(tmpdir(), "acronym-no-storage-")),
    "never-create",
  );
  const child = spawn(
    process.execPath,
    ["--import", "tsx", "server/index.ts"],
    {
      env: {
        ...process.env,
        NODE_ENV: "production",
        PORT: "0",
        DATA_DIR: data,
        WEBSITE_HOSTNAME: "synthetic.azurewebsites.net",
        APP_MODE: "local",
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  const closed = new Promise<void>((r) => child.once("close", () => r()));
  try {
    const port = await new Promise<string>((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error("Server did not become ready")),
        15000,
      );
      child.stdout.on("data", (b) => {
        const match = /ready on port (\d+) — ephemeral/.exec(String(b));
        if (match) {
          clearTimeout(timeout);
          resolve(match[1]);
        }
      });
      child.once("error", reject);
      child.once("exit", () => {
        clearTimeout(timeout);
        reject(new Error("Server exited before ready"));
      });
    });
    assert.equal(
      (await fetch(`http://127.0.0.1:${port}/api/health`)).status,
      200,
    );
    assert.deepEqual(
      await (await fetch(`http://127.0.0.1:${port}/api/config`)).json(),
      { mode: "ephemeral" },
    );
    assert.equal(existsSync(data), false);
  } finally {
    child.kill("SIGTERM");
    await closed;
  }
  assert.equal(existsSync(data), false);
});
