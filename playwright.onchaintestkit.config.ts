/**
 * Playwright Configuration for OnchainTestKit E2E Tests
 *
 * Uses OnchainTestKit for wallet interactions with MetaMask.
 * Runs headful with xvfb in containers (devcontainer and CI).
 *
 * PARALLELIZATION STRATEGY:
 * - Each test gets its own Anvil instance via LocalNodeManager
 * - Dynamic port allocation (8546-9545) prevents conflicts
 * - Tests can run in parallel across spec files
 * - Each test deploys its own contract for full isolation
 */

import { defineConfig, devices } from '@playwright/test';
import os from 'os';

// With per-test Anvil instances, we can enable parallel execution
// Each test gets its own node with dynamic port allocation (8546-9545)
// Tested: 4 workers and 3 workers caused failures due to resource contention
// Using cpus/2 provides stable parallel execution (~15 min vs ~25 min with 1 worker)
const maxWorkers = Math.max(Math.floor(os.cpus().length / 2), 1);

export default defineConfig({
  testDir: './src/__tests__/e2e',

  // Tests within same file run sequentially to avoid OnchainTestKit state conflicts
  // Different spec files run in parallel across workers
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

  // Test timeout - can reduce from 240000 with better handling
  timeout: 180000,

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
        // OnchainTestKit requires headful mode for MetaMask extension
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

  // Note: Global setup/teardown removed - each test manages its own Anvil via LocalNodeManager
});
