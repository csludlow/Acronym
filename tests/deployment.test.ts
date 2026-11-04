import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const script = fileURLToPath(
  new URL("../scripts/check-deployment-settings.mjs", import.meta.url),
);
const settings = {
  AZURE_CLIENT_ID: "synthetic-client-value",
  AZURE_TENANT_ID: "synthetic-tenant-value",
  AZURE_SUBSCRIPTION_ID: "synthetic-subscription-value",
  AZURE_WEBAPP_NAME: "synthetic-app-value",
};

test("deployment preflight stops before Azure login when settings are unavailable", () => {
  const result = spawnSync(process.execPath, [script], {
    env: {},
    encoding: "utf8",
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /CU Launch deployment settings are unavailable/);
  assert.match(result.stderr, /AZURE_CLIENT_ID/);
  assert.match(result.stderr, /AZURE_WEBAPP_NAME/);
});

test("deployment preflight accepts configured settings without logging their values", () => {
  const result = spawnSync(process.execPath, [script], {
    env: settings,
    encoding: "utf8",
  });
  assert.equal(result.status, 0);
  assert.match(result.stdout, /settings are present/);
  for (const value of Object.values(settings))
    assert.ok(!(result.stdout + result.stderr).includes(value));
});

test("deployment preflight rejects a blank setting without exposing other settings", () => {
  const result = spawnSync(process.execPath, [script], {
    env: { ...settings, AZURE_TENANT_ID: "  " },
    encoding: "utf8",
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /unavailable: AZURE_TENANT_ID\./);
  for (const value of Object.values(settings))
    assert.ok(!(result.stdout + result.stderr).includes(value));
});
