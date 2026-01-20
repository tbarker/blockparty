/**
 * E2E Test Helper Functions
 *
 * Consolidated helper functions to reduce code duplication across E2E tests.
 * These helpers abstract common patterns like:
 * - Test setup with contract deployment
 * - Transaction confirmation
 * - Account switching and reconnection
 * - Twitter handle generation
 */

import type { Page } from '@playwright/test';
import {
  deployTestEvent,
  deployFactory,
  injectE2EConfig,
  waitForAppLoad,
  waitForTransactionSuccess,
  switchWalletAccount,
  connectWallet,
  ensurePageReady,
  getAnvilUrl,
  ANVIL_ACCOUNTS,
  CHAIN_ID,
  BaseActionType,
  ActionApprovalType,
  Wallet,
} from './fixtures';

const APP_URL = 'http://localhost:3000/';

/**
 * Generate a unique Twitter handle with prefix.
 * Ensures handles stay within Twitter's 15-character limit (after @).
 *
 * @param prefix - Short prefix for the handle (default: 'e2e')
 * @returns A unique Twitter handle like @e2e123456
 */
export function generateTwitterHandle(prefix = 'e2e'): string {
  return `@${prefix}${String(Date.now()).slice(-6)}`;
}

/**
 * Deploy contract and setup page for testing.
 * Combines the common setup pattern used in almost every test.
 *
 * @param page - Playwright page
 * @param wallet - Wallet instance from OnchainTestKit
 * @param node - Node fixture with port information
 * @param options - Optional configuration for deployment
 * @returns Contract address and RPC URL
 */
export async function setupTestWithContract(
  page: Page,
  wallet: Wallet,
  node: { port?: number } | null,
  options?: {
    name?: string;
    deposit?: string;
    maxParticipants?: number;
    accountIndex?: number;
    skipWalletConnect?: boolean;
  }
): Promise<{ contractAddress: string; rpcUrl: string }> {
  const rpcUrl = getAnvilUrl(node);

  const contractAddress = await deployTestEvent({
    name: options?.name || 'Test Event',
    deposit: options?.deposit || '0.02',
    maxParticipants: options?.maxParticipants || 20,
    privateKey: ANVIL_ACCOUNTS.deployer.privateKey,
    rpcUrl,
  });

  await injectE2EConfig(page, { contractAddress, chainId: CHAIN_ID });
  await page.goto(APP_URL);

  if (!options?.skipWalletConnect) {
    await connectWallet(page, wallet, { accountIndex: options?.accountIndex ?? 0 });
    await waitForAppLoad(page);
  }

  return { contractAddress, rpcUrl };
}

/**
 * Deploy factory contract and setup page for testing.
 * Used for create-event tests that need the ConferenceFactory.
 *
 * @param page - Playwright page
 * @param wallet - Wallet instance from OnchainTestKit
 * @param node - Node fixture with port information
 * @param options - Optional configuration
 * @returns Factory address and RPC URL
 */
export async function setupTestWithFactory(
  page: Page,
  wallet: Wallet,
  node: { port?: number } | null,
  options?: {
    accountIndex?: number;
    waitForAppLoad?: boolean;
  }
): Promise<{ factoryAddress: string; rpcUrl: string }> {
  const rpcUrl = getAnvilUrl(node);

  const factoryAddress = await deployFactory({
    privateKey: ANVIL_ACCOUNTS.deployer.privateKey,
    rpcUrl,
  });

  await injectE2EConfig(page, { factoryAddress, chainId: CHAIN_ID });
  await page.goto(APP_URL);

  await connectWallet(page, wallet, { accountIndex: options?.accountIndex ?? 0 });

  if (options?.waitForAppLoad !== false) {
    await waitForAppLoad(page);
  }

  return { factoryAddress, rpcUrl };
}

/**
 * Confirm transaction and wait for success.
 * Combines the common pattern of approving a transaction and waiting for confirmation.
 *
 * @param page - Playwright page
 * @param wallet - Wallet instance from OnchainTestKit
 * @param timeout - Optional timeout for waiting (default: 60000ms)
 */
export async function confirmTransaction(
  page: Page,
  wallet: Wallet,
  timeout?: number
): Promise<void> {
  await wallet.handleAction(BaseActionType.HANDLE_TRANSACTION, {
    approvalType: ActionApprovalType.APPROVE,
  });
  await waitForTransactionSuccess(page, timeout);
}

/**
 * Switch wallet account and reconnect to the app.
 * Handles the full flow of switching accounts, reloading, and reconnecting.
 *
 * @param page - Playwright page
 * @param wallet - Wallet instance from OnchainTestKit
 * @param accountIndex - Account index to switch to (0 = deployer, 1+ = users)
 */
export async function switchAccountAndReconnect(
  page: Page,
  wallet: Wallet,
  accountIndex: number
): Promise<void> {
  await switchWalletAccount(wallet, accountIndex);
  await page.reload();
  await connectWallet(page, wallet);
  await waitForAppLoad(page);
}

/**
 * Setup context as admin (deployer account).
 * Switches to account 0 and reconnects.
 *
 * @param page - Playwright page
 * @param wallet - Wallet instance from OnchainTestKit
 */
export async function setupAsAdmin(page: Page, wallet: Wallet): Promise<void> {
  await switchAccountAndReconnect(page, wallet, 0);
}

/**
 * Setup context as a regular user.
 * Switches to the specified user account (1-based) and reconnects.
 *
 * @param page - Playwright page
 * @param wallet - Wallet instance from OnchainTestKit
 * @param userIndex - User index (1-4), defaults to 1
 */
export async function setupAsUser(
  page: Page,
  wallet: Wallet,
  userIndex = 1
): Promise<void> {
  await switchAccountAndReconnect(page, wallet, userIndex);
}

/**
 * Register as the current user with a Twitter handle.
 * Fills in the Twitter handle, clicks RSVP, and confirms the transaction.
 *
 * @param page - Playwright page
 * @param wallet - Wallet instance from OnchainTestKit
 * @param twitterHandle - Optional Twitter handle (auto-generated if not provided)
 */
export async function registerAsUser(
  page: Page,
  wallet: Wallet,
  twitterHandle?: string
): Promise<string> {
  const handle = twitterHandle || generateTwitterHandle();

  const twitterInput = page.locator('input[placeholder*="twitter"]');
  await twitterInput.waitFor({ state: 'visible', timeout: 30000 });
  await twitterInput.fill(handle);

  const rsvpButton = page.locator('button:has-text("RSVP")');
  await rsvpButton.waitFor({ state: 'visible', timeout: 10000 });
  await rsvpButton.click();

  await confirmTransaction(page, wallet);

  return handle;
}

/**
 * Admin marks attendance for users with unchecked checkboxes.
 * Checks the first unchecked checkbox and confirms the attend transaction.
 *
 * @param page - Playwright page
 * @param wallet - Wallet instance from OnchainTestKit
 * @returns true if attendance was marked, false if no unchecked users found
 */
export async function markAttendance(
  page: Page,
  wallet: Wallet
): Promise<boolean> {
  const attendCheckbox = page.locator('input[type="checkbox"]').first();

  if ((await attendCheckbox.count()) === 0) {
    return false;
  }

  if (await attendCheckbox.isChecked()) {
    return false;
  }

  await attendCheckbox.check();

  const attendButton = page.locator('button:has-text("Attend")');
  if ((await attendButton.count()) === 0 || !(await attendButton.isEnabled())) {
    return false;
  }

  await attendButton.click();
  await confirmTransaction(page, wallet);

  return true;
}

/**
 * Admin triggers payback for the event.
 *
 * @param page - Playwright page
 * @param wallet - Wallet instance from OnchainTestKit
 * @returns true if payback was triggered, false if button not available
 */
export async function triggerPayback(
  page: Page,
  wallet: Wallet
): Promise<boolean> {
  const paybackButton = page.locator('button:has-text("Payback")');

  if ((await paybackButton.count()) === 0 || !(await paybackButton.isEnabled())) {
    return false;
  }

  await paybackButton.click();
  await confirmTransaction(page, wallet);

  return true;
}

/**
 * User withdraws their payout.
 *
 * @param page - Playwright page
 * @param wallet - Wallet instance from OnchainTestKit
 * @returns true if withdrawal was successful, false if button not available
 */
export async function withdrawPayout(
  page: Page,
  wallet: Wallet
): Promise<boolean> {
  const withdrawButton = page.locator('button:has-text("Withdraw")');

  if ((await withdrawButton.count()) === 0 || !(await withdrawButton.isEnabled())) {
    return false;
  }

  await withdrawButton.click();
  await confirmTransaction(page, wallet);

  return true;
}

/**
 * Setup a user, register them, then switch back to admin.
 * Useful for tests that need a registered participant but operate as admin.
 *
 * @param page - Playwright page
 * @param wallet - Wallet instance from OnchainTestKit
 * @param handlePrefix - Optional prefix for the Twitter handle
 * @returns The Twitter handle used for registration
 */
export async function registerUserThenSwitchToAdmin(
  page: Page,
  wallet: Wallet,
  handlePrefix = 'usr'
): Promise<string> {
  // Switch to user account and register
  await switchWalletAccount(wallet, 1);
  await connectWallet(page, wallet);
  await waitForAppLoad(page);

  const handle = await registerAsUser(page, wallet, generateTwitterHandle(handlePrefix));

  // Switch back to admin
  await setupAsAdmin(page, wallet);

  return handle;
}

/**
 * Full flow: Register user, mark attendance, trigger payback.
 * Sets up the state needed for withdrawal tests.
 *
 * @param page - Playwright page
 * @param wallet - Wallet instance from OnchainTestKit
 * @param handlePrefix - Optional prefix for the Twitter handle
 */
export async function setupForWithdrawal(
  page: Page,
  wallet: Wallet,
  handlePrefix = 'wdr'
): Promise<void> {
  // Register as user
  await switchWalletAccount(wallet, 1);
  await connectWallet(page, wallet);
  await page.reload();
  await connectWallet(page, wallet);
  await waitForAppLoad(page);
  await ensurePageReady(page);

  await registerAsUser(page, wallet, generateTwitterHandle(handlePrefix));

  // Switch to admin and mark attendance
  await setupAsAdmin(page, wallet);
  await markAttendance(page, wallet);

  // Trigger payback
  await triggerPayback(page, wallet);
}
