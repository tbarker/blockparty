/**
 * Playwright Configuration for BlockParty E2E Tests
 *
 * Uses a custom mock Ethereum provider that forwards transactions to Anvil.
 * No real MetaMask extension needed - wallet interactions are simulated.
 * Tests run against a local Anvil blockchain with pre-funded test accounts.
 *
 * @see https://playwright.dev/docs/test-configuration
 */

import { defineConfig } from '@playwright/test';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  testDir: './src/__tests__/e2e',

  // Run tests sequentially - we're sharing blockchain state
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
  timeout: 60000,

  // Expect timeout for assertions
  expect: {
    timeout: 10000,
  },

  // Configure projects - Chrome only
  projects: [
    {
      name: 'chromium',
      use: {
        browserName: 'chromium',
        // Default to headless mode - use --headed flag or test:e2e:headed script for visible browser
        headless: true,
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

  // Global setup/teardown for Anvil blockchain
  globalSetup: path.resolve(__dirname, './src/__tests__/e2e/global-setup.cjs'),
  globalTeardown: path.resolve(__dirname, './src/__tests__/e2e/global-teardown.cjs'),
});
