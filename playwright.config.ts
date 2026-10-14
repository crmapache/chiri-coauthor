import { defineConfig, devices } from '@playwright/test'

/** Dev port + 100, so the suite never collides with a running `pnpm dev`. */
const E2E_PORT = 3120

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  reporter: 'list',
  use: {
    baseURL: `http://localhost:${E2E_PORT}`,
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
  ],
  webServer: {
    command: 'pnpm dev',
    url: `http://localhost:${E2E_PORT}`,
    reuseExistingServer: false,
    // The AI route is mocked in every test; the key only has to exist for the server to start.
    env: { PORT: String(E2E_PORT), OPENROUTER_API_KEY: 'e2e-not-used' },
  },
})
