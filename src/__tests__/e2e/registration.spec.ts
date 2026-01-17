/**
 * Registration Flow E2E Tests (OnchainTestKit)
 *
 * Tests the complete user registration flow with real MetaMask:
 * 1. Wallet connects via MetaMask
 * 2. Event details are displayed from Anvil
 * 3. User enters Twitter handle
 * 4. User clicks RSVP, MetaMask confirms transaction
 * 5. Transaction is mined on Anvil
 * 6. UI updates to show registration status
 *
 * Uses OnchainTestKit for wallet interactions with shared Anvil instance
 * from global-setup.cjs. Each test deploys its own contract for isolation.
 */

import {
  test,
  expect,
  BaseActionType,
  ActionApprovalType,
  ANVIL_ACCOUNTS,
  CHAIN_ID,
  ANVIL_URL,
  deployTestEvent,
  injectE2EConfig,
  dismissWelcomeModal,
  dismissRainbowKitPopovers,
  waitForAppLoad,
  waitForTransactionSuccess,
  waitForTransactionComplete,
  handleMetaMaskConnection,
} from './fixtures';
import { runDiagnostics } from './diagnostics';

test.describe('Registration Flow', () => {
  // Run diagnostics on test failure
  test.afterEach(async ({ context }, testInfo) => {
    if (testInfo.status !== 'passed') {
      console.log(`\n[${testInfo.title}] Test ${testInfo.status} - running diagnostics...`);
      await runDiagnostics(ANVIL_URL, context, `TEST FAILURE: ${testInfo.title}`);
    }
  });

  test('should display event details on page load', async ({ page, metamask, context, extensionId }) => {
    if (!metamask) throw new Error('MetaMask fixture required');

    // Deploy isolated contract for this test
    const contractAddress = await deployTestEvent({
      name: 'Registration Details Test',
      deposit: '0.02',
      maxParticipants: 20,
      privateKey: ANVIL_ACCOUNTS.deployer.privateKey,
    });

    // Inject E2E config
    await injectE2EConfig(page, { contractAddress, chainId: CHAIN_ID });
    await page.goto('http://localhost:3000/');

    // Connect wallet via RainbowKit
    await page.locator('button:has-text("Connect Wallet")').click();
    await page
      .locator('button:has-text("MetaMask"), [data-testid="rk-wallet-option-metaMask"]')
      .first()
      .click();

    // Handle MetaMask 12.x two-step connection flow (Connect + Review permissions)
    await handleMetaMaskConnection(context, extensionId);

    // Wait for app to load
    await waitForAppLoad(page);

    // Verify event info section is visible
    await expect(page.locator('h4:has-text("Event Info")')).toBeVisible();

    // Verify deposit info is shown (ETH amount)
    await expect(page.locator('text=/ETH/i').first()).toBeVisible({ timeout: 10000 });

    // Verify participant count shows
    await expect(page.getByText('Going (spots left)')).toBeVisible({ timeout: 10000 });
  });

  test('should show connected account in RainbowKit button', async ({ page, metamask, context, extensionId }) => {
    if (!metamask) throw new Error('MetaMask fixture required');

    // Deploy isolated contract
    const contractAddress = await deployTestEvent({
      name: 'Account Dropdown Test',
      deposit: '0.02',
      maxParticipants: 20,
      privateKey: ANVIL_ACCOUNTS.deployer.privateKey,
    });

    // Inject E2E config
    await injectE2EConfig(page, { contractAddress, chainId: CHAIN_ID });
    await page.goto('http://localhost:3000/');

    // Connect wallet
    await page.locator('button:has-text("Connect Wallet")').click();
    await page
      .locator('button:has-text("MetaMask"), [data-testid="rk-wallet-option-metaMask"]')
      .first()
      .click();
    // Handle MetaMask 12.x two-step connection flow (Connect + Review permissions)
    await handleMetaMaskConnection(context, extensionId);

    // Wait for RainbowKit account button
    const accountButton = page.locator(
      '[data-testid="rk-account-button"], button:has-text("0x")'
    );
    await expect(accountButton.first()).toBeVisible({ timeout: 15000 });

    // Verify account address format
    const buttonText = await accountButton.first().textContent();
    expect(buttonText).toMatch(/0x[a-fA-F0-9]/);
  });

  test('should allow user to register for event', async ({ page, metamask, context, extensionId }) => {
    if (!metamask) throw new Error('MetaMask fixture required');

    // Deploy isolated contract
    const contractAddress = await deployTestEvent({
      name: 'Registration Test',
      deposit: '0.02',
      maxParticipants: 20,
      privateKey: ANVIL_ACCOUNTS.deployer.privateKey,
    });

    // Inject E2E config
    await injectE2EConfig(page, { contractAddress, chainId: CHAIN_ID });
    await page.goto('http://localhost:3000/');

    // Connect wallet
    await page.locator('button:has-text("Connect Wallet")').click();
    await page
      .locator('button:has-text("MetaMask"), [data-testid="rk-wallet-option-metaMask"]')
      .first()
      .click();
    // Handle MetaMask 12.x two-step connection flow (Connect + Review permissions)
    await handleMetaMaskConnection(context, extensionId);

    await waitForAppLoad(page);

    // Enter Twitter handle
    const twitterInput = page.locator('input[placeholder*="twitter"]');
    await twitterInput.fill('@onchain_usr');

    // Click RSVP button
    const rsvpButton = page.locator('button:has-text("RSVP")');
    await expect(rsvpButton).toBeEnabled();
    await rsvpButton.click();

    // Confirm transaction in MetaMask
    await metamask.handleAction(BaseActionType.HANDLE_TRANSACTION, {
      approvalType: ActionApprovalType.APPROVE,
    });

    // Wait for success notification
    await waitForTransactionSuccess(page);

    // Verify participant appears in the list
    await expect(page.locator('text=@onchain_usr')).toBeVisible({ timeout: 10000 });

    // Verify RSVP button is now disabled
    await expect(rsvpButton).toBeDisabled();
  });

  test('should update participant count after registration', async ({ page, metamask, context, extensionId }) => {
    if (!metamask) throw new Error('MetaMask fixture required');

    // Deploy isolated contract
    const contractAddress = await deployTestEvent({
      name: 'Participant Count Test',
      deposit: '0.02',
      maxParticipants: 20,
      privateKey: ANVIL_ACCOUNTS.deployer.privateKey,
    });

    // Inject E2E config
    await injectE2EConfig(page, { contractAddress, chainId: CHAIN_ID });
    await page.goto('http://localhost:3000/');

    // Connect wallet
    await page.locator('button:has-text("Connect Wallet")').click();
    await page
      .locator('button:has-text("MetaMask"), [data-testid="rk-wallet-option-metaMask"]')
      .first()
      .click();
    // Handle MetaMask 12.x two-step connection flow (Connect + Review permissions)
    await handleMetaMaskConnection(context, extensionId);

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
    await metamask.handleAction(BaseActionType.HANDLE_TRANSACTION, {
      approvalType: ActionApprovalType.APPROVE,
    });

    await waitForTransactionComplete(page, {
      expectElement: 'text=/\\d+\\(\\d+\\)/',
    });

    // Verify count is displayed
    await expect(page.locator('text=/\\d+\\(\\d+\\)/')).toBeVisible({ timeout: 5000 });
  });

  test('should display participants table with registration data', async ({ page, metamask, context, extensionId }) => {
    if (!metamask) throw new Error('MetaMask fixture required');

    // Deploy isolated contract
    const contractAddress = await deployTestEvent({
      name: 'Participants Table Test',
      deposit: '0.02',
      maxParticipants: 20,
      privateKey: ANVIL_ACCOUNTS.deployer.privateKey,
    });

    // Inject E2E config
    await injectE2EConfig(page, { contractAddress, chainId: CHAIN_ID });
    await page.goto('http://localhost:3000/');

    // Connect wallet
    await page.locator('button:has-text("Connect Wallet")').click();
    await page
      .locator('button:has-text("MetaMask"), [data-testid="rk-wallet-option-metaMask"]')
      .first()
      .click();
    // Handle MetaMask 12.x two-step connection flow (Connect + Review permissions)
    await handleMetaMaskConnection(context, extensionId);

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
    await metamask.handleAction(BaseActionType.HANDLE_TRANSACTION, {
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
