import { test } from "node:test";
import { request } from "node:http";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApp } from "../server/app.ts";
import { Store } from "../server/store.ts";
test("HTTP workflow works without AI; upload, review, snapshot, and local request boundary", async () => {
  const store = new Store(mkdtempSync(join(tmpdir(), "acronym-api-")));
  const server = createApp(store).listen(0, "127.0.0.1");
  await new Promise<void>((r) => server.once("listening", r));
  const port = (server.address() as { port: number }).port;
  const base = `http://127.0.0.1:${port}/api`;
  const headers = {
    "Content-Type": "application/json",
    "X-Acronym-Request": "local",
  };
  const post = (path: string, b: unknown) =>
    fetch(base + path, { method: "POST", headers, body: JSON.stringify(b) });
  try {
    assert.equal(
      (await (await fetch(base + "/health")).json()).aiEnabled,
      false,
    );
    assert.equal(
      (
        await fetch(base + "/assessments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{}",
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await fetch(base + "/health", {
          headers: { Origin: "http://evil.example" },
        })
      ).status,
      403,
    );
    assert.equal(
      await new Promise<number | undefined>((resolve) => {
        const req = request(
          base + "/health",
          { headers: { Host: "evil.example" } },
          (res) => {
            res.resume();
            resolve(res.statusCode);
          },
        );
        req.end();
      }),
      403,
    );
    let a = await (await post("/assessments", { synthetic: true })).json();
    const form = new FormData();
    form.append(
      "file",
      new Blob([
        "Synthetic support procedure: vendor personnel can view addresses.",
      ]),
      "support.txt",
    );
    form.append("actor", "Demo author");
    form.append("revision", String(a.revision));
    const uploaded = await fetch(`${base}/assessments/${a.id}/evidence`, {
      method: "POST",
      headers: { "X-Acronym-Request": "local" },
      body: form,
    });
    assert.equal(uploaded.status, 201, await uploaded.clone().text());
    a = await uploaded.json();
    assert.equal(a.evidence[0].segments[0].locator, "Line 1");
    assert.equal(a.evidence[0].status, "Uncertain");
    const r = await post(`/assessments/${a.id}/exports`, {
      revision: a.revision,
      final: false,
      reviewer: "",
    });
    assert.equal(r.status, 201);
    const s = await r.json();
    const before = await (await fetch(`${base}/exports/${s.id}/json`)).text();
    const b = await (await fetch(`${base}/assessments/${a.id}/backup`)).json();
    assert.equal((await post("/restore", b)).status, 201);
    assert.equal(
      await (await fetch(`${base}/exports/${s.id}/json`)).text(),
      before,
    );
    const doc = await fetch(`${base}/exports/${s.id}/docx`);
    assert.equal(doc.status, 200);
    assert.match(doc.headers.get("content-type")!, /wordprocessingml/);
    assert.equal(
      (
        await post("/official-export", {
          family: "HECVAT",
          version: "4.1.6",
          edition: "full",
        })
      ).status,
      422,
    );
    assert.equal(
      (
        await post(`/assessments/${a.id}/exports`, {
          revision: a.revision,
          final: true,
          reviewer: "Reviewer",
        })
      ).status,
      400,
    );
  } finally {
    await new Promise<void>((r, reject) =>
      server.close((e) => (e ? reject(e) : r())),
    );
    store.close();
  }
});
