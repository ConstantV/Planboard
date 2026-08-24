import { defineConfig, devices } from "@playwright/test";

// De E2E-suite draait met een eigen backend op poort 8011 (wegwerp-database,
// zie e2e/start-backend.sh) en een eigen frontend op poort 5179. De
// ontwikkelservers en de ontwikkel-database blijven ongemoeid.
export default defineConfig({
  testDir: "./e2e",
  testMatch: "*.spec.ts",
  timeout: 90_000,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:5179",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: "sh e2e/start-backend.sh",
      url: "http://localhost:8011/api/health",
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: "VITE_API_BASE_URL=http://localhost:8011/api bun run dev --port 5179 --strictPort",
      url: "http://localhost:5179",
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});
