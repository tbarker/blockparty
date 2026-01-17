/**
 * Synpress Test Fixtures for BlockParty E2E Tests
 *
 * Uses real MetaMask extension for wallet interactions.
 * Transactions are sent to a local Anvil instance for true E2E testing.
 */

import { testWithSynpress } from '@synthetixio/synpress';
import { MetaMask, metaMaskFixtures } from '@synthetixio/synpress/playwright';
import basicSetup from './wallet-setup/basic.setup.js';
import * as fs from 'fs';
import * as path from 'path';

// Load E2E state (contract addresses, etc.) from global setup
const STATE_FILE = path.join(__dirname, '.e2e-state.json');
function loadE2EState(): {
  contractAddress: string;
  factoryAddress: string;
  chainId: number;
  anvilUrl: string;
} {
  try {
    const data = fs.readFileSync(STATE_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (e) {
    console.warn('Could not load E2E state file:', e);
    return {
      contractAddress: '',
      factoryAddress: '',
      chainId: 1337,
      anvilUrl: 'http://localhost:8545',
    };
  }
}

/**
 * Diagnostic result for tracking system health
 */
export interface DiagnosticResult {
  timestamp: string;
  anvil: {
    responding: boolean;
    blockNumber?: number;
    chainId?: string;
    peerCount?: number;
    error?: string;
    responseTimeMs?: number;
  };
  metamask?: {
    extensionLoaded: boolean;
    notificationPagesOpen: number;
    error?: string;
  };
  browser?: {
    pageCount: number;
    memoryUsageMB?: number;
  };
}

/**
 * Perform detailed Anvil health check with multiple RPC methods.
 * This helps diagnose exactly what's failing when Anvil becomes unresponsive.
 */
export async function checkAnvilHealth(timeout = 10000): Promise<DiagnosticResult['anvil']> {
  const anvilUrl = E2E_STATE.anvilUrl || 'http://localhost:8545';
  const startTime = Date.now();

  const result: DiagnosticResult['anvil'] = {
    responding: false,
  };

  // Test 1: eth_blockNumber (most basic)
  try {
    const response = await Promise.race([
      fetch(anvilUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'eth_blockNumber',
          params: [],
          id: 1,
        }),
      }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), timeout)),
    ]) as Response;

    const data = await response.json();
    if (data.result) {
      result.blockNumber = parseInt(data.result, 16);
      result.responding = true;
    } else if (data.error) {
      result.error = `eth_blockNumber error: ${JSON.stringify(data.error)}`;
    }
  } catch (e) {
    result.error = `eth_blockNumber failed: ${(e as Error).message}`;
    result.responseTimeMs = Date.now() - startTime;
    return result;
  }

  // Test 2: eth_chainId
  try {
    const response = await Promise.race([
      fetch(anvilUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'eth_chainId',
          params: [],
          id: 2,
        }),
      }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), timeout)),
    ]) as Response;

    const data = await response.json();
    if (data.result) {
      result.chainId = data.result;
    }
  } catch (e) {
    console.warn('[checkAnvilHealth] eth_chainId failed:', (e as Error).message);
  }

  // Test 3: net_peerCount (tests networking layer)
  try {
    const response = await Promise.race([
      fetch(anvilUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'net_peerCount',
          params: [],
          id: 3,
        }),
      }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), timeout)),
    ]) as Response;

    const data = await response.json();
    if (data.result) {
      result.peerCount = parseInt(data.result, 16);
    }
  } catch (e) {
    // net_peerCount is optional, don't fail on it
  }

  result.responseTimeMs = Date.now() - startTime;
  return result;
}

/**
 * Check MetaMask extension state in the browser context.
 * This helps identify if MetaMask itself is the issue.
 */
export async function checkMetaMaskHealth(context: any): Promise<DiagnosticResult['metamask']> {
  const result: DiagnosticResult['metamask'] = {
    extensionLoaded: false,
    notificationPagesOpen: 0,
  };

  try {
    const pages = context.pages();
    let extensionPageFound = false;
    let notificationCount = 0;

    for (const p of pages) {
      try {
        const url = p.url();
        if (url.startsWith('chrome-extension://')) {
          extensionPageFound = true;
          if (url.includes('notification.html')) {
            notificationCount++;
          }
        }
      } catch {
        // Page might be closed
      }
    }

    result.extensionLoaded = extensionPageFound;
    result.notificationPagesOpen = notificationCount;
  } catch (e) {
    result.error = `Context check failed: ${(e as Error).message}`;
  }

  return result;
}

/**
 * Perform full diagnostic check and log results.
 * Call this when tests fail to understand the system state.
 */
export async function runDiagnostics(context?: any, label = 'DIAGNOSTIC'): Promise<DiagnosticResult> {
  const result: DiagnosticResult = {
    timestamp: new Date().toISOString(),
    anvil: await checkAnvilHealth(),
  };

  if (context) {
    result.metamask = await checkMetaMaskHealth(context);

    // Count pages
    try {
      const pages = context.pages();
      result.browser = {
        pageCount: pages.length,
      };
    } catch {
      result.browser = { pageCount: -1 };
    }
  }

  // Log diagnostic summary
  console.log(`\n========== ${label} ==========`);
  console.log(`Timestamp: ${result.timestamp}`);
  console.log(`Anvil:`);
  console.log(`  - Responding: ${result.anvil.responding}`);
  console.log(`  - Block Number: ${result.anvil.blockNumber ?? 'N/A'}`);
  console.log(`  - Chain ID: ${result.anvil.chainId ?? 'N/A'}`);
  console.log(`  - Response Time: ${result.anvil.responseTimeMs ?? 'N/A'}ms`);
  if (result.anvil.error) {
    console.log(`  - Error: ${result.anvil.error}`);
  }

  if (result.metamask) {
    console.log(`MetaMask:`);
    console.log(`  - Extension Loaded: ${result.metamask.extensionLoaded}`);
    console.log(`  - Notification Pages: ${result.metamask.notificationPagesOpen}`);
    if (result.metamask.error) {
      console.log(`  - Error: ${result.metamask.error}`);
    }
  }

  if (result.browser) {
    console.log(`Browser:`);
    console.log(`  - Page Count: ${result.browser.pageCount}`);
  }
  console.log(`================================\n`);

  return result;
}

export const E2E_STATE = loadE2EState();

// Create test instance with Synpress MetaMask fixtures
export const test = testWithSynpress(metaMaskFixtures(basicSetup));
export const { expect } = test;

// Re-export wallet password for creating MetaMask instances
export const WALLET_PASSWORD = basicSetup.walletPassword;

/**
 * Anvil test accounts (from seed phrase: "test test test test test test test test test test test junk")
 */
export const TEST_ACCOUNTS = {
  deployer: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
  user1: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
  user2: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
  user3: '0x90F79bf6EB2c4f870365E785982E1f101E93b906',
};

/**
 * Create a MetaMask instance for test interactions
 */
export function createMetaMask(context: any, metamaskPage: any, extensionId: string): MetaMask {
  return new MetaMask(context as any, metamaskPage as any, WALLET_PASSWORD, extensionId);
}

/**
 * Wait for transaction success notification in the UI
 */
export async function waitForTransactionSuccess(page: any, timeout = 60000): Promise<void> {
  const isCI = process.env.CI === 'true';
  const effectiveTimeout = isCI ? Math.max(timeout, 90000) : timeout;

  console.log(`[waitForTransactionSuccess] Waiting for alert (timeout: ${effectiveTimeout}ms)`);

  const alertLocator = page.locator('[role="alert"]').first();
  await expect(alertLocator).toBeVisible({ timeout: effectiveTimeout });

  const alertText = await alertLocator.textContent();
  console.log(`[waitForTransactionSuccess] Alert appeared: ${alertText?.substring(0, 100)}`);

  if (alertText && alertText.toLowerCase().includes('error')) {
    throw new Error(`Transaction failed: ${alertText}`);
  }
}

/**
 * Check if the browser context is still valid and healthy.
 * In CI, contexts can become corrupted after many tests.
 */
async function isContextHealthy(context: any): Promise<boolean> {
  try {
    // Try to access pages - if context is closed, this will throw
    const pages = context.pages();
    return Array.isArray(pages);
  } catch {
    return false;
  }
}

/**
 * Wait for MetaMask notification popup and confirm the transaction.
 * Replaces the common pattern: waitForTimeout(2000) + confirmTransaction()
 */
export async function waitForMetaMaskAndConfirm(
  metamask: MetaMask,
  context: any,
  options?: { timeout?: number; maxRetries?: number }
): Promise<void> {
  // CI environments are slower - use longer timeouts and more retries
  const isCI = process.env.CI === 'true';
  const timeout = options?.timeout || (isCI ? 45000 : 10000);
  const maxRetries = options?.maxRetries || (isCI ? 6 : 2);

  console.log(`[waitForMetaMaskAndConfirm] Starting (CI: ${isCI}, timeout: ${timeout}ms)`);

  // Check context health before proceeding
  const healthy = await isContextHealthy(context);
  if (!healthy) {
    console.error('[waitForMetaMaskAndConfirm] Browser context is not healthy');
    throw new Error('Browser context is closed or corrupted');
  }

  // In CI, add a small delay before waiting for events to let MetaMask settle
  if (isCI) {
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }

  // Check if notification page already exists (might have opened before we started waiting)
  let notificationExists = false;
  try {
    const pages = context.pages();
    for (const p of pages) {
      try {
        if (p.url().includes('notification.html')) {
          notificationExists = true;
          console.log('[waitForMetaMaskAndConfirm] Notification page already exists');
          break;
        }
      } catch {
        // Page might be closed
      }
    }
  } catch {
    // Context issue
  }

  // Wait for a MetaMask notification page to appear (if not already present)
  if (!notificationExists) {
    try {
      await context.waitForEvent('page', {
        predicate: (p: any) => p.url().includes('notification.html'),
        timeout: timeout,
      });
      console.log('[waitForMetaMaskAndConfirm] Notification page appeared');
    } catch (e) {
      const errorMsg = (e as Error).message || '';
      // Check for context corruption errors
      if (errorMsg.includes('closed') || errorMsg.includes('Target page')) {
        console.error('[waitForMetaMaskAndConfirm] Context appears to be corrupted:', errorMsg);
        throw new Error('Browser context corrupted during MetaMask wait');
      }
      // Page might already exist or transaction already initiated, continue
      console.log('[waitForMetaMaskAndConfirm] Notification page wait timed out, checking if it exists...');

      // Double-check if notification page appeared
      try {
        const pages = context.pages();
        for (const p of pages) {
          try {
            if (p.url().includes('notification.html')) {
              console.log('[waitForMetaMaskAndConfirm] Found notification page on second check');
              notificationExists = true;
              break;
            }
          } catch {
            // Page might be closed
          }
        }
      } catch {
        // Context issue
      }

      if (!notificationExists) {
        console.warn('[waitForMetaMaskAndConfirm] No notification page found, proceeding anyway');
      }
    }
  }

  // Delay to ensure the notification page is fully loaded
  // This helps with CI where page rendering may be slower
  const loadDelay = isCI ? 3000 : 1000;
  await new Promise((resolve) => setTimeout(resolve, loadDelay));

  // Retry confirmation in case of timing issues
  let lastError: Error | undefined;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      console.log(`[waitForMetaMaskAndConfirm] Attempting confirmation (${attempt + 1}/${maxRetries})`);
      await metamask.confirmTransaction();
      console.log(`[waitForMetaMaskAndConfirm] Confirmed on attempt ${attempt + 1}`);
      return; // Success
    } catch (e) {
      lastError = e as Error;
      const errorMsg = lastError.message || '';

      // Check for unrecoverable errors
      if (errorMsg.includes('closed') || errorMsg.includes('Target page')) {
        console.error('[waitForMetaMaskAndConfirm] Context corrupted during confirmation');
        throw lastError;
      }

      console.warn(
        `[waitForMetaMaskAndConfirm] Attempt ${attempt + 1}/${maxRetries} failed:`,
        lastError.message
      );
      if (attempt < maxRetries - 1) {
        // Longer wait before retry in CI
        const retryDelay = isCI ? 5000 : 2000;
        await new Promise((resolve) => setTimeout(resolve, retryDelay));
      }
    }
  }

  // If all retries failed, run diagnostics and throw the last error
  console.error('[waitForMetaMaskAndConfirm] All retries failed');

  // Run diagnostics to help identify the issue
  await runDiagnostics(context, 'METAMASK CONFIRM FAILURE DIAGNOSTICS');

  if (lastError) {
    throw lastError;
  }
}

/**
 * Wait for UI to reflect transaction completion.
 * Waits for success notification and optional expected element.
 */
export async function waitForTransactionComplete(
  page: any,
  options?: {
    timeout?: number;
    expectElement?: string;
  }
): Promise<void> {
  const timeout = options?.timeout || 120000;

  // Wait for success notification
  await waitForTransactionSuccess(page, timeout);

  // If specific element expected, wait for it
  if (options?.expectElement) {
    await page
      .locator(options.expectElement)
      .waitFor({ state: 'visible', timeout: 10000 })
      .catch(() => {
        // Element might already be visible or not applicable
      });
  }

  // Wait for any loading indicators to disappear
  await page
    .locator('[role="progressbar"], .MuiCircularProgress-root')
    .waitFor({ state: 'hidden', timeout: 5000 })
    .catch(() => {
      // No loading indicator present
    });
}

/**
 * Wait for page to be loaded.
 * Uses 'domcontentloaded' because it's more reliable than 'networkidle':
 * 1. 'networkidle' can hang when external requests (Arweave, etc.) are slow
 * 2. Background requests keep the network from ever being "idle"
 * 3. 'domcontentloaded' is sufficient for testing UI interactions
 */
export async function waitForPageReady(page: any): Promise<void> {
  try {
    await page.waitForLoadState('domcontentloaded', { timeout: 30000 });
  } catch {
    // If load state times out, continue anyway - the page is likely usable
    console.warn('[waitForPageReady] waitForLoadState timed out, continuing');
  }
}

/**
 * Inject E2E configuration into the page (contract address, factory address, etc.)
 * This must be called before navigating to the app or via addInitScript.
 * Also sets localStorage to prevent the welcome modal from appearing.
 */
export async function injectE2EConfig(page: any): Promise<void> {
  await page.addInitScript(
    (config: { contractAddress: string; factoryAddress: string; chainId: number }) => {
      (window as any).__E2E_CONFIG__ = config;
      // Prevent welcome modal from appearing during E2E tests
      try {
        localStorage.setItem('blockparty_welcome_seen', 'true');
      } catch {
        // localStorage may not be available
      }
    },
    {
      contractAddress: E2E_STATE.contractAddress,
      factoryAddress: E2E_STATE.factoryAddress,
      chainId: E2E_STATE.chainId,
    }
  );
}

/**
 * Inject E2E configuration for factory-only tests (no pre-existing contract).
 * Used for testing the "Create New Event" flow where the app starts without a contract.
 * Also sets localStorage to prevent the welcome modal from appearing.
 */
export async function injectE2EConfigFactoryOnly(page: any): Promise<void> {
  await page.addInitScript(
    (config: { contractAddress: string; factoryAddress: string; chainId: number }) => {
      (window as any).__E2E_CONFIG__ = config;
      // Prevent welcome modal from appearing during E2E tests
      try {
        localStorage.setItem('blockparty_welcome_seen', 'true');
      } catch {
        // localStorage may not be available
      }
    },
    {
      contractAddress: '', // No pre-existing contract
      factoryAddress: E2E_STATE.factoryAddress,
      chainId: E2E_STATE.chainId,
    }
  );
}

/**
 * Dismiss any open RainbowKit popovers that might be blocking interactions.
 * This handles the account dropdown and other RainbowKit UI elements.
 * Uses multiple approaches: Escape key, clicking outside, and direct removal.
 */
export async function dismissRainbowKitPopovers(page: any): Promise<void> {
  // Check if page is still valid
  try {
    if (page.isClosed()) {
      return;
    }
  } catch {
    return;
  }

  const maxAttempts = 5;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      // Check for various RainbowKit popover elements
      // RainbowKit uses portals with specific IDs and classes
      const popoverSelectors = [
        '#popover-content',
        '.popover-bg',
        '[data-rk] [role="dialog"]',
        '[data-rk] [data-radix-popper-content-wrapper]',
        '[data-rk-popover]',
      ];

      let popoverFound = false;
      for (const selector of popoverSelectors) {
        const popover = page.locator(selector);
        const isVisible = await popover.isVisible({ timeout: 500 }).catch(() => false);
        if (isVisible) {
          popoverFound = true;
          break;
        }
      }

      if (!popoverFound) {
        // No popover found, we're done
        return;
      }

      console.log(`[dismissRainbowKitPopovers] Popover detected on attempt ${attempt + 1}, trying to close`);

      // Approach 1: Press Escape (works for most modals)
      await page.keyboard.press('Escape');

      // Wait for popover to be hidden rather than arbitrary delay
      const popoverLocator = page.locator('#popover-content, .popover-bg').first();
      const closedViaEscape = await popoverLocator
        .waitFor({ state: 'hidden', timeout: 1000 })
        .then(() => true)
        .catch(() => false);

      if (closedViaEscape) {
        console.log('[dismissRainbowKitPopovers] Popover closed via Escape');
        return;
      }

      // Approach 2: Click outside the popover (on the page body)
      try {
        // Click on a neutral area - the top left corner of the page
        await page.mouse.click(10, 10);
        // Wait briefly for click to take effect
        await popoverLocator.waitFor({ state: 'hidden', timeout: 500 }).catch(() => {});
      } catch {
        // Click might fail, continue
      }

      // Approach 3: Click on the popover background overlay if it exists
      const popoverBg = page.locator('.popover-bg');
      if (await popoverBg.isVisible({ timeout: 200 }).catch(() => false)) {
        try {
          await popoverBg.click({ force: true });
          // Wait for popover to close
          await popoverLocator.waitFor({ state: 'hidden', timeout: 500 }).catch(() => {});
        } catch {
          // Click might fail
        }
      }

      // Approach 4: Remove popover elements via JavaScript (last resort)
      try {
        await page.evaluate(() => {
          // Remove popover content and background
          const popoverContent = document.getElementById('popover-content');
          if (popoverContent) {
            popoverContent.innerHTML = '';
          }
          // Hide popover background
          const popoverBgs = document.querySelectorAll('.popover-bg');
          popoverBgs.forEach((el) => {
            (el as HTMLElement).style.display = 'none';
          });
        });
      } catch {
        // Evaluate might fail
      }
    } catch {
      // Error during dismissal, continue to next attempt
    }
  }

  console.log('[dismissRainbowKitPopovers] Failed to dismiss popover after max attempts');
}

/**
 * Dismiss the welcome/instruction modal if it appears.
 * The modal shows on first visit and blocks all interactions until dismissed.
 * The modal renders via requestAnimationFrame after React mounts, which can be delayed in CI.
 *
 * This function is now more aggressive - it waits longer and retries more.
 */
export async function dismissWelcomeModal(page: any): Promise<void> {
  const isCI = process.env.CI === 'true';
  const maxAttempts = isCI ? 15 : 8;
  const checkTimeout = isCI ? 2000 : 1500;

  // First, try to set localStorage to prevent modal from reappearing
  try {
    await page.evaluate(() => {
      localStorage.setItem('blockparty_welcome_seen', 'true');
    });
  } catch {
    // localStorage might not be accessible
  }

  // Give the page time for requestAnimationFrame to fire (modal appears async)
  try {
    await page.waitForTimeout(isCI ? 500 : 300);
  } catch {
    // Page might be closed
    return;
  }

  // Retry multiple times - modal may appear after a delay in CI environments
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    // Check if page is still valid
    try {
      if (page.isClosed()) {
        console.log('[dismissWelcomeModal] Page is closed, aborting');
        return;
      }
    } catch {
      // isClosed might throw if page is invalid
      return;
    }

    try {
      // The Welcome modal specifically contains "Welcome to BlockParty" title and an "Ok" button
      // Use specific selector to avoid matching other dialogs like Event Created
      const welcomeModal = page.locator('[role="dialog"]:has-text("Welcome to BlockParty")');
      const okButton = welcomeModal.locator('button:has-text("Ok")');

      // Wait for modal to potentially appear (can be delayed via requestAnimationFrame)
      const isModalVisible = await welcomeModal.isVisible({ timeout: checkTimeout }).catch(() => false);

      if (isModalVisible) {
        console.log(`[dismissWelcomeModal] Welcome modal visible on attempt ${attempt + 1}, clicking Ok button`);
        // Wait for the Ok button to be clickable and click it
        await okButton.waitFor({ state: 'visible', timeout: 5000 });
        // Use force:true to click even if something is in front (modal backdrop edge cases)
        await okButton.click({ force: true });

        // Wait for modal to fully close
        await welcomeModal.waitFor({ state: 'hidden', timeout: 5000 });
        console.log(`[dismissWelcomeModal] Welcome modal dismissed successfully`);

        // Set localStorage again after dismissing to prevent reappearance
        try {
          await page.evaluate(() => {
            localStorage.setItem('blockparty_welcome_seen', 'true');
          });
        } catch {
          // localStorage might not be accessible
        }
        return; // Successfully dismissed
      }
    } catch (e) {
      // Modal may have already closed or page state changed - try again
      console.log(`[dismissWelcomeModal] Attempt ${attempt + 1} error:`, (e as Error).message);
    }
    // Small delay before retry - wrap in try-catch in case page is closed
    try {
      await page.waitForTimeout(300);
    } catch {
      console.log('[dismissWelcomeModal] Page closed during wait');
      return;
    }
  }
  console.log(`[dismissWelcomeModal] No modal found after ${maxAttempts} attempts`);
}

/**
 * Wait for app to fully load
 */
export async function waitForAppLoad(page: any): Promise<void> {
  // Check if page is still valid before operating on it
  try {
    // Quick check if page is closed
    if (page.isClosed()) {
      console.error('[waitForAppLoad] Page is closed, cannot wait for load');
      return;
    }
  } catch {
    // isClosed might not be available, continue anyway
  }

  // Set localStorage to prevent welcome modal from appearing
  // This must be done early before React renders
  try {
    await page.evaluate(() => {
      localStorage.setItem('blockparty_welcome_seen', 'true');
    });
  } catch {
    // localStorage might not be accessible yet
  }

  // Dismiss any open popovers that might be leftover from previous actions
  try {
    await dismissRainbowKitPopovers(page);
  } catch (e) {
    console.warn('[waitForAppLoad] Failed to dismiss popovers:', (e as Error).message);
  }

  // Wait for page to be ready
  // Use 'domcontentloaded' instead of 'networkidle' because networkidle
  // can hang when external requests are slow or background activity continues
  try {
    await page.waitForLoadState('domcontentloaded');
  } catch (e) {
    console.warn('[waitForAppLoad] waitForLoadState failed:', (e as Error).message);
    // Page might be closed or navigating, try to continue anyway
  }

  // Set localStorage again after network is idle (belt and suspenders)
  try {
    await page.evaluate(() => {
      localStorage.setItem('blockparty_welcome_seen', 'true');
    });
  } catch {
    // localStorage might not be accessible
  }

  // Wait for React to render - look for the app container to have content
  await page
    .waitForFunction(
      () => {
        const appDiv = document.getElementById('app');
        return appDiv && appDiv.innerHTML.length > 100;
      },
      { timeout: 60000 }
    )
    .catch(() => {
      // React did not render in time, continue anyway
    });

  // Dismiss the welcome modal if it appears (shows after React mounts via requestAnimationFrame)
  await dismissWelcomeModal(page);

  // Check if page is still valid before waiting for selectors
  try {
    if (page.isClosed()) {
      console.error('[waitForAppLoad] Page closed before waiting for Event Info');
      return;
    }
  } catch {
    return;
  }

  // Wait for Event Info header
  try {
    await page.waitForSelector('h4:has-text("Event Info")', { timeout: 60000 });
  } catch (e) {
    console.warn('[waitForAppLoad] waitForSelector failed:', (e as Error).message);
    // Don't throw - the page might still be usable
  }

  // Wait for dynamic content to be populated instead of arbitrary timeout
  // The app is stable when deposit amount (ETH) is displayed
  await page
    .locator('text=/\\d+\\.\\d+.*ETH/i')
    .first()
    .waitFor({ state: 'visible', timeout: 30000 })
    .catch(() => {
      // Content might already be visible or in a different format
    });

  // Warn if app is in READONLY mode - this indicates wallet connection issues
  // that may cause subsequent test steps to fail
  try {
    const readonlyLabel = page.locator('text=READONLY');
    if (await readonlyLabel.isVisible({ timeout: 1000 }).catch(() => false)) {
      console.warn('[waitForAppLoad] WARNING: App is in READONLY mode - wallet may not be connected');
    }
  } catch {
    // Ignore - page might be closed
  }

  // Final dismissal of any popovers that may have appeared during loading
  try {
    await dismissRainbowKitPopovers(page);
  } catch {
    // Ignore dismissal errors
  }
}

/**
 * Check if user can register (twitter input visible)
 */
export async function canUserRegister(page: any): Promise<boolean> {
  const twitterInput = page.locator('input[placeholder*="twitter"]');
  return (await twitterInput.count()) > 0;
}

/**
 * Safely reload page and get a fresh page reference.
 * Handles cases where the page might be closed or stale.
 * Also dismisses any popovers that might be blocking interactions.
 * IMPORTANT: This function ensures the app page is brought to front after reload.
 */
export async function safeReloadAndGetPage(page: any, context: any): Promise<any> {
  try {
    // First dismiss any popovers that might interfere with reload
    try {
      await dismissRainbowKitPopovers(page);
    } catch {
      // Ignore dismissal errors
    }

    // Check if page is still valid
    if (page.isClosed()) {
      console.log('[safeReloadAndGetPage] Page was closed, getting fresh page');
      const freshPage = await getAppPage(context);
      await freshPage.bringToFront();
      return freshPage;
    }

    // Bring app page to front before any operations
    await page.bringToFront();

    // Set localStorage to prevent welcome modal before reload
    try {
      await page.evaluate(() => {
        localStorage.setItem('blockparty_welcome_seen', 'true');
      });
    } catch {
      // localStorage might not be accessible
    }

    // Reload the page
    await page.reload({ waitUntil: 'domcontentloaded' });

    // Bring to front again after reload
    await page.bringToFront();

    // Wait for load state
    await page.waitForLoadState('domcontentloaded').catch(() => {
      console.warn('[safeReloadAndGetPage] waitForLoadState failed after reload');
    });

    // Ensure localStorage is still set after reload (for safety)
    try {
      await page.evaluate(() => {
        localStorage.setItem('blockparty_welcome_seen', 'true');
      });
    } catch {
      // localStorage might not be accessible
    }

    // Dismiss any popovers and modals that might appear after reload
    try {
      await dismissRainbowKitPopovers(page);
    } catch {
      // Ignore dismissal errors
    }
    try {
      await dismissWelcomeModal(page);
    } catch {
      // Ignore dismissal errors
    }

    return page;
  } catch (e) {
    console.warn('[safeReloadAndGetPage] Reload failed:', (e as Error).message);
    // Try to get a fresh page reference
    try {
      const freshPage = await getAppPage(context);
      await freshPage.bringToFront();
      return freshPage;
    } catch {
      throw new Error('Failed to reload page and get fresh reference');
    }
  }
}

/**
 * Anvil local network configuration
 * Note: Using localhost instead of 127.0.0.1 to match wagmi config
 * and ensure consistent DNS resolution in container environments
 */
export const ANVIL_NETWORK = {
  name: 'Anvil',
  rpcUrl: 'http://localhost:8545',
  chainId: 1337,
  symbol: 'ETH',
};

/**
 * Add Anvil network to MetaMask and switch to it.
 * This function now has retry logic and does not silently fail.
 *
 * IMPORTANT: We try addNetwork FIRST because calling switchNetwork when the
 * network doesn't exist opens a modal that can get stuck.
 */
export async function addAndSwitchToAnvilNetwork(metamask: MetaMask): Promise<void> {
  const maxRetries = 8;
  let lastError: Error | undefined;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      // First try adding the network (this also switches to it)
      // We do this first because switchNetwork can open a blocking modal if network doesn't exist
      await metamask.addNetwork(ANVIL_NETWORK);
      console.log(`[addAndSwitchToAnvilNetwork] Successfully added and switched to Anvil network`);
      // The Synpress addNetwork method handles waiting for completion internally
      return;
    } catch (addError) {
      // Network might already exist, try switching to it
      console.log(
        `[addAndSwitchToAnvilNetwork] addNetwork failed (likely already exists):`,
        (addError as Error).message
      );
      try {
        await metamask.switchNetwork('Anvil', true);
        console.log(`[addAndSwitchToAnvilNetwork] Successfully switched to existing Anvil network`);
        // The Synpress switchNetwork method handles waiting for completion internally
        return;
      } catch (switchError) {
        lastError = switchError as Error;
        console.warn(
          `[addAndSwitchToAnvilNetwork] Attempt ${attempt + 1}/${maxRetries} failed:`,
          (switchError as Error).message
        );
        // Synpress methods are async and handle their own waiting, so minimal delay between retries
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }
  }

  // If we get here, all retries failed - run diagnostics and throw an error
  console.error(`[addAndSwitchToAnvilNetwork] Failed to switch to Anvil network after ${maxRetries} attempts`);

  // Run Anvil diagnostics to check if the blockchain is the issue
  const anvilHealth = await checkAnvilHealth();
  console.error('[addAndSwitchToAnvilNetwork] Anvil health check:', JSON.stringify(anvilHealth, null, 2));

  throw new Error(`Failed to switch to Anvil network: ${lastError?.message || 'Unknown error'}`);
}

/**
 * Find the app page from context (not the MetaMask extension page)
 * In CI, pages may be slow to appear, so we retry if needed.
 */
export async function getAppPage(context: any, options?: { timeout?: number }): Promise<any> {
  const timeout = options?.timeout || 10000;
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    const pages = context.pages();

    // Find the page that's on localhost:3000 (our app) by checking URL
    for (let i = 0; i < pages.length; i++) {
      const url = pages[i].url();
      if (url.includes('localhost:3000')) {
        return pages[i];
      }
    }

    // If not found, look for about:blank (might be the initial page)
    for (let i = 0; i < pages.length; i++) {
      const url = pages[i].url();
      if (url === 'about:blank') {
        return pages[i];
      }
    }

    // If not found, return the first non-extension page
    for (let i = 0; i < pages.length; i++) {
      const url = pages[i].url();
      if (!url.startsWith('chrome-extension://')) {
        return pages[i];
      }
    }

    // If pages array has items but none match criteria, return first one
    if (pages.length > 0) {
      return pages[0];
    }

    // No pages found yet, wait a bit and retry
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  // Timeout reached - throw error instead of creating blank page
  // Creating a new page would cause issues since it won't have the app loaded
  console.error('[getAppPage] No app page found after timeout');
  throw new Error('No app page found in context');
}

/**
 * Setup MetaMask for testing: add network and prepare for dapp connection
 * This should be called before navigating to the app
 * Returns the app page after switching back to it
 */
export async function setupMetaMaskNetwork(metamask: MetaMask, context: any): Promise<any> {
  await addAndSwitchToAnvilNetwork(metamask);

  // Get the app page and bring it to front
  const appPage = await getAppPage(context);
  await appPage.bringToFront();

  // Wait for the page to be ready for interaction
  await appPage.waitForLoadState('domcontentloaded').catch(() => {
    // Page might already be loaded
  });

  // Set localStorage to prevent welcome modal from appearing
  try {
    await appPage.evaluate(() => {
      localStorage.setItem('blockparty_welcome_seen', 'true');
    });
  } catch {
    // localStorage might not be accessible
  }

  return appPage;
}

/**
 * Connect MetaMask to dapp - handles RainbowKit ConnectButton flow
 * With RainbowKit, clicking the Connect button opens a modal where user selects a wallet.
 * For MetaMask, this triggers a MetaMask notification popup.
 */
export async function connectWalletIfNeeded(
  page: any,
  metamask: MetaMask,
  context: any
): Promise<any> {
  const isCI = process.env.CI === 'true';

  // Set localStorage to prevent welcome modal from appearing
  try {
    await page.evaluate(() => {
      localStorage.setItem('blockparty_welcome_seen', 'true');
    });
  } catch {
    // localStorage might not be accessible
  }

  // First, dismiss any RainbowKit popovers that might be blocking from previous tests
  await dismissRainbowKitPopovers(page);

  // Dismiss any welcome/instruction modal that might be blocking
  await dismissWelcomeModal(page);

  // Check if already connected - RainbowKit shows account address when connected
  const isAlreadyConnected = await page
    .locator('[data-testid="rk-account-button"], button:has-text("0x")')
    .isVisible({ timeout: isCI ? 5000 : 3000 })
    .catch(() => false);

  if (isAlreadyConnected) {
    console.log('Wallet already connected');
    return await getAppPage(context);
  }

  // Look for RainbowKit Connect Wallet button
  const rainbowKitConnectButton = page.locator('button:has-text("Connect Wallet")');

  // Wait for the button to be visible (may take time after modal dismissal)
  await rainbowKitConnectButton.waitFor({ state: 'visible', timeout: isCI ? 15000 : 10000 }).catch(() => {
    console.log('Connect Wallet button not found');
  });

  const isRainbowKitButtonVisible = await rainbowKitConnectButton.isVisible().catch(() => false);

  if (isRainbowKitButtonVisible) {
    console.log('Clicking RainbowKit Connect Wallet button');
    // Use force:true in case welcome modal is still blocking
    await rainbowKitConnectButton.click({ force: true });

    // Wait for RainbowKit modal to appear by checking for MetaMask option
    const metamaskOption = page.locator('button:has-text("MetaMask"), [data-testid="rk-wallet-option-metaMask"]');

    // Wait for MetaMask option to be visible (this confirms modal opened)
    const isMetaMaskOptionVisible = await metamaskOption
      .first()
      .waitFor({ state: 'visible', timeout: isCI ? 15000 : 10000 })
      .then(() => true)
      .catch(() => false);

    // Dismiss welcome modal if it appeared during modal open
    await dismissWelcomeModal(page);

    if (isMetaMaskOptionVisible) {
      console.log('Clicking MetaMask option in RainbowKit modal');
      // Use force:true in case welcome modal is still blocking
      await metamaskOption.first().click({ force: true });
    }

    // Wait for MetaMask notification popup to appear
    try {
      await context.waitForEvent('page', {
        predicate: (p: any) => p.url().includes('notification.html'),
        timeout: isCI ? 20000 : 10000,
      });
    } catch {
      // Popup might already exist
    }

    // Approve the connection in MetaMask
    // Synpress connectToDapp handles waiting for the notification page internally
    try {
      await metamask.connectToDapp();
      console.log('MetaMask connection approved');
    } catch (e) {
      console.log('connectToDapp attempt:', (e as Error).message);
      // The notification page might not have appeared, but the wallet could still be connected
      // We'll check the connected state below
    }
  } else {
    // Fallback: Check for MetaMask notification popup (auto-connection scenarios)
    try {
      await context.waitForEvent('page', {
        predicate: (p: any) => p.url().includes('notification.html'),
        timeout: isCI ? 10000 : 5000,
      });
      await metamask.connectToDapp();
    } catch {
      // No popup appeared - wallet might already be connected
    }
  }

  // Return the app page (in case focus shifted during connection)
  const appPage = await getAppPage(context);
  await appPage.bringToFront();

  // Set localStorage to prevent welcome modal from appearing
  try {
    await appPage.evaluate(() => {
      localStorage.setItem('blockparty_welcome_seen', 'true');
    });
  } catch {
    // localStorage might not be accessible
  }

  // Dismiss any welcome modal that might have appeared
  await dismissWelcomeModal(appPage);

  // Wait for app to leave READONLY mode - this is the true indicator of successful connection
  // RainbowKit may show account button before wagmi has fully established the signer
  const readonlyLabel = appPage.locator('text=READONLY');
  const maxWaitAttempts = isCI ? 15 : 10;
  let connectionEstablished = false;

  for (let i = 0; i < maxWaitAttempts; i++) {
    const isStillReadonly = await readonlyLabel.isVisible({ timeout: 1000 }).catch(() => false);
    if (!isStillReadonly) {
      connectionEstablished = true;
      console.log(`[connectWalletIfNeeded] Connection established after ${i + 1} checks`);
      break;
    }
    // Wait and check again
    await new Promise((resolve) => setTimeout(resolve, isCI ? 1000 : 500));
  }

  if (!connectionEstablished) {
    console.log('[connectWalletIfNeeded] Timeout waiting for READONLY to disappear');
    // Run diagnostics to understand why connection failed
    await runDiagnostics(context, 'WALLET CONNECTION TIMEOUT - READONLY PERSISTS');
  }

  // Also wait for account button to be visible (positive confirmation)
  const connectedIndicator = appPage.locator('[data-testid="rk-account-button"], button:has-text("0x")');
  const hasAccountButton = await connectedIndicator
    .waitFor({ state: 'visible', timeout: 5000 })
    .then(() => true)
    .catch(() => false);

  if (!hasAccountButton) {
    console.log('[connectWalletIfNeeded] Account button not visible after connection');
  }

  // Final verification: check if we're still in READONLY mode
  // This is just a warning - we don't throw an error because wagmi may still be connecting
  // The original behavior allowed tests to proceed even if READONLY was briefly shown
  const readonlyCheck = appPage.locator('text=READONLY');
  if (await readonlyCheck.isVisible({ timeout: 2000 }).catch(() => false)) {
    console.warn('[connectWalletIfNeeded] App still in READONLY mode - wagmi may still be connecting');
    // Attempt one reconnection but don't fail if it doesn't work immediately
    await ensureWalletConnected(appPage, metamask, context, 1);
  }

  // Dismiss any popovers that may have appeared during connection
  // This is critical because clicking the connect button can leave the RainbowKit
  // account dropdown open, which blocks all subsequent interactions
  await dismissRainbowKitPopovers(appPage);

  return appPage;
}

/**
 * Check if app is in READONLY mode and attempt to reconnect if so.
 * READONLY mode indicates the wallet is disconnected (!isConnected || !signer).
 * This can happen after page reload when MetaMask/RainbowKit don't properly reconnect.
 * Returns true if app is connected (not READONLY), false if reconnection failed.
 *
 * Strategy:
 * 1. First try clicking Connect Wallet if visible
 * 2. If Connect Wallet not visible but still READONLY, try clicking account button to disconnect
 * 3. As last resort, reload the page and try fresh connection
 */
export async function ensureWalletConnected(
  page: any,
  metamask: MetaMask,
  context: any,
  maxAttempts = 3
): Promise<boolean> {
  const isCI = process.env.CI === 'true';

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    // Check for READONLY label - indicates wallet not connected
    const readonlyLabel = page.locator('text=READONLY');
    const isReadonly = await readonlyLabel.isVisible({ timeout: 2000 }).catch(() => false);

    if (!isReadonly) {
      // Also verify we see the account button (positive confirmation of connection)
      const accountBtn = page.locator('[data-testid="rk-account-button"], button:has-text("0x")');
      if (await accountBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        console.log('[ensureWalletConnected] Wallet is connected');
        return true;
      }
    }

    console.log(
      `[ensureWalletConnected] App in READONLY mode, attempting reconnection (attempt ${attempt + 1}/${maxAttempts})`
    );

    // Check if Connect Wallet button is visible
    const connectBtn = page.locator('button:has-text("Connect Wallet")');
    const isConnectBtnVisible = await connectBtn.isVisible({ timeout: 2000 }).catch(() => false);

    if (isConnectBtnVisible) {
      // Standard reconnection flow
      await connectBtn.click();

      // Wait for MetaMask modal and click MetaMask option
      const metamaskOption = page.locator(
        'button:has-text("MetaMask"), [data-testid="rk-wallet-option-metaMask"]'
      );
      const isMetaMaskVisible = await metamaskOption
        .first()
        .waitFor({ state: 'visible', timeout: 5000 })
        .then(() => true)
        .catch(() => false);

      if (isMetaMaskVisible) {
        await metamaskOption.first().click();

        // Handle MetaMask connection approval
        try {
          await metamask.connectToDapp();
        } catch {
          // Connection might already be approved
        }
      }

      // Wait for connection to complete
      await new Promise((resolve) => setTimeout(resolve, isCI ? 3000 : 1500));
    } else {
      // Connect Wallet button not visible but still in READONLY mode
      // This is the tricky case: RainbowKit thinks we're connected but wagmi doesn't have a signer
      // DO NOT click Disconnect - that would break the connection that's being established
      // Instead, just wait for wagmi to catch up or reload the page to trigger fresh initialization
      console.log(
        '[ensureWalletConnected] Connect Wallet button not visible, waiting for wagmi to sync'
      );

      // Wait a bit for wagmi to synchronize its state
      await new Promise((resolve) => setTimeout(resolve, isCI ? 3000 : 2000));

      // Check again if READONLY is gone
      const stillReadonly = await page.locator('text=READONLY').isVisible({ timeout: 1000 }).catch(() => false);
      if (!stillReadonly) {
        console.log('[ensureWalletConnected] Wallet connected after waiting');
        return true;
      }

      // If still in READONLY and this is the last attempt, try a page reload
      // The reload will trigger wagmi to re-initialize and potentially auto-reconnect
      if (attempt === maxAttempts - 1) {
        console.log('[ensureWalletConnected] Last attempt: reloading page for fresh initialization');
        try {
          await page.reload();
          await page.waitForLoadState('domcontentloaded');
          await new Promise((resolve) => setTimeout(resolve, isCI ? 3000 : 1500));
        } catch {
          // Reload might fail if page is closed
        }
      }
    }
  }

  console.error('[ensureWalletConnected] Failed to connect after all attempts');
  return false;
}

/**
 * Switch MetaMask to a different account and ensure network is correct.
 * IMPORTANT: After switching accounts in MetaMask, the network may revert to a different network.
 * This function ensures we switch back to Anvil after the account switch.
 * Also adds a stabilization delay to let MetaMask fully settle.
 */
export async function switchAccount(metamask: MetaMask, accountName: string): Promise<void> {
  const isCI = process.env.CI === 'true';

  // Synpress switchAccount handles waiting for completion internally
  await metamask.switchAccount(accountName);

  // Delay to let MetaMask process the account switch
  // Increased for CI with multiple workers to handle higher load
  await new Promise((resolve) => setTimeout(resolve, isCI ? 2000 : 500));

  // After switching accounts, MetaMask may switch to a different network
  // Ensure we're still on Anvil network
  try {
    await metamask.switchNetwork('Anvil', true);
    console.log(`[switchAccount] Switched to ${accountName} and verified Anvil network`);
  } catch (e) {
    // Network might already be correct, or might need to be added
    console.log(`[switchAccount] Network switch note:`, (e as Error).message);
    // Try adding and switching to Anvil if switch failed
    try {
      await metamask.addNetwork(ANVIL_NETWORK);
      console.log(`[switchAccount] Added and switched to Anvil network`);
    } catch {
      // Network likely already exists and is selected
    }
  }

  // Additional stabilization delay after network operations
  // This helps prevent MetaMask from being in a transitional state
  // Increased for parallel execution with multiple workers
  await new Promise((resolve) => setTimeout(resolve, isCI ? 2500 : 1000));
}

/**
 * Prepare page for interaction by dismissing any blocking elements.
 * Call this before any click action to ensure popovers are dismissed.
 */
export async function prepareForInteraction(page: any): Promise<void> {
  // Set localStorage first to prevent welcome modal
  try {
    await page.evaluate(() => {
      localStorage.setItem('blockparty_welcome_seen', 'true');
    });
  } catch {
    // localStorage might not be accessible
  }

  try {
    // Dismiss any welcome modals
    await dismissWelcomeModal(page);
    // Dismiss any RainbowKit popovers
    await dismissRainbowKitPopovers(page);
  } catch {
    // Ignore errors during preparation
  }
}

/**
 * Ensure page is ready for interaction - dismisses modals and waits for stability.
 * Use this before any critical action that might be blocked by modals.
 * IMPORTANT: This function brings the page to front to ensure it has focus.
 */
export async function ensurePageReady(page: any): Promise<void> {
  // Check if page is valid first
  try {
    if (page.isClosed()) {
      console.log('[ensurePageReady] Page is closed, cannot proceed');
      return;
    }
  } catch {
    return;
  }

  // Bring page to front to ensure it has focus
  try {
    await page.bringToFront();
  } catch {
    // Page might not support bringToFront
  }

  // Set localStorage to prevent welcome modal
  try {
    await page.evaluate(() => {
      localStorage.setItem('blockparty_welcome_seen', 'true');
    });
  } catch {
    // Ignore errors
  }

  // Wait a moment for any async modals to appear
  try {
    await page.waitForTimeout(200);
  } catch {
    return;
  }

  // Dismiss any modals that might be blocking
  await dismissWelcomeModal(page);
  await dismissRainbowKitPopovers(page);
}

/**
 * Stabilize the browser context before starting a complex test.
 * Call this at the start of tests that involve multiple account switches
 * or that run late in the test suite (where state accumulation can cause issues).
 *
 * In CI, this function adds extra delays and cleanup to help the browser
 * recover from previous tests.
 */
export async function stabilizeForComplexTest(context: any): Promise<void> {
  const isCI = process.env.CI === 'true';

  if (!isCI) {
    // No extra stabilization needed locally
    return;
  }

  console.log('[stabilizeForComplexTest] Starting CI stabilization...');

  // Check context health
  const healthy = await isContextHealthy(context);
  if (!healthy) {
    console.error('[stabilizeForComplexTest] Context is not healthy!');
    throw new Error('Browser context is corrupted before test start');
  }

  // Add initial delay to let the browser recover from previous tests
  // This is critical in CI where resources may be constrained
  await new Promise((resolve) => setTimeout(resolve, 2000));

  // Try to close any stale MetaMask notification pages that might be lingering
  try {
    const pages = context.pages();
    let closedCount = 0;
    for (const p of pages) {
      try {
        const url = p.url();
        // Close any MetaMask popup pages (notification or confirmation)
        if (url.includes('notification.html') || url.includes('popup.html')) {
          console.log('[stabilizeForComplexTest] Closing stale MetaMask page:', url);
          await p.close().catch(() => {});
          closedCount++;
        }
      } catch {
        // Page might be closed already
      }
    }
    if (closedCount > 0) {
      // Wait for pages to fully close
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  } catch {
    // Context issue, continue anyway
  }

  // Find and focus the app page to ensure it's ready
  try {
    const pages = context.pages();
    for (const p of pages) {
      try {
        const url = p.url();
        if (url.includes('localhost:3000')) {
          console.log('[stabilizeForComplexTest] Bringing app page to front');
          await p.bringToFront();
          // Wait for page to be fully focused
          await new Promise((resolve) => setTimeout(resolve, 500));
          break;
        }
      } catch {
        // Page might be invalid
      }
    }
  } catch {
    // Continue anyway
  }

  console.log('[stabilizeForComplexTest] Stabilization complete');
}

/**
 * All Anvil pre-funded accounts (from seed phrase: "test test test test test test test test test test test junk")
 * Each account has 10000 ETH on Anvil.
 * MetaMask names match the wallet-setup: "Account 1" (default), "User2", "Admin3", etc.
 */
export const ALL_ANVIL_ACCOUNTS = [
  { address: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266', privateKey: '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80', metamaskName: 'Account 1' },
  { address: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8', privateKey: '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d', metamaskName: 'User2' },
  { address: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC', privateKey: '0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a', metamaskName: 'Admin3' },
  { address: '0x90F79bf6EB2c4f870365E785982E1f101E93b906', privateKey: '0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6', metamaskName: 'User4' },
  { address: '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65', privateKey: '0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a', metamaskName: 'Admin5' },
  { address: '0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc', privateKey: '0x8b3a350cf5c34c9194ca85829a2df0ec3153be0318b5e2d3348e872092edffba', metamaskName: 'User6' },
  { address: '0x976EA74026E726554dB657fA54763abd0C3a0aa9', privateKey: '0x92db14e403b83dfe3df233f83dfa3a0d7096f21ca9b0d6d6b8d88b2b4ec1564e', metamaskName: 'Admin7' },
  { address: '0x14dC79964da2C08b23698B3D3cc7Ca32193d9955', privateKey: '0x4bbbf85ce3377467afe5d46f804f221813b2bb87f24d81f60f1fcdbf7cbf4356', metamaskName: 'User8' },
  { address: '0x23618e81E3f5cdF7f54C3d65f7FBc0aBf5B21E8f', privateKey: '0xdbda1821b80551c9d65939329250298aa3472ba22feea921c0cf5d620ea67b97', metamaskName: 'Admin9' },
  { address: '0xa0Ee7A142d267C1f36714E4a8F75612F20a79720', privateKey: '0x2a871d0798f97d79848a013d4936a73bf4cc922c825d33c1cf7073dff6d409c6', metamaskName: 'User10' },
] as const;

/**
 * Get accounts for a test based on its parallel worker index.
 * Each worker gets a dedicated pair of accounts to prevent nonce conflicts.
 *
 * With 4 workers and 10 accounts:
 * - Worker 0: accounts 0,1 (Account 1, User2)
 * - Worker 1: accounts 2,3 (Admin3, User4)
 * - Worker 2: accounts 4,5 (Admin5, User6)
 * - Worker 3: accounts 6,7 (Admin7, User8)
 *
 * This ensures no two workers can use the same account simultaneously,
 * preventing nonce conflicts when deploying contracts in parallel.
 *
 * @param parallelIndex - The worker index from test.info().parallelIndex
 * @returns Object with admin and user accounts for this worker
 */
export function getWorkerAccounts(parallelIndex: number) {
  // With 4 workers and 10 accounts, each worker gets 2 dedicated accounts
  // Use modulo to handle cases with more workers than pairs
  const pairIndex = parallelIndex % 5;
  const adminIndex = pairIndex * 2;
  const userIndex = pairIndex * 2 + 1;

  return {
    admin: ALL_ANVIL_ACCOUNTS[adminIndex],
    user: ALL_ANVIL_ACCOUNTS[userIndex],
    // deployer is same as admin for most tests
    deployer: ALL_ANVIL_ACCOUNTS[adminIndex],
  };
}

/**
 * Suite-specific account assignments for parallel test execution.
 * Each suite gets dedicated accounts to avoid nonce conflicts when running in parallel.
 *
 * NOTE: With fullyParallel: true, tests may run on any worker with any MetaMask instance.
 * Each worker has its own MetaMask, so the same account names can be used safely.
 * These assignments provide consistent defaults for tests that use them.
 */
export const SUITE_ACCOUNTS = {
  createEvent: {
    deployer: ALL_ANVIL_ACCOUNTS[0], // Account 1
  },
  registration: {
    deployer: ALL_ANVIL_ACCOUNTS[2], // Admin3
    user: ALL_ANVIL_ACCOUNTS[3],     // User4
  },
  attendance: {
    admin: ALL_ANVIL_ACCOUNTS[4],    // Admin5
    user: ALL_ANVIL_ACCOUNTS[5],     // User6
  },
  withdrawal: {
    admin: ALL_ANVIL_ACCOUNTS[6],    // Admin7
    user: ALL_ANVIL_ACCOUNTS[7],     // User8
  },
} as const;

/**
 * Deploy a fresh Conference contract for isolated test suites.
 * This allows each test suite to have its own contract instance.
 *
 * @param options - Contract deployment options
 * @returns The deployed contract address
 */
export async function deployTestEvent(options: {
  name?: string;
  deposit?: string;
  maxParticipants?: number;
  coolingPeriod?: number;
  deployerPrivateKey: string;
}): Promise<string> {
  const {
    name = 'Test Event',
    deposit = '0.02',
    maxParticipants = 20,
    coolingPeriod = 604800,
    deployerPrivateKey,
  } = options;

  console.log(`[deployTestEvent] Starting deployment for "${name}"`);

  // Dynamic import for ethers (ESM module)
  const { ethers } = await import('ethers');
  console.log('[deployTestEvent] Ethers imported');

  // Connect to Anvil with explicit timeout
  const anvilUrl = E2E_STATE.anvilUrl || 'http://localhost:8545';
  console.log(`[deployTestEvent] Connecting to Anvil at ${anvilUrl}`);

  // Try to verify Anvil is responsive using fetch (faster and more reliable than ethers)
  const isCI = process.env.CI === 'true';
  // Always retry multiple times - Anvil can become temporarily unresponsive after many tests
  const maxAnvilRetries = isCI ? 5 : 3;
  const fetchTimeout = isCI ? 20000 : 15000;
  let anvilResponsive = false;

  for (let retry = 0; retry < maxAnvilRetries; retry++) {
    try {
      const response = await Promise.race([
        fetch(anvilUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'eth_blockNumber',
            params: [],
            id: 1,
          }),
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Anvil fetch timeout')), fetchTimeout)),
      ]) as Response;

      const result = await response.json();
      if (result.result) {
        const blockNumber = parseInt(result.result, 16);
        console.log(`[deployTestEvent] Anvil responsive via fetch, block number: ${blockNumber}`);
        anvilResponsive = true;
        break;
      }
    } catch (e) {
      console.warn(`[deployTestEvent] Anvil health check failed (attempt ${retry + 1}/${maxAnvilRetries}):`, (e as Error).message);
      if (retry < maxAnvilRetries - 1) {
        // Longer wait to let Anvil recover - increase with each retry
        const waitTime = 5000 + (retry * 2000);
        console.log(`[deployTestEvent] Waiting ${waitTime}ms before retry...`);
        await new Promise((resolve) => setTimeout(resolve, waitTime));
      }
    }
  }

  if (!anvilResponsive) {
    console.error('[deployTestEvent] Anvil is not responding after all retries');
    // Run detailed diagnostics before failing
    const diagnostics = await runDiagnostics(undefined, 'ANVIL FAILURE DIAGNOSTICS');
    console.error('[deployTestEvent] Diagnostic summary:', JSON.stringify(diagnostics, null, 2));
    throw new Error('Anvil blockchain not responding - tests cannot continue');
  }

  const provider = new ethers.JsonRpcProvider(anvilUrl, undefined, {
    cacheTimeout: -1,
  });

  const wallet = new ethers.Wallet(deployerPrivateKey, provider);
  console.log(`[deployTestEvent] Wallet created for address: ${wallet.address}`);

  // Load the compiled contract artifact
  const artifactPath = path.join(__dirname, '../../../out/Conference.sol/Conference.json');
  const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf-8'));
  const abi = artifact.abi;
  const bytecode = artifact.bytecode.object;

  // Deploy contract with timeout
  console.log('[deployTestEvent] Deploying contract...');
  const factory = new ethers.ContractFactory(abi, bytecode, wallet);
  const contract = await factory.deploy(
    name,
    ethers.parseEther(deposit),
    maxParticipants,
    coolingPeriod,
    '' // metadataUri
  );

  console.log('[deployTestEvent] Waiting for deployment...');
  await contract.waitForDeployment();
  const contractAddress = await contract.getAddress();

  console.log(`[Test Setup] Deployed Conference "${name}" at: ${contractAddress}`);
  return contractAddress;
}

/**
 * Inject E2E configuration with a specific contract address.
 * Used for test suites that deploy their own contracts.
 * Also sets localStorage to prevent the welcome modal from appearing.
 */
export async function injectE2EConfigWithContract(page: any, contractAddress: string): Promise<void> {
  await page.addInitScript(
    (config: { contractAddress: string; factoryAddress: string; chainId: number }) => {
      (window as any).__E2E_CONFIG__ = config;
      // Prevent welcome modal from appearing during E2E tests
      try {
        localStorage.setItem('blockparty_welcome_seen', 'true');
      } catch {
        // localStorage may not be available
      }
    },
    {
      contractAddress,
      factoryAddress: E2E_STATE.factoryAddress,
      chainId: E2E_STATE.chainId,
    }
  );
}
