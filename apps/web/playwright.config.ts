import { defineConfig, devices } from "@playwright/test";

const apiPort = Number(process.env.SKILLHUB_E2E_API_PORT ?? 8021);
const webPort = Number(process.env.SKILLHUB_E2E_WEB_PORT ?? 3021);
const databaseUrl =
  process.env.SKILLHUB_E2E_DATABASE_URL ??
  `sqlite:////private/tmp/skillhub-e2e-${apiPort}-${process.pid}.sqlite3`;

export default defineConfig({
  testDir: "./e2e",
  timeout: 45_000,
  workers: 1,
  expect: {
    timeout: 10_000,
  },
  use: {
    baseURL: `http://127.0.0.1:${webPort}`,
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: [
    {
      command: `cd ../api && SKILLHUB_DATABASE_URL=${databaseUrl} uv run uvicorn skillhub.api.main:app --host 127.0.0.1 --port ${apiPort}`,
      url: `http://127.0.0.1:${apiPort}/health`,
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command: `SKILLHUB_API_URL=http://127.0.0.1:${apiPort} NEXT_PUBLIC_SKILLHUB_API_URL=http://127.0.0.1:${apiPort} npm run dev -- --hostname 127.0.0.1 --port ${webPort}`,
      url: `http://127.0.0.1:${webPort}/skills`,
      reuseExistingServer: false,
      timeout: 60_000,
    },
  ],
});
