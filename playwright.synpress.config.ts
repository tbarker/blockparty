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
 * - Tests can run in parallel across spec files
 * - Each test deploys its own contract for full isolation
 * - Each worker gets its own browser context with MetaMask
 * - Workers use dedicated account pairs to avoid nonce conflicts
 * - Worker count capped at 2 for stability (4+ causes wallet connection issues)
 *
 * @see https://docs.synpress.io/docs/setup-playwright
 */

import { defineConfig, devices } from '@playwright/test';
import os from 'os';

// Determine optimal worker count based on environment
// Cap at 2 workers for stability - higher parallelism causes wallet connection
// synchronization issues due to resource contention on shared Anvil/xvfb
const cpuCount = os.cpus().length;
const maxWorkers = Math.min(cpuCount, 2);

export default defineConfig({
  testDir: './src/__tests__/e2e-synpress',

  // Sequential test execution within files
  // With >1 worker, different spec files run in parallel on different workers
  fullyParallel: false,
  workers: maxWorkers,

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
