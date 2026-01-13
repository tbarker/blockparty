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
 * - Tests run fully parallel across N workers where N = CPU cores (fullyParallel: true)
 * - Each test deploys its own contract for isolation
 * - Accounts are assigned dynamically based on parallelIndex:
 *   - Each worker gets 2 accounts (admin + user) from the account pool
 *   - Account pool: 10 Anvil accounts (indices 0-9)
 *   - Worker N uses: admin=Account[N*2], user=Account[N*2+1]
 * - Event contracts don't interact, so no cross-test coordination needed
 *
 * @see https://docs.synpress.io/docs/setup-playwright
 */

import { defineConfig, devices } from '@playwright/test';
import os from 'os';

// Determine optimal worker count based on system resources
// Each Synpress worker runs a full Chrome browser with MetaMask extension
// which is resource-intensive (~300-500MB per browser)
const cpuCount = os.cpus().length;
// Use all cores, but cap at 5 to stay within our 10-account pool (5 pairs)
const maxWorkers = Math.min(cpuCount, 5);

export default defineConfig({
  testDir: './src/__tests__/e2e-synpress',

  // Run all tests fully parallel - each test deploys its own contract
  // Tests are independent since event contracts don't interact
  fullyParallel: true,
  // Workers dynamically set to CPU core count, capped at 5 (account pool limit)
  // Each worker runs a full Chrome browser with MetaMask extension (heavy)
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
