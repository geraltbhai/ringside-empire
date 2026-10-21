import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end smoke tests. By default they build and start the production server on port 3100.
 * Set E2E_BASE_URL to test an already-running server (e.g. `E2E_BASE_URL=http://localhost:3000`).
 * Set PW_CHROMIUM_PATH to use a pre-installed Chromium instead of `npx playwright install chromium`.
 */
const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3100";

export default defineConfig({
  testDir: "e2e",
  timeout: 120_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    launchOptions: {
      executablePath: process.env.PW_CHROMIUM_PATH || undefined,
      args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
    },
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } } },
    { name: "mobile", use: { ...devices["Pixel 7"] }, grep: /@mobile/ },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : { command: "npm run build && npx next start -p 3100", url: baseURL, timeout: 300_000, reuseExistingServer: true },
});
