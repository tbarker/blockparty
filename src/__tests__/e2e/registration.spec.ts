/**
 * Registration Flow E2E Tests (OnchainTestKit)
 *
 * Tests the complete user registration flow with wallet automation:
 * 1. Wallet connects via MetaMask or Coinbase Wallet
 * 2. Event details are displayed from Anvil
 * 3. User enters Twitter handle
 * 4. User clicks RSVP, wallet confirms transaction
 * 5. Transaction is mined on Anvil
 * 6. UI updates to show registration status
 *
 * Phase 1: Uses createOnchainTest with per-test Anvil instances.
 * Each test gets its own Anvil node via LocalNodeManager.
 * Supports both MetaMask and Coinbase Wallet via E2E_WALLET env var.
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
  dismissRainbowKitPopovers,
  waitForAppLoad,
  waitForTransactionSuccess,
  waitForTransactionComplete,
  connectWallet,
} from './fixtures';
import { runDiagnostics } from './diagnostics';

test.describe('Registration Flow', () => {
  // Run diagnostics on test failure
  test.afterEach(async ({ context, node }, testInfo) => {
    if (testInfo.status !== 'passed') {
      console.log(`\n[${testInfo.title}] Test ${testInfo.status} - running diagnostics...`);
      const rpcUrl = getAnvilUrl(node);
      await runDiagnostics(rpcUrl, context, `TEST FAILURE: ${testInfo.title}`);
    }
  });

  test('should display event details on page load', async ({ page, wallet, node }) => {
    if (!wallet) throw new Error('Wallet fixture required');
    const rpcUrl = getAnvilUrl(node);

    // Deploy isolated contract for this test
    const contractAddress = await deployTestEvent({
      name: 'Registration Details Test',
      deposit: '0.02',
      maxParticipants: 20,
      privateKey: ANVIL_ACCOUNTS.deployer.privateKey,
      rpcUrl,
    });

    // Inject E2E config and navigate
    await injectE2EConfig(page, { contractAddress, chainId: CHAIN_ID });
    await page.goto('http://localhost:3000/');

    // Connect wallet
    await connectWallet(page, wallet);
    await waitForAppLoad(page);

    // Verify event info section is visible
    await expect(page.locator('h4:has-text("Event Info")')).toBeVisible();

    // Verify deposit info is shown (ETH amount)
    await expect(page.locator('text=/ETH/i').first()).toBeVisible({ timeout: 10000 });

    // Verify participant count shows
    await expect(page.getByText('Going (spots left)')).toBeVisible({ timeout: 10000 });
  });

  test('should show connected account in RainbowKit button', async ({ page, wallet, node }) => {
    if (!wallet) throw new Error('Wallet fixture required');
    const rpcUrl = getAnvilUrl(node);

    // Deploy isolated contract
    const contractAddress = await deployTestEvent({
      name: 'Account Dropdown Test',
      deposit: '0.02',
      maxParticipants: 20,
      privateKey: ANVIL_ACCOUNTS.deployer.privateKey,
      rpcUrl,
    });

    // Inject E2E config and navigate
    await injectE2EConfig(page, { contractAddress, chainId: CHAIN_ID });
    await page.goto('http://localhost:3000/');

    // Connect wallet
    await connectWallet(page, wallet);

    // Wait for RainbowKit account button
    const accountButton = page.locator(
      '[data-testid="rk-account-button"], button:has-text("0x")'
    );
    await expect(accountButton.first()).toBeVisible({ timeout: 15000 });

    // Verify account address format
    const buttonText = await accountButton.first().textContent();
    expect(buttonText).toMatch(/0x[a-fA-F0-9]/);
  });

  test('should allow user to register for event', async ({ page, wallet, node }) => {
    if (!wallet) throw new Error('Wallet fixture required');
    const rpcUrl = getAnvilUrl(node);

    // Deploy isolated contract
    const contractAddress = await deployTestEvent({
      name: 'Registration Test',
      deposit: '0.02',
      maxParticipants: 20,
      privateKey: ANVIL_ACCOUNTS.deployer.privateKey,
      rpcUrl,
    });

    // Inject E2E config and navigate
    await injectE2EConfig(page, { contractAddress, chainId: CHAIN_ID });
    await page.goto('http://localhost:3000/');

    // Connect wallet
    await connectWallet(page, wallet);
    await waitForAppLoad(page);

    // Enter Twitter handle and RSVP
    await page.locator('input[placeholder*="twitter"]').fill('@onchain_usr');
    const rsvpButton = page.locator('button:has-text("RSVP")');
    await expect(rsvpButton).toBeEnabled();
    await rsvpButton.click();

    // Confirm transaction in wallet
    await wallet.handleAction(BaseActionType.HANDLE_TRANSACTION, {
      approvalType: ActionApprovalType.APPROVE,
    });

    // Wait for success notification
    await waitForTransactionSuccess(page);

    // Verify participant appears in the list
    await expect(page.locator('text=@onchain_usr')).toBeVisible({ timeout: 10000 });

    // Verify RSVP button is now disabled
    await expect(rsvpButton).toBeDisabled();
  });

  test('should update participant count after registration', async ({ page, wallet, node }) => {
    if (!wallet) throw new Error('Wallet fixture required');
    const rpcUrl = getAnvilUrl(node);

    // Deploy isolated contract
    const contractAddress = await deployTestEvent({
      name: 'Participant Count Test',
      deposit: '0.02',
      maxParticipants: 20,
      privateKey: ANVIL_ACCOUNTS.deployer.privateKey,
      rpcUrl,
    });

    // Inject E2E config and navigate
    await injectE2EConfig(page, { contractAddress, chainId: CHAIN_ID });
    await page.goto('http://localhost:3000/');

    // Connect wallet
    await connectWallet(page, wallet);
    await waitForAppLoad(page);

    // Enter Twitter handle
    const twitterInput = page.locator('input[placeholder*="twitter"]');
    await twitterInput.waitFor({ state: 'visible', timeout: 30000 });
    await twitterInput.fill('@count_test');

    // Click RSVP button
    const rsvpButton = page.locator('button:has-text("RSVP")');
    await rsvpButton.waitFor({ state: 'visible', timeout: 10000 });
    await expect(rsvpButton).toBeEnabled({ timeout: 10000 });
    await rsvpButton.click();

    // Confirm transaction
    await wallet.handleAction(BaseActionType.HANDLE_TRANSACTION, {
      approvalType: ActionApprovalType.APPROVE,
    });

    await waitForTransactionComplete(page, {
      expectElement: 'text=/\\d+\\(\\d+\\)/',
    });

    // Verify count is displayed
    await expect(page.locator('text=/\\d+\\(\\d+\\)/')).toBeVisible({ timeout: 5000 });
  });

  test('should display participants table with registration data', async ({ page, wallet, node }) => {
    if (!wallet) throw new Error('Wallet fixture required');
    const rpcUrl = getAnvilUrl(node);

    // Deploy isolated contract
    const contractAddress = await deployTestEvent({
      name: 'Participants Table Test',
      deposit: '0.02',
      maxParticipants: 20,
      privateKey: ANVIL_ACCOUNTS.deployer.privateKey,
      rpcUrl,
    });

    // Inject E2E config and navigate
    await injectE2EConfig(page, { contractAddress, chainId: CHAIN_ID });
    await page.goto('http://localhost:3000/');

    // Connect wallet
    await connectWallet(page, wallet);
    await waitForAppLoad(page);
    await dismissRainbowKitPopovers(page);

    // Enter Twitter handle
    const twitterInput = page.locator('input[placeholder*="twitter"]');
    await twitterInput.waitFor({ state: 'visible', timeout: 30000 });
    await twitterInput.fill('@table_test');

    // Click RSVP button
    const rsvpButton = page.locator('button:has-text("RSVP")');
    await rsvpButton.waitFor({ state: 'visible', timeout: 10000 });
    await expect(rsvpButton).toBeEnabled({ timeout: 10000 });
    await rsvpButton.click();

    // Confirm transaction
    await wallet.handleAction(BaseActionType.HANDLE_TRANSACTION, {
      approvalType: ActionApprovalType.APPROVE,
    });

    await waitForTransactionComplete(page, {
      expectElement: 'table',
    });

    // Dismiss any modals
    await dismissRainbowKitPopovers(page);

    // Verify participants table
    await expect(page.locator('table')).toBeVisible({ timeout: 10000 });

    // Verify table has participant data
    await expect(
      page.locator('tbody tr').filter({ hasText: /@\w+/ }).first()
    ).toBeVisible({ timeout: 10000 });
  });
});
