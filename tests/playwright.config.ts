import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 60000, // Increase timeout for CI environments
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:4200',
    trace: 'on-first-retry',
    // Add screenshot on failure for better debugging
    screenshot: 'only-on-failure',
    // Increase navigation timeout for slower CI environments
    navigationTimeout: 30000,
    // Increase action timeout
    actionTimeout: 15000
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  // Retry failed tests in CI
  retries: process.env.CI ? 2 : 0,
  // Reduce parallelism in CI to avoid resource contention
  workers: process.env.CI ? 1 : undefined,
  // Global setup to wait for services to be ready when using Docker Compose
  globalSetup: process.env.E2E_BASE_URL?.includes('frontend') ? './global-setup.ts' : undefined,
});
