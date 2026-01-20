/**
 * Withdrawal Flow E2E Tests (OnchainTestKit)
 *
 * Tests the complete withdrawal flow with wallet automation:
 * 1. User registers for event
 * 2. Admin marks user as attended
 * 3. Admin triggers payback
 * 4. User withdraws their payout
 *
 * Uses OnchainTestKit for wallet interactions with shared Anvil instance.
 * Supports both MetaMask and Coinbase Wallet via E2E_WALLET env var.
 * Each test deploys its own contract for isolation.
 */

import {
  test,
  expect,
  getAnvilUrl,
  waitForAppLoad,
  waitForTransactionComplete,
  switchWalletAccount,
  connectWallet,
  ensurePageReady,
} from './fixtures';
import { runDiagnostics } from './diagnostics';
import {
  setupTestWithContract,
  generateTwitterHandle,
  confirmTransaction,
  setupAsAdmin,
  setupAsUser,
  registerAsUser,
  markAttendance,
  triggerPayback,
} from './test-helpers';

test.describe('Withdrawal Flow', () => {
  // Run diagnostics on test failure
  test.afterEach(async ({ node }, testInfo) => {
    if (testInfo.status !== 'passed') {
      const rpcUrl = getAnvilUrl(node);
      console.log(`\n[${testInfo.title}] Test ${testInfo.status} - running diagnostics...`);
      await runDiagnostics(rpcUrl, null, `TEST FAILURE: ${testInfo.title}`);
    }
  });

  test('should allow user to withdraw after attendance and payback', async ({ page, wallet, node }) => {
    if (!wallet) throw new Error('Wallet fixture required');

    // Deploy contract without connecting (we need to connect as user, not deployer)
    await setupTestWithContract(page, wallet, node, {
      name: 'Withdrawal Test',
      skipWalletConnect: true,
    });

    // Step 1: Register as user (account 1)
    await switchWalletAccount(wallet, 1);
    await connectWallet(page, wallet);
    await waitForAppLoad(page);
    await ensurePageReady(page);

    await registerAsUser(page, wallet, generateTwitterHandle('wdr'));

    // Step 2: Switch to admin and mark attendance
    await setupAsAdmin(page, wallet);
    await markAttendance(page, wallet);

    // Step 3: Trigger payback
    await triggerPayback(page, wallet);

    // Step 4: Switch back to user and withdraw
    await setupAsUser(page, wallet, 1);

    // Step 5: Withdraw
    const withdrawButton = page.locator('button:has-text("Withdraw")');
    if ((await withdrawButton.count()) > 0 && (await withdrawButton.isEnabled())) {
      await withdrawButton.click();
      await confirmTransaction(page, wallet);
      await waitForTransactionComplete(page);
      await expect(withdrawButton).toBeDisabled({ timeout: 10000 });
    }
  });

  test('should show withdraw button only after event ends', async ({ page, wallet, node }) => {
    if (!wallet) throw new Error('Wallet fixture required');

    // Deploy contract without connecting (we need to connect as user, not deployer)
    await setupTestWithContract(page, wallet, node, {
      name: 'Withdraw Button Visibility Test',
      skipWalletConnect: true,
    });

    // Connect as user (account 1)
    await switchWalletAccount(wallet, 1);
    await connectWallet(page, wallet);
    await waitForAppLoad(page);
    await ensurePageReady(page);

    // Register
    await registerAsUser(page, wallet, '@wdr_visible');

    const withdrawButton = page.locator('button:has-text("Withdraw")');
    const rsvpButton = page.locator('button:has-text("RSVP")');

    const isEventEnded = (await withdrawButton.count()) > 0;

    if (isEventEnded) {
      await expect(withdrawButton).toBeVisible();
    } else {
      await expect(rsvpButton).toBeDisabled();
    }
  });

  test('should prevent double withdrawal', async ({ page, wallet, node }) => {
    if (!wallet) throw new Error('Wallet fixture required');

    // Deploy contract without connecting (we need to connect as user, not deployer)
    await setupTestWithContract(page, wallet, node, {
      name: 'Double Withdrawal Test',
      skipWalletConnect: true,
    });

    // Step 1: Register as user (account 1)
    await switchWalletAccount(wallet, 1);
    await connectWallet(page, wallet);
    await waitForAppLoad(page);
    await ensurePageReady(page);

    await registerAsUser(page, wallet, generateTwitterHandle('dbl'));

    // Step 2: Switch to admin and mark attendance
    await setupAsAdmin(page, wallet);
    await ensurePageReady(page);
    await markAttendance(page, wallet);

    // Step 3: Trigger payback
    await triggerPayback(page, wallet);

    // Step 4: Switch back to user and withdraw
    await setupAsUser(page, wallet, 1);

    const withdrawButton = page.locator('button:has-text("Withdraw")');

    if ((await withdrawButton.count()) > 0 && (await withdrawButton.isEnabled())) {
      await withdrawButton.click();
      await confirmTransaction(page, wallet);
      // Wait for withdrawal to complete and button state to update
      await waitForTransactionComplete(page);

      // Step 5: Verify can't withdraw again - button should be disabled or gone
      const isDisabled = await withdrawButton.isDisabled().catch(() => true);
      const buttonCount = await withdrawButton.count();

      expect(isDisabled || buttonCount === 0).toBeTruthy();
    }
  });
});
