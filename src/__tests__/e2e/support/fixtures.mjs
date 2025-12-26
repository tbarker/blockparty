/**
 * Playwright Test Fixtures for BlockParty E2E Tests
 *
 * Provides custom fixtures for blockchain-aware testing with mocked wallet.
 */

import { test as base, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

// Get directory name in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to mock Ethereum script and state file
const MOCK_ETHEREUM_PATH = path.join(__dirname, '../fixtures/mockEthereum.js');
const STATE_FILE = path.join(__dirname, '../.e2e-state.json');

/**
 * Anvil test accounts (same as in mockEthereum.js)
 */
export const TEST_ACCOUNTS = {
  deployer: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
  user1: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
  user2: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
  user3: '0x90F79bf6EB2c4f870365E785982E1f101E93b906',
};

/**
 * Load E2E state from global setup
 */
function loadState() {
  try {
    const content = fs.readFileSync(STATE_FILE, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.error('[E2E Fixtures] ERROR loading state from:', STATE_FILE);
    console.error('[E2E Fixtures] File exists:', fs.existsSync(STATE_FILE));
    console.error('[E2E Fixtures] Error:', error.message);
    throw new Error(
      'E2E state not found. Make sure global setup ran successfully.\n' + error.message
    );
  }
}

/**
 * Extended test fixtures with blockchain support
 */
export const test = base.extend({
  /**
   * E2E state from global setup (contract address, etc.)
   */
  e2eState: async ({}, use) => {
    const state = loadState();
    await use(state);
  },

  /**
   * Initial account to use (can be overridden in tests)
   * Default is 'user1', tests can use test.use({ initialAccount: 'deployer' })
   */
  initialAccount: ['user1', { option: true }],

  /**
   * Page with mock Ethereum provider injected
   */
  page: async ({ page, e2eState, initialAccount }, use) => {
    // Log browser console errors for debugging CI issues
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.log('[Browser Error]', msg.text());
      }
    });

    // Log page errors
    page.on('pageerror', err => {
      console.log('[Page Error]', err.message);
    });

    // Inject configuration before the mock script
    await page.addInitScript(
      ({ config, account }) => {
        window.__E2E_CONFIG__ = {
          rpcUrl: config.anvilUrl,
          chainId: config.chainId,
          contractAddress: config.contractAddress,
          activeAccount: account,
        };
        console.log('[E2E] Config injected:', window.__E2E_CONFIG__);
      },
      { config: e2eState, account: initialAccount }
    );

    // Inject mock Ethereum provider
    await page.addInitScript({ path: MOCK_ETHEREUM_PATH });

    await use(page);
  },

  /**
   * Contract address from deployment
   */
  contractAddress: async ({ e2eState }, use) => {
    await use(e2eState.contractAddress);
  },

  /**
   * Anvil RPC URL
   */
  anvilUrl: async ({ e2eState }, use) => {
    await use(e2eState.anvilUrl);
  },
});

/**
 * Re-export expect from Playwright
 */
export { expect };

/**
 * Helper to wait for a transaction notification
 * Looks for MUI Alert with success message or error message
 */
export async function waitForTransactionSuccess(page, timeout = 30000) {
  // Wait for either success or error notification
  const alertLocator = page.locator('[role="alert"]').first();

  try {
    await expect(alertLocator).toBeVisible({ timeout });

    // Check what message we got
    const alertText = await alertLocator.textContent();
    console.log('Transaction notification:', alertText);

    // If it's an error, fail the test with the error message
    if (alertText && alertText.toLowerCase().includes('error')) {
      throw new Error(`Transaction failed: ${alertText}`);
    }
  } catch (e) {
    // If no alert found, check console for errors
    console.log('No notification found, transaction may have failed silently');
    throw e;
  }
}

/**
 * Helper to wait for transaction requested notification
 */
export async function waitForTransactionRequested(page, timeout = 5000) {
  // Look for the "Requested" info notification
  const alertLocator = page.locator('[role="alert"]').first();

  try {
    await expect(alertLocator).toBeVisible({ timeout });
  } catch {
    // Requested notification is optional - transaction might complete quickly
    console.log('Requested notification not seen (may have completed quickly)');
  }
}

/**
 * Helper to switch the active test account
 * The account selection is persisted to sessionStorage so it survives page reloads
 */
export async function switchAccount(page, accountKey) {
  await page.evaluate(key => {
    window.__mockEthereum.switchAccount(key);
  }, accountKey);
}

/**
 * Helper to reset account to default (clears sessionStorage)
 */
export async function resetAccount(page) {
  await page.evaluate(() => {
    window.__mockEthereum.resetAccount();
  });
}

/**
 * Helper to get current account info
 */
export async function getCurrentAccount(page) {
  return await page.evaluate(() => {
    return window.__mockEthereum.getCurrentAccount();
  });
}

/**
 * Helper to reset Anvil state between tests
 */
export async function resetAnvil(anvilUrl) {
  await fetch(anvilUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'anvil_reset',
      params: [],
      id: Date.now(),
    }),
  });
}

/**
 * Helper to register for event (common flow)
 */
export async function registerForEvent(page, twitterHandle) {
  // Wait for app to load
  await page.waitForSelector('h4:has-text("Event Info")', { timeout: 30000 });
  await page.waitForSelector('text=RSVP', { timeout: 10000 });

  // Enter Twitter handle
  const twitterInput = page.locator('input[placeholder*="twitter"]');
  await twitterInput.fill(twitterHandle);

  // Click RSVP button
  const rsvpButton = page.locator('button:has-text("RSVP")');
  await expect(rsvpButton).toBeEnabled();
  await rsvpButton.click();

  // Wait for transaction to complete
  await waitForTransactionRequested(page);
  await waitForTransactionSuccess(page);
}

/**
 * Helper to check if user can register
 */
export async function canUserRegister(page) {
  const twitterInput = page.locator('input[placeholder*="twitter"]');
  return (await twitterInput.count()) > 0;
}
