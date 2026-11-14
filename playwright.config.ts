import { defineConfig, devices } from "@playwright/test";
const accountSmtp = process.env.GAMBIT_ACCOUNTS_SMTP_E2E === "1";

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: accountSmtp ? "accounts-smtp.spec.ts" : undefined,
  fullyParallel: false,
  retries: 0,
  use: { baseURL: "http://127.0.0.1:3100", trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: accountSmtp
    ? undefined
    : {
        command: "npm run dev -- --port 3100",
        url: "http://127.0.0.1:3100",
        reuseExistingServer: !process.env.CI,
        env: { NEXT_PUBLIC_API_MOCKS: "1" },
      },
});
