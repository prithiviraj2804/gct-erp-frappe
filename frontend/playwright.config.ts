import { defineConfig, devices } from '@playwright/test'

// The dev server proxies /api to the bench (see vite.config.ts), so tests that hit
// Frappe need `bench start` running. Tests that only exercise the client don't.
const PORT = 5173
const baseURL = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,

  // A stray test.only in CI is almost always an accident that would silently
  // shrink the suite to one test.
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',

  use: {
    baseURL,
    trace: 'on-first-retry',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // Reuses an already-running `npm run dev` locally; starts one from scratch in CI.
  // Set E2E_BASE_URL to test against a real bench instead, which skips this entirely.
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: 'npm run dev',
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
})
