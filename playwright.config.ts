import { defineConfig } from "@playwright/test";
import { existsSync } from "node:fs";
const liveURL = process.env.ACRONYM_TEST_URL;
export default defineConfig({
  testDir: "./tests/e2e",
  use: {
    headless: true,
    channel:
      process.env.PLAYWRIGHT_CHANNEL ||
      (process.platform === "darwin" &&
      existsSync("/Applications/Google Chrome.app")
        ? "chrome"
        : undefined),
  },
  workers: 1,
  projects: liveURL
    ? [{ name: "public", use: { baseURL: liveURL } }]
    : [
        { name: "local", use: { baseURL: "http://127.0.0.1:4311" } },
        { name: "public", use: { baseURL: "http://127.0.0.1:4312" } },
      ],
  webServer: liveURL
    ? undefined
    : [
        {
          command: `"${process.execPath}" --import tsx server/index.ts`,
          env: {
            NODE_ENV: "production",
            PORT: "4311",
            DATA_DIR: ".local/e2e-data",
          },
          url: "http://127.0.0.1:4311/api/health",
          reuseExistingServer: false,
        },
        {
          command: `"${process.execPath}" --import tsx server/index.ts`,
          env: {
            NODE_ENV: "production",
            PORT: "4312",
            APP_MODE: "ephemeral",
            DATA_DIR: ".local/must-not-exist-public",
          },
          url: "http://127.0.0.1:4312/api/health",
          reuseExistingServer: false,
        },
      ],
  reporter: "list",
});
