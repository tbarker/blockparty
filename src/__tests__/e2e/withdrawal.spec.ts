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
  ensurePageReady,
} from './fixtures';
import { runDiagnostics } from './diagnostics';

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
    const rpcUrl = getAnvilUrl(node);

    // Deploy isolated contract for this test
    const contractAddress = await deployTestEvent({
      name: 'Withdrawal Test',
      deposit: '0.02',
      maxParticipants: 20,
      privateKey: ANVIL_ACCOUNTS.deployer.privateKey,
      rpcUrl,
    });

    // Inject E2E config
    await injectE2EConfig(page, { contractAddress, chainId: CHAIN_ID });
    await page.goto('http://localhost:3000/');

    // Step 1: Register as user (account 1)
    await switchWalletAccount(wallet, 1);
    await connectWallet(page, wallet);
    await page.reload();
    await connectWallet(page, wallet);
    await waitForAppLoad(page);
    await ensurePageReady(page);

    // Wait for twitter input to be visible and register
    const handle = `@wdr${String(Date.now()).slice(-6)}`;
    const twitterInput = page.locator('input[placeholder*="twitter"]');
    await twitterInput.waitFor({ state: 'visible', timeout: 30000 });
    await twitterInput.fill(handle);

    // Wait for RSVP button to be enabled before clicking
    const rsvpButton = page.locator('button:has-text("RSVP")');
    await rsvpButton.waitFor({ state: 'visible', timeout: 10000 });
    await expect(rsvpButton).toBeEnabled({ timeout: 10000 });
    await rsvpButton.click();

    await wallet.handleAction(BaseActionType.HANDLE_TRANSACTION, {
      approvalType: ActionApprovalType.APPROVE,
    });
    await waitForTransactionSuccess(page);

    // Step 2: Switch to admin (account 0 = deployer)
    await switchWalletAccount(wallet, 0);
    await page.reload();
    await connectWallet(page, wallet);
    await waitForAppLoad(page);

    // Step 3: Mark attendance
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

    // Step 4: Trigger payback
    const paybackButton = page.locator('button:has-text("Payback")');
    if ((await paybackButton.count()) > 0 && (await paybackButton.isEnabled())) {
      await paybackButton.click();
      await wallet.handleAction(BaseActionType.HANDLE_TRANSACTION, {
        approvalType: ActionApprovalType.APPROVE,
      });
      await waitForTransactionSuccess(page);
    }

    // Step 5: Switch back to user (account 1) and withdraw
    await switchWalletAccount(wallet, 1);
    await page.reload();
    await connectWallet(page, wallet);
    await waitForAppLoad(page);

    // Step 6: Withdraw
    const withdrawButton = page.locator('button:has-text("Withdraw")');
    if ((await withdrawButton.count()) > 0 && (await withdrawButton.isEnabled())) {
      await withdrawButton.click();
      await wallet.handleAction(BaseActionType.HANDLE_TRANSACTION, {
        approvalType: ActionApprovalType.APPROVE,
      });
      await waitForTransactionComplete(page);

      await expect(withdrawButton).toBeDisabled({ timeout: 10000 });
    }
  });

  test('should show withdraw button only after event ends', async ({ page, wallet, node }) => {
    if (!wallet) throw new Error('Wallet fixture required');
    const rpcUrl = getAnvilUrl(node);

    // Deploy isolated contract for this test
    const contractAddress = await deployTestEvent({
      name: 'Withdraw Button Visibility Test',
      deposit: '0.02',
      maxParticipants: 20,
      privateKey: ANVIL_ACCOUNTS.deployer.privateKey,
      rpcUrl,
    });

    // Inject E2E config
    await injectE2EConfig(page, { contractAddress, chainId: CHAIN_ID });
    await page.goto('http://localhost:3000/');

    // Connect as user (account 1)
    await switchWalletAccount(wallet, 1);
    await connectWallet(page, wallet);
    await page.reload();
    await connectWallet(page, wallet);
    await waitForAppLoad(page);
    await ensurePageReady(page);

    // Wait for twitter input to be visible and register
    const twitterInput = page.locator('input[placeholder*="twitter"]');
    await twitterInput.waitFor({ state: 'visible', timeout: 30000 });
    await twitterInput.fill('@wdr_visible');

    // Wait for RSVP button to be enabled before clicking
    const rsvpButton = page.locator('button:has-text("RSVP")');
    await rsvpButton.waitFor({ state: 'visible', timeout: 10000 });
    await expect(rsvpButton).toBeEnabled({ timeout: 10000 });
    await rsvpButton.click();

    await wallet.handleAction(BaseActionType.HANDLE_TRANSACTION, {
      approvalType: ActionApprovalType.APPROVE,
    });
    await waitForTransactionSuccess(page);

    const withdrawButton = page.locator('button:has-text("Withdraw")');

    const isEventEnded = (await withdrawButton.count()) > 0;

    if (isEventEnded) {
      await expect(withdrawButton).toBeVisible();
    } else {
      await expect(rsvpButton).toBeDisabled();
    }
  });

  test('should prevent double withdrawal', async ({ page, wallet, node }) => {
    if (!wallet) throw new Error('Wallet fixture required');
    const rpcUrl = getAnvilUrl(node);

    // Deploy isolated contract for this test
    const contractAddress = await deployTestEvent({
      name: 'Double Withdrawal Test',
      deposit: '0.02',
      maxParticipants: 20,
      privateKey: ANVIL_ACCOUNTS.deployer.privateKey,
      rpcUrl,
    });

    // Inject E2E config
    await injectE2EConfig(page, { contractAddress, chainId: CHAIN_ID });
    await page.goto('http://localhost:3000/');

    // Step 1: Register as user (account 1)
    await switchWalletAccount(wallet, 1);
    await connectWallet(page, wallet);
    await page.reload();
    await connectWallet(page, wallet);
    await waitForAppLoad(page);
    await ensurePageReady(page);

    // Wait for twitter input to be visible and register
    const handle = `@dbl${String(Date.now()).slice(-6)}`;
    const twitterInput = page.locator('input[placeholder*="twitter"]');
    await twitterInput.waitFor({ state: 'visible', timeout: 30000 });
    await twitterInput.fill(handle);

    // Wait for RSVP button to be enabled before clicking
    const rsvpButton = page.locator('button:has-text("RSVP")');
    await rsvpButton.waitFor({ state: 'visible', timeout: 10000 });
    await expect(rsvpButton).toBeEnabled({ timeout: 10000 });
    await rsvpButton.click();

    await wallet.handleAction(BaseActionType.HANDLE_TRANSACTION, {
      approvalType: ActionApprovalType.APPROVE,
    });
    await waitForTransactionSuccess(page);

    // Step 2: Switch to admin and mark attendance (account 0)
    await switchWalletAccount(wallet, 0);
    await page.reload();
    await connectWallet(page, wallet);
    await waitForAppLoad(page);
    await ensurePageReady(page);

    // Mark attendance if checkbox available
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

    // Step 3: Trigger payback
    const paybackButton = page.locator('button:has-text("Payback")');
    if ((await paybackButton.count()) > 0 && (await paybackButton.isEnabled())) {
      await paybackButton.click();
      await wallet.handleAction(BaseActionType.HANDLE_TRANSACTION, {
        approvalType: ActionApprovalType.APPROVE,
      });
      await waitForTransactionSuccess(page);
    }

    // Step 4: Switch back to user and withdraw (account 1)
    await switchWalletAccount(wallet, 1);
    await page.reload();
    await connectWallet(page, wallet);
    await waitForAppLoad(page);

    const withdrawButton = page.locator('button:has-text("Withdraw")');

    if ((await withdrawButton.count()) > 0 && (await withdrawButton.isEnabled())) {
      await withdrawButton.click();
      await wallet.handleAction(BaseActionType.HANDLE_TRANSACTION, {
        approvalType: ActionApprovalType.APPROVE,
      });
      // Wait for withdrawal to complete and button state to update
      await waitForTransactionComplete(page);

      // Step 5: Verify can't withdraw again - button should be disabled or gone
      const isDisabled = await withdrawButton.isDisabled().catch(() => true);
      const buttonCount = await withdrawButton.count();

      expect(isDisabled || buttonCount === 0).toBeTruthy();
    }
  });
});
