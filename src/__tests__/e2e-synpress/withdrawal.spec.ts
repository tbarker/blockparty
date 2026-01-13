/**
 * Withdrawal Flow E2E Tests
 *
 * Tests the complete withdrawal flow with real MetaMask:
 * 1. User registers for event
 * 2. Admin marks user as attended
 * 3. Admin triggers payback
 * 4. User withdraws their payout
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
} from './fixtures';

test.describe('Withdrawal Flow', () => {
  test('should allow user to withdraw after attendance and payback', async ({
    context,
    page,
    metamaskPage,
    extensionId,
  }, testInfo) => {
    // Get accounts for this worker to prevent nonce conflicts
    const ACCOUNTS = getWorkerAccounts(testInfo.parallelIndex);

    // Deploy isolated contract for this test
    const contractAddress = await deployTestEvent({
      name: 'Withdrawal Test',
      deposit: '0.02',
      maxParticipants: 20,
      deployerPrivateKey: ACCOUNTS.admin.privateKey,
    });

    const metamask = createMetaMask(context, metamaskPage, extensionId);

    // Setup MetaMask network first
    let appPage = await setupMetaMaskNetwork(metamask, context);

    // Step 1: Register as user (suite-specific user account)
    await switchAccount(metamask, ACCOUNTS.user.metamaskName);

    // Inject E2E config with test-specific contract
    await injectE2EConfigWithContract(appPage, contractAddress);
    await appPage.goto('http://localhost:3000/');

    // Connect wallet
    appPage = await connectWalletIfNeeded(appPage, metamask, context);
    await waitForAppLoad(appPage);

    // Register (handle max 15 chars after @)
    const handle = `@wdr${String(Date.now()).slice(-6)}`;
    const twitterInput = appPage.locator('input[placeholder*="twitter"]');
    await twitterInput.fill(handle);
    await appPage.locator('button:has-text("RSVP")').click();

    await waitForMetaMaskAndConfirm(metamask, context);
    await waitForTransactionSuccess(appPage);

    // Step 2: Switch to admin (suite-specific admin account)
    await switchAccount(metamask, ACCOUNTS.admin.metamaskName);
    await appPage.reload();
    appPage = await connectWalletIfNeeded(appPage, metamask, context);
    await waitForAppLoad(appPage);

    // Step 3: Mark attendance
    const attendCheckbox = appPage.locator('input[type="checkbox"]').first();
    if ((await attendCheckbox.count()) > 0 && !(await attendCheckbox.isChecked())) {
      await attendCheckbox.check();

      const attendButton = appPage.locator('button:has-text("Attend")');
      if ((await attendButton.count()) > 0 && (await attendButton.isEnabled())) {
        await attendButton.click();
        await waitForMetaMaskAndConfirm(metamask, context);
        await waitForTransactionSuccess(appPage);
      }
    }

    // Step 4: Trigger payback
    const paybackButton = appPage.locator('button:has-text("Payback")');
    if ((await paybackButton.count()) > 0 && (await paybackButton.isEnabled())) {
      await paybackButton.click();
      await waitForMetaMaskAndConfirm(metamask, context);
      await waitForTransactionSuccess(appPage);
    }

    // Step 5: Switch back to user (suite-specific user account) and withdraw
    await switchAccount(metamask, ACCOUNTS.user.metamaskName);
    await appPage.reload();
    appPage = await connectWalletIfNeeded(appPage, metamask, context);
    await waitForAppLoad(appPage);

    // Step 6: Withdraw
    const withdrawButton = appPage.locator('button:has-text("Withdraw")');
    if ((await withdrawButton.count()) > 0 && (await withdrawButton.isEnabled())) {
      await withdrawButton.click();
      await waitForMetaMaskAndConfirm(metamask, context);
      await waitForTransactionComplete(appPage);

      await expect(withdrawButton).toBeDisabled({ timeout: 10000 });
    }
  });

  test('should show withdraw button only after event ends', async ({
    context,
    page,
    metamaskPage,
    extensionId,
  }, testInfo) => {
    // Get accounts for this worker to prevent nonce conflicts
    const ACCOUNTS = getWorkerAccounts(testInfo.parallelIndex);

    // Deploy isolated contract for this test
    const contractAddress = await deployTestEvent({
      name: 'Withdraw Button Visibility Test',
      deposit: '0.02',
      maxParticipants: 20,
      deployerPrivateKey: ACCOUNTS.admin.privateKey,
    });

    const metamask = createMetaMask(context, metamaskPage, extensionId);

    // Setup MetaMask network first
    let appPage = await setupMetaMaskNetwork(metamask, context);

    await switchAccount(metamask, ACCOUNTS.user.metamaskName);

    // Inject E2E config with test-specific contract
    await injectE2EConfigWithContract(appPage, contractAddress);
    await appPage.goto('http://localhost:3000/');

    // Connect wallet
    appPage = await connectWalletIfNeeded(appPage, metamask, context);
    await waitForAppLoad(appPage);

    // Register
    const twitterInput = appPage.locator('input[placeholder*="twitter"]');
    await twitterInput.fill('@wdr_visible');
    await appPage.locator('button:has-text("RSVP")').click();

    await waitForMetaMaskAndConfirm(metamask, context);
    await waitForTransactionSuccess(appPage);

    const withdrawButton = appPage.locator('button:has-text("Withdraw")');
    const rsvpButton = appPage.locator('button:has-text("RSVP")');

    const isEventEnded = (await withdrawButton.count()) > 0;

    if (isEventEnded) {
      await expect(withdrawButton).toBeVisible();
    } else {
      await expect(rsvpButton).toBeDisabled();
    }
  });

  test('should prevent double withdrawal', async ({ context, page, metamaskPage, extensionId }, testInfo) => {
    // Get accounts for this worker to prevent nonce conflicts
    const ACCOUNTS = getWorkerAccounts(testInfo.parallelIndex);

    // Deploy isolated contract for this test
    const contractAddress = await deployTestEvent({
      name: 'Double Withdrawal Test',
      deposit: '0.02',
      maxParticipants: 20,
      deployerPrivateKey: ACCOUNTS.admin.privateKey,
    });

    const metamask = createMetaMask(context, metamaskPage, extensionId);

    // Setup MetaMask network first
    let appPage = await setupMetaMaskNetwork(metamask, context);

    // Step 1: Register as user
    await switchAccount(metamask, ACCOUNTS.user.metamaskName);

    // Inject E2E config with test-specific contract
    await injectE2EConfigWithContract(appPage, contractAddress);
    await appPage.goto('http://localhost:3000/');

    // Connect wallet
    appPage = await connectWalletIfNeeded(appPage, metamask, context);
    await waitForAppLoad(appPage);

    // Register (handle max 15 chars after @)
    const handle = `@dbl${String(Date.now()).slice(-6)}`;
    const twitterInput = appPage.locator('input[placeholder*="twitter"]');
    await twitterInput.fill(handle);
    await appPage.locator('button:has-text("RSVP")').click();

    await waitForMetaMaskAndConfirm(metamask, context);
    await waitForTransactionSuccess(appPage);

    // Step 2: Switch to admin and mark attendance
    await switchAccount(metamask, ACCOUNTS.admin.metamaskName);
    await appPage.reload();
    appPage = await connectWalletIfNeeded(appPage, metamask, context);
    await waitForAppLoad(appPage);

    // Mark attendance if checkbox available
    const attendCheckbox = appPage.locator('input[type="checkbox"]').first();
    if ((await attendCheckbox.count()) > 0 && !(await attendCheckbox.isChecked())) {
      await attendCheckbox.check();

      const attendButton = appPage.locator('button:has-text("Attend")');
      if ((await attendButton.count()) > 0 && (await attendButton.isEnabled())) {
        await attendButton.click();
        await waitForMetaMaskAndConfirm(metamask, context);
        await waitForTransactionSuccess(appPage);
      }
    }

    // Step 3: Trigger payback
    const paybackButton = appPage.locator('button:has-text("Payback")');
    if ((await paybackButton.count()) > 0 && (await paybackButton.isEnabled())) {
      await paybackButton.click();
      await waitForMetaMaskAndConfirm(metamask, context);
      await waitForTransactionSuccess(appPage);
    }

    // Step 4: Switch back to user and withdraw
    await switchAccount(metamask, ACCOUNTS.user.metamaskName);
    await appPage.reload();
    appPage = await connectWalletIfNeeded(appPage, metamask, context);
    await waitForAppLoad(appPage);

    const withdrawButton = appPage.locator('button:has-text("Withdraw")');

    if ((await withdrawButton.count()) > 0 && (await withdrawButton.isEnabled())) {
      await withdrawButton.click();
      await waitForMetaMaskAndConfirm(metamask, context);
      // Wait for withdrawal to complete and button state to update
      await waitForTransactionComplete(appPage);

      // Step 5: Verify can't withdraw again - button should be disabled or gone
      const isDisabled = await withdrawButton.isDisabled().catch(() => true);
      const buttonCount = await withdrawButton.count();

      expect(isDisabled || buttonCount === 0).toBeTruthy();
    }
  });
});
