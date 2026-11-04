import { defineConfig } from "@playwright/test";
import { existsSync } from "node:fs";
export default defineConfig({
  testDir: "./tests/e2e",
  use: {
    baseURL: "http://127.0.0.1:4311",
    headless: true,
    channel:
      process.env.PLAYWRIGHT_CHANNEL ||
      (process.platform === "darwin" &&
      existsSync("/Applications/Google Chrome.app")
        ? "chrome"
        : undefined),
  },
  workers: 1,
  webServer: {
    command: `"${process.execPath}" --import tsx server/index.ts`,
    env: { NODE_ENV: "production", PORT: "4311", DATA_DIR: ".local/e2e-data" },
    url: "http://127.0.0.1:4311/api/health",
    reuseExistingServer: false,
  },
  reporter: "list",
});
