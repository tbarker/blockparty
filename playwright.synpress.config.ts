/**
 * Playwright Configuration for Synpress E2E Tests
 *
 * Uses real MetaMask extension for wallet interactions.
 * Runs headful with xvfb in containers (devcontainer and CI).
 *
 * Self-contained: Anvil is started and contracts deployed in globalSetup,
 * and cleaned up in globalTeardown.
 *
 * PARALLELIZATION STRATEGY:
 * - Each spec file runs in its own worker (workers: 4)
 * - Tests within a spec run sequentially (fullyParallel: false)
 * - Each spec deploys its own contract in beforeAll
 * - Each spec uses dedicated Anvil accounts to avoid nonce conflicts:
 *   - createEvent: Account 1
 *   - registration: Account 2
 *   - attendance: Account 4-5
 *   - withdrawal: Account 6-7
 *
 * @see https://docs.synpress.io/docs/setup-playwright
 */

import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './src/__tests__/e2e-synpress',

  // Run tests sequentially - sharing blockchain state
  fullyParallel: false,
  workers: 1,

  // Fail the build on CI if you accidentally left test.only in the source code
  forbidOnly: !!process.env.CI,

  // Retry failed tests on CI
  retries: process.env.CI ? 2 : 0,

  // Reporter configuration
  reporter: process.env.CI ? 'github' : 'list',

  // Shared settings for all projects
  use: {
    // Base URL for the app
    baseURL: 'http://localhost:3000',

    // Collect trace when retrying the failed test
    trace: 'on-first-retry',

    // Take screenshot on failure
    screenshot: 'only-on-failure',
  },

  // Test timeout (blockchain transactions can be slow)
  timeout: 240000,

  // Expect timeout for assertions
  expect: {
    timeout: 30000,
  },

  // Configure projects - Chrome only (MetaMask only works on Chrome)
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Synpress requires headful mode for MetaMask extension
        headless: false,
        // Chromium args for container environment with xvfb
        launchOptions: {
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            // Reduce flakiness in containers
            '--dns-prefetch-disable',
          ],
        },
      },
    },
  ],

  // Run local dev server before starting the tests
  webServer: {
    command: 'npm run start',
    url: 'http://localhost:3000',
    reuseExistingServer: true,
    timeout: 180000, // 3 minutes for webpack to build
    stdout: 'pipe',
    stderr: 'pipe',
  },

  // Global setup/teardown for Anvil blockchain and contract deployment
  globalSetup: './src/__tests__/e2e-synpress/global-setup.cjs',
  globalTeardown: './src/__tests__/e2e-synpress/global-teardown.cjs',
});
