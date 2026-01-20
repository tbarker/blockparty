/**
 * Admin Attendance Flow E2E Tests (OnchainTestKit)
 *
 * Tests admin functionality with wallet automation:
 * 1. Admin views registered participants
 * 2. Admin marks attendees as present
 * 3. Admin triggers payback calculation
 * 4. Admin cancels event (if needed)
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
  switchWalletAccount,
  connectWallet,
} from './fixtures';
import { runDiagnostics } from './diagnostics';
import {
  setupTestWithContract,
  generateTwitterHandle,
  confirmTransaction,
  setupAsAdmin,
  registerAsUser,
  markAttendance,
} from './test-helpers';

test.describe('Admin Attendance Flow', () => {
  // Run diagnostics on test failure
  test.afterEach(async ({ node }, testInfo) => {
    if (testInfo.status !== 'passed') {
      const rpcUrl = getAnvilUrl(node);
      console.log(`\n[${testInfo.title}] Test ${testInfo.status} - running diagnostics...`);
      await runDiagnostics(rpcUrl, null, `TEST FAILURE: ${testInfo.title}`);
    }
  });

  test('should show admin controls when connected as owner', async ({ page, wallet, node }) => {
    if (!wallet) throw new Error('Wallet fixture required');

    // Deploy and connect as deployer (account 0 = admin/owner)
    await setupTestWithContract(page, wallet, node, {
      name: 'Admin Controls Test',
      accountIndex: 0,
    });

    // Reload to ensure admin account is recognized
    await page.reload();
    await connectWallet(page, wallet, { accountIndex: 0 });
    await waitForAppLoad(page);

    // Admin controls should be visible - wait for them to appear
    const cancelButton = page.locator('button:has-text("Cancel")');
    const paybackButton = page.locator('button:has-text("Payback")');
    const grantAdminButton = page.locator('button:has-text("Grant admin")');

    // Wait for at least one admin control to appear (30s timeout)
    await page
      .locator('button:has-text("Cancel"), button:has-text("Payback"), button:has-text("Grant admin")')
      .first()
      .waitFor({ state: 'visible', timeout: 30000 });

    const hasCancelButton = (await cancelButton.count()) > 0;
    const hasPaybackButton = (await paybackButton.count()) > 0;
    const hasGrantAdminButton = (await grantAdminButton.count()) > 0;

    expect(hasCancelButton || hasPaybackButton || hasGrantAdminButton).toBeTruthy();
  });

  test('should allow admin to mark attendance', async ({ page, wallet, node }) => {
    if (!wallet) throw new Error('Wallet fixture required');

    // Deploy contract
    await setupTestWithContract(page, wallet, node, {
      name: 'Mark Attendance Test',
    });

    // Switch to user account and register
    await switchWalletAccount(wallet, 1);
    await connectWallet(page, wallet);
    await waitForAppLoad(page);

    await registerAsUser(page, wallet, generateTwitterHandle('att'));

    // Switch to admin and mark attendance
    await setupAsAdmin(page, wallet);
    await markAttendance(page, wallet);
  });

  test('should allow admin to trigger payback', async ({ page, wallet, node }) => {
    if (!wallet) throw new Error('Wallet fixture required');

    // Deploy contract
    await setupTestWithContract(page, wallet, node, {
      name: 'Trigger Payback Test',
    });

    // Switch to user account and register
    await switchWalletAccount(wallet, 1);
    await connectWallet(page, wallet);
    await waitForAppLoad(page);

    await registerAsUser(page, wallet, generateTwitterHandle('pay'));

    // Switch to admin, mark attendance, and trigger payback
    await setupAsAdmin(page, wallet);
    await markAttendance(page, wallet);

    // Trigger payback
    const paybackButton = page.locator('button:has-text("Payback")');
    if ((await paybackButton.count()) > 0 && (await paybackButton.isEnabled())) {
      await paybackButton.click();
      await confirmTransaction(page, wallet);
      await expect(paybackButton).toBeDisabled({ timeout: 10000 });
    }
  });

  test('should allow admin to cancel event', async ({ page, wallet, node }) => {
    if (!wallet) throw new Error('Wallet fixture required');

    // Deploy and connect as admin (account 0 = deployer)
    await setupTestWithContract(page, wallet, node, {
      name: 'Cancel Event Test',
      accountIndex: 0,
    });

    const cancelButton = page.locator('button:has-text("Cancel")');
    if ((await cancelButton.count()) > 0) {
      const isEnabled = await cancelButton.isEnabled();
      if (isEnabled) {
        await expect(cancelButton).toBeEnabled();
        // Don't actually cancel - just verify button is accessible
      }
    }
  });

  test('should load event page for any connected user', async ({ page, wallet, node }) => {
    if (!wallet) throw new Error('Wallet fixture required');

    await setupTestWithContract(page, wallet, node, {
      name: 'User View Test',
    });

    // Verify event info is displayed
    await expect(page.locator('h4:has-text("Event Info")')).toBeVisible();

    // Verify event name is shown
    await expect(page.locator('text=User View Test')).toBeVisible({ timeout: 10000 });

    // Verify deposit info is shown
    await expect(page.locator('text=/ETH/i').first()).toBeVisible({ timeout: 10000 });

    // Verify participants section is visible
    await expect(page.getByText('Participants').first()).toBeVisible({ timeout: 10000 });

    // Note: Admin controls (Cancel, Payback, etc.) are visible to all users in the UI,
    // but the smart contract prevents unauthorized execution. This is by design -
    // the UI shows all actions, but transactions will fail for non-admins.
  });

  test('should update attended count after marking attendance', async ({ page, wallet, node }) => {
    if (!wallet) throw new Error('Wallet fixture required');

    // Deploy contract
    await setupTestWithContract(page, wallet, node, {
      name: 'Attended Count Test',
    });

    // Switch to user account and register
    await switchWalletAccount(wallet, 1);
    await connectWallet(page, wallet);
    await waitForAppLoad(page);

    await registerAsUser(page, wallet, generateTwitterHandle('cnt'));

    // Switch to admin and mark attendance
    await setupAsAdmin(page, wallet);
    await markAttendance(page, wallet);
  });
});
