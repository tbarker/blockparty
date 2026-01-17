/**
 * Registration Flow E2E Tests
 *
 * Tests the complete user registration flow with real MetaMask:
 * 1. Wallet connects via MetaMask
 * 2. Event details are displayed from Anvil
 * 3. User enters Twitter handle
 * 4. User clicks RSVP, MetaMask confirms transaction
 * 5. Transaction is mined on Anvil
 * 6. UI updates to show registration status
 *
 * PARALLELIZATION: Each test deploys its own contract for full isolation.
 * Tests run fully parallel with workers = CPU cores (max 5).
 */

import {
  test,
  expect,
  createMetaMask,
  waitForTransactionSuccess,
  waitForMetaMaskAndConfirm,
  waitForTransactionComplete,
  waitForAppLoad,
  canUserRegister,
  connectWalletIfNeeded,
  switchAccount,
  injectE2EConfigWithContract,
  setupMetaMaskNetwork,
  deployTestEvent,
  getWorkerAccounts,
  safeReloadAndGetPage,
  ensurePageReady,
  stabilizeForComplexTest,
  runDiagnostics,
} from './fixtures';

test.describe('Registration Flow', () => {
  // Run diagnostics on test failure to help identify root cause
  test.afterEach(async ({ context }, testInfo) => {
    if (testInfo.status !== 'passed') {
      console.log(`\n[${testInfo.title}] Test ${testInfo.status} - running diagnostics...`);
      await runDiagnostics(context, `TEST FAILURE: ${testInfo.title}`);
    }
  });

  test('should display event details on page load', async ({
    context,
    page,
    metamaskPage,
    extensionId,
  }, testInfo) => {
    // Get accounts for this worker to prevent nonce conflicts
    const ACCOUNTS = getWorkerAccounts(testInfo.parallelIndex);

    // Deploy isolated contract for this test
    const contractAddress = await deployTestEvent({
      name: 'Registration Details Test',
      deposit: '0.02',
      maxParticipants: 20,
      deployerPrivateKey: ACCOUNTS.deployer.privateKey,
    });

    const metamask = createMetaMask(context, metamaskPage, extensionId);

    // Setup MetaMask network first (uses Account 1 which is the default)
    let appPage = await setupMetaMaskNetwork(metamask, context);

    // Inject E2E config with test-specific contract
    await injectE2EConfigWithContract(appPage, contractAddress);
    await appPage.goto('http://localhost:3000/');

    // Connect wallet and get updated app page reference
    appPage = await connectWalletIfNeeded(appPage, metamask, context);

    // Wait for app to load
    await waitForAppLoad(appPage);

    // Verify event info section is visible
    await expect(appPage.locator('h4:has-text("Event Info")')).toBeVisible();

    // Verify deposit info is shown (ETH amount)
    await expect(appPage.locator('text=/ETH/i').first()).toBeVisible({ timeout: 10000 });

    // Verify participant count shows (format: "Going (spots left)")
    await expect(appPage.getByText('Going (spots left)')).toBeVisible({ timeout: 10000 });
  });

  test('should show connected account in RainbowKit button', async ({
    context,
    page,
    metamaskPage,
    extensionId,
  }, testInfo) => {
    // Get accounts for this worker to prevent nonce conflicts
    const ACCOUNTS = getWorkerAccounts(testInfo.parallelIndex);

    // Deploy isolated contract for this test
    const contractAddress = await deployTestEvent({
      name: 'Account Dropdown Test',
      deposit: '0.02',
      maxParticipants: 20,
      deployerPrivateKey: ACCOUNTS.deployer.privateKey,
    });

    const metamask = createMetaMask(context, metamaskPage, extensionId);

    // Setup MetaMask network first (uses Account 1 which is the default)
    let appPage = await setupMetaMaskNetwork(metamask, context);

    // Inject E2E config with test-specific contract
    await injectE2EConfigWithContract(appPage, contractAddress);
    await appPage.goto('http://localhost:3000/');

    // Connect wallet
    appPage = await connectWalletIfNeeded(appPage, metamask, context);

    // Wait for RainbowKit account button to appear
    // RainbowKit shows the connected address in a button with data-testid="rk-account-button"
    // or with the address visible (truncated like "0xf39...266")
    const accountButton = appPage.locator('[data-testid="rk-account-button"], button:has-text("0x")');
    await expect(accountButton.first()).toBeVisible({ timeout: 15000 });

    // Verify account address format is shown (truncated address starting with 0x)
    const buttonText = await accountButton.first().textContent();
    expect(buttonText).toMatch(/0x[a-fA-F0-9]/);
  });

  test('should allow user to register for event', async ({
    context,
    page,
    metamaskPage,
    extensionId,
  }, testInfo) => {
    // Get accounts for this worker to prevent nonce conflicts
    const ACCOUNTS = getWorkerAccounts(testInfo.parallelIndex);

    // Deploy isolated contract for this test
    const contractAddress = await deployTestEvent({
      name: 'Registration Test',
      deposit: '0.02',
      maxParticipants: 20,
      deployerPrivateKey: ACCOUNTS.deployer.privateKey,
    });

    const metamask = createMetaMask(context, metamaskPage, extensionId);

    // Setup MetaMask network first
    let appPage = await setupMetaMaskNetwork(metamask, context);

    // Switch to user account for registration
    await switchAccount(metamask, ACCOUNTS.user.metamaskName);

    // Inject E2E config with test-specific contract
    await injectE2EConfigWithContract(appPage, contractAddress);
    await appPage.goto('http://localhost:3000/');

    // Connect wallet with reload to ensure stable connection in CI
    appPage = await connectWalletIfNeeded(appPage, metamask, context);
    appPage = await safeReloadAndGetPage(appPage, context);
    appPage = await connectWalletIfNeeded(appPage, metamask, context);
    await waitForAppLoad(appPage);

    // Enter Twitter handle
    const twitterInput = appPage.locator('input[placeholder*="twitter"]');
    await twitterInput.fill('@synpress_usr');

    // Click RSVP button
    const rsvpButton = appPage.locator('button:has-text("RSVP")');
    await expect(rsvpButton).toBeEnabled();
    await rsvpButton.click();

    // Confirm transaction in MetaMask (waits for popup automatically)
    await waitForMetaMaskAndConfirm(metamask, context);

    // Wait for success notification
    await waitForTransactionSuccess(appPage);

    // Verify participant appears in the list
    await expect(appPage.locator('text=@synpress_usr')).toBeVisible({ timeout: 10000 });

    // Verify RSVP button is now disabled
    await expect(rsvpButton).toBeDisabled();
  });

  test('should update participant count after registration', async ({
    context,
    page,
    metamaskPage,
    extensionId,
  }, testInfo) => {
    // Get accounts for this worker to prevent nonce conflicts
    const ACCOUNTS = getWorkerAccounts(testInfo.parallelIndex);

    // Deploy isolated contract for this test
    const contractAddress = await deployTestEvent({
      name: 'Participant Count Test',
      deposit: '0.02',
      maxParticipants: 20,
      deployerPrivateKey: ACCOUNTS.deployer.privateKey,
    });

    const metamask = createMetaMask(context, metamaskPage, extensionId);

    // Setup MetaMask network first
    let appPage = await setupMetaMaskNetwork(metamask, context);

    // Switch to user account for registration
    await switchAccount(metamask, ACCOUNTS.user.metamaskName);

    // Inject E2E config with test-specific contract
    await injectE2EConfigWithContract(appPage, contractAddress);
    await appPage.goto('http://localhost:3000/');

    // Connect wallet - simplified to avoid overwhelming Anvil with RPCs
    appPage = await connectWalletIfNeeded(appPage, metamask, context);
    await waitForAppLoad(appPage);
    await ensurePageReady(appPage);

    // Wait for twitter input to be visible and interactable
    const twitterInput = appPage.locator('input[placeholder*="twitter"]');
    await twitterInput.waitFor({ state: 'visible', timeout: 30000 });
    await twitterInput.fill('@count_test');

    // Wait for RSVP button to be enabled before clicking
    const rsvpButton = appPage.locator('button:has-text("RSVP")');
    await rsvpButton.waitFor({ state: 'visible', timeout: 10000 });
    await expect(rsvpButton).toBeEnabled({ timeout: 10000 });
    await rsvpButton.click();

    // Confirm transaction and wait for completion
    await waitForMetaMaskAndConfirm(metamask, context);
    await waitForTransactionComplete(appPage, {
      expectElement: 'text=/\\d+\\(\\d+\\)/',
    });

    // Verify count is displayed
    await expect(appPage.locator('text=/\\d+\\(\\d+\\)/')).toBeVisible({ timeout: 5000 });
  });

  test('should display participants table with registration data', async ({
    context,
    page,
    metamaskPage,
    extensionId,
  }, testInfo) => {
    // Get accounts for this worker to prevent nonce conflicts
    const ACCOUNTS = getWorkerAccounts(testInfo.parallelIndex);

    // Deploy isolated contract for this test
    const contractAddress = await deployTestEvent({
      name: 'Participants Table Test',
      deposit: '0.02',
      maxParticipants: 20,
      deployerPrivateKey: ACCOUNTS.deployer.privateKey,
    });

    const metamask = createMetaMask(context, metamaskPage, extensionId);

    // Setup MetaMask network first
    let appPage = await setupMetaMaskNetwork(metamask, context);

    // Switch to user account for registration
    await switchAccount(metamask, ACCOUNTS.user.metamaskName);

    // Inject E2E config with test-specific contract
    await injectE2EConfigWithContract(appPage, contractAddress);
    await appPage.goto('http://localhost:3000/');

    // Connect wallet - simplified to avoid overwhelming Anvil with RPCs
    appPage = await connectWalletIfNeeded(appPage, metamask, context);
    await waitForAppLoad(appPage);
    await ensurePageReady(appPage);

    // Wait for twitter input to be visible and interactable
    const twitterInput = appPage.locator('input[placeholder*="twitter"]');
    await twitterInput.waitFor({ state: 'visible', timeout: 30000 });
    await twitterInput.fill('@table_test');

    // Wait for RSVP button to be enabled before clicking
    const rsvpButton = appPage.locator('button:has-text("RSVP")');
    await rsvpButton.waitFor({ state: 'visible', timeout: 10000 });
    await expect(rsvpButton).toBeEnabled({ timeout: 10000 });
    await rsvpButton.click();

    // Confirm transaction and wait for table to update
    await waitForMetaMaskAndConfirm(metamask, context);
    await waitForTransactionComplete(appPage, {
      expectElement: 'table',
    });

    // Dismiss any modals that might have appeared during transaction
    await ensurePageReady(appPage);

    // Verify participants table
    await expect(appPage.locator('table')).toBeVisible({ timeout: 10000 });

    // Verify table has participant data (twitter handle starting with @)
    await expect(appPage.locator('tbody tr').filter({ hasText: /@\w+/ }).first()).toBeVisible({
      timeout: 10000,
    });
  });
});
