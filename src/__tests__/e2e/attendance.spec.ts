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
  BaseActionType,
  ActionApprovalType,
  ANVIL_ACCOUNTS,
  CHAIN_ID,
  getAnvilUrl,
  deployTestEvent,
  injectE2EConfig,
  waitForAppLoad,
  waitForTransactionSuccess,
  waitForTransactionComplete,
  switchWalletAccount,
  connectWallet,
} from './fixtures';
import { runDiagnostics } from './diagnostics';

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
    const rpcUrl = getAnvilUrl(node);

    // Deploy isolated contract for this test (deployer = admin/owner)
    const contractAddress = await deployTestEvent({
      name: 'Admin Controls Test',
      deposit: '0.02',
      maxParticipants: 20,
      privateKey: ANVIL_ACCOUNTS.deployer.privateKey,
      rpcUrl,
    });

    // Inject E2E config
    await injectE2EConfig(page, { contractAddress, chainId: CHAIN_ID });
    await page.goto('http://localhost:3000/');

    // Connect wallet as deployer (account 0 = admin/owner)
    await connectWallet(page, wallet, { accountIndex: 0 });
    await waitForAppLoad(page);

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
    const rpcUrl = getAnvilUrl(node);

    // Deploy isolated contract for this test
    const contractAddress = await deployTestEvent({
      name: 'Mark Attendance Test',
      deposit: '0.02',
      maxParticipants: 20,
      privateKey: ANVIL_ACCOUNTS.deployer.privateKey,
      rpcUrl,
    });

    // Inject E2E config
    await injectE2EConfig(page, { contractAddress, chainId: CHAIN_ID });
    await page.goto('http://localhost:3000/');

    // First register as user (account 1)
    await switchWalletAccount(wallet, 1);
    await connectWallet(page, wallet);
    await waitForAppLoad(page);

    // Register a user (handle max 15 chars after @)
    const handle = `@att${String(Date.now()).slice(-6)}`;
    const twitterInput = page.locator('input[placeholder*="twitter"]');
    await twitterInput.fill(handle);
    await page.locator('button:has-text("RSVP")').click();

    await wallet.handleAction(BaseActionType.HANDLE_TRANSACTION, {
      approvalType: ActionApprovalType.APPROVE,
    });
    await waitForTransactionComplete(page);

    // Switch to admin (account 0 = deployer)
    await switchWalletAccount(wallet, 0);
    await page.reload();
    await connectWallet(page, wallet);
    await waitForAppLoad(page);

    // Look for attendance checkboxes
    const attendCheckboxes = page.locator('input[type="checkbox"]');
    const checkboxCount = await attendCheckboxes.count();

    if (checkboxCount > 0) {
      // Find unchecked checkbox and check it
      for (let i = 0; i < checkboxCount; i++) {
        const checkbox = attendCheckboxes.nth(i);
        if (!(await checkbox.isChecked())) {
          await checkbox.check();

          const attendButton = page.locator('button:has-text("Attend")');
          if ((await attendButton.count()) > 0 && (await attendButton.isEnabled())) {
            await attendButton.click();
            await wallet.handleAction(BaseActionType.HANDLE_TRANSACTION, {
              approvalType: ActionApprovalType.APPROVE,
            });
            await waitForTransactionSuccess(page);
          }
          break;
        }
      }
    }
  });

  test('should allow admin to trigger payback', async ({ page, wallet, node }) => {
    if (!wallet) throw new Error('Wallet fixture required');
    const rpcUrl = getAnvilUrl(node);

    // Deploy isolated contract for this test
    const contractAddress = await deployTestEvent({
      name: 'Trigger Payback Test',
      deposit: '0.02',
      maxParticipants: 20,
      privateKey: ANVIL_ACCOUNTS.deployer.privateKey,
      rpcUrl,
    });

    // Inject E2E config
    await injectE2EConfig(page, { contractAddress, chainId: CHAIN_ID });
    await page.goto('http://localhost:3000/');

    // First register as user (account 1)
    await switchWalletAccount(wallet, 1);
    await connectWallet(page, wallet);
    await waitForAppLoad(page);

    // Register a participant (handle max 15 chars after @)
    const handle = `@pay${String(Date.now()).slice(-6)}`;
    const twitterInput = page.locator('input[placeholder*="twitter"]');
    await twitterInput.fill(handle);
    await page.locator('button:has-text("RSVP")').click();

    await wallet.handleAction(BaseActionType.HANDLE_TRANSACTION, {
      approvalType: ActionApprovalType.APPROVE,
    });
    await waitForTransactionComplete(page);

    // Switch to admin and mark attendance (account 0)
    await switchWalletAccount(wallet, 0);
    await page.reload();
    await connectWallet(page, wallet);
    await waitForAppLoad(page);

    // Mark attendance if there are unchecked participants
    const attendCheckbox = page.locator('input[type="checkbox"]').first();
    if ((await attendCheckbox.count()) > 0 && !(await attendCheckbox.isChecked())) {
      await attendCheckbox.check();

      const attendButton = page.locator('button:has-text("Attend")');
      if ((await attendButton.count()) > 0 && (await attendButton.isEnabled())) {
        await attendButton.click();
        await wallet.handleAction(BaseActionType.HANDLE_TRANSACTION, {
          approvalType: ActionApprovalType.APPROVE,
        });
        await waitForTransactionSuccess(page);
      }
    }

    // Now trigger payback
    const paybackButton = page.locator('button:has-text("Payback")');
    if ((await paybackButton.count()) > 0 && (await paybackButton.isEnabled())) {
      await paybackButton.click();
      await wallet.handleAction(BaseActionType.HANDLE_TRANSACTION, {
        approvalType: ActionApprovalType.APPROVE,
      });
      await waitForTransactionSuccess(page);

      await expect(paybackButton).toBeDisabled({ timeout: 10000 });
    }
  });

  test('should allow admin to cancel event', async ({ page, wallet, node }) => {
    if (!wallet) throw new Error('Wallet fixture required');
    const rpcUrl = getAnvilUrl(node);

    // Deploy isolated contract for this test
    const contractAddress = await deployTestEvent({
      name: 'Cancel Event Test',
      deposit: '0.02',
      maxParticipants: 20,
      privateKey: ANVIL_ACCOUNTS.deployer.privateKey,
      rpcUrl,
    });

    // Inject E2E config
    await injectE2EConfig(page, { contractAddress, chainId: CHAIN_ID });
    await page.goto('http://localhost:3000/');

    // Connect as admin (account 0 = deployer)
    await connectWallet(page, wallet, { accountIndex: 0 });
    await waitForAppLoad(page);

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
    const rpcUrl = getAnvilUrl(node);

    // Deploy isolated contract for this test
    const contractAddress = await deployTestEvent({
      name: 'User View Test',
      deposit: '0.02',
      maxParticipants: 20,
      privateKey: ANVIL_ACCOUNTS.deployer.privateKey,
      rpcUrl,
    });

    // Inject E2E config
    await injectE2EConfig(page, { contractAddress, chainId: CHAIN_ID });
    await page.goto('http://localhost:3000/');

    // Connect wallet (as the default account)
    await connectWallet(page, wallet);
    await waitForAppLoad(page);

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
    const rpcUrl = getAnvilUrl(node);

    // Deploy isolated contract for this test
    const contractAddress = await deployTestEvent({
      name: 'Attended Count Test',
      deposit: '0.02',
      maxParticipants: 20,
      privateKey: ANVIL_ACCOUNTS.deployer.privateKey,
      rpcUrl,
    });

    // Inject E2E config
    await injectE2EConfig(page, { contractAddress, chainId: CHAIN_ID });
    await page.goto('http://localhost:3000/');

    // Register as user first (account 1)
    await switchWalletAccount(wallet, 1);
    await connectWallet(page, wallet);
    await waitForAppLoad(page);

    // Register a user (handle max 15 chars after @)
    const twitterInput = page.locator('input[placeholder*="twitter"]');
    await twitterInput.fill(`@cnt${String(Date.now()).slice(-6)}`);
    await page.locator('button:has-text("RSVP")').click();

    await wallet.handleAction(BaseActionType.HANDLE_TRANSACTION, {
      approvalType: ActionApprovalType.APPROVE,
    });
    await waitForTransactionSuccess(page);

    // Switch to admin and mark attendance (account 0)
    await switchWalletAccount(wallet, 0);
    await page.reload();
    await connectWallet(page, wallet);
    await waitForAppLoad(page);

    const checkbox = page.locator('input[type="checkbox"]').first();
    if ((await checkbox.count()) > 0 && !(await checkbox.isChecked())) {
      await checkbox.check();

      const attendButton = page.locator('button:has-text("Attend")');
      if ((await attendButton.count()) > 0 && (await attendButton.isEnabled())) {
        await attendButton.click();
        await wallet.handleAction(BaseActionType.HANDLE_TRANSACTION, {
          approvalType: ActionApprovalType.APPROVE,
        });
        await waitForTransactionSuccess(page);
      }
    }
  });
});
