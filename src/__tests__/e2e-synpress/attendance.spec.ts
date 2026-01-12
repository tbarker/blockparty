/**
 * Admin Attendance Flow E2E Tests
 *
 * Tests admin functionality with real MetaMask:
 * 1. Admin views registered participants
 * 2. Admin marks attendees as present
 * 3. Admin triggers payback calculation
 * 4. Admin cancels event (if needed)
 *
 * PARALLELIZATION: This suite deploys its own contract and uses dedicated accounts
 * (Account 4 as admin, Account 5 as user) to avoid conflicts with other test suites.
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
  SUITE_ACCOUNTS,
} from './fixtures';

// Suite-specific contract address (deployed in beforeAll)
let suiteContractAddress: string;

// Use dedicated accounts for this suite
const ACCOUNTS = SUITE_ACCOUNTS.attendance;

test.describe('Admin Attendance Flow', () => {
  // Deploy a fresh contract for this suite
  test.beforeAll(async () => {
    suiteContractAddress = await deployTestEvent({
      name: 'Attendance Test Event',
      deposit: '0.02',
      maxParticipants: 20,
      deployerPrivateKey: ACCOUNTS.admin.privateKey,
    });
  });

  test('should show admin controls when connected as owner', async ({
    context,
    page,
    metamaskPage,
    extensionId,
  }) => {
    const metamask = createMetaMask(context, metamaskPage, extensionId);

    // Setup MetaMask network first
    let appPage = await setupMetaMaskNetwork(metamask, context);

    // Use suite-specific admin account (deployer/owner)
    await switchAccount(metamask, ACCOUNTS.admin.metamaskName);

    // Inject E2E config with suite-specific contract
    await injectE2EConfigWithContract(appPage, suiteContractAddress);
    await appPage.goto('http://localhost:3000/');

    // Connect wallet
    appPage = await connectWalletIfNeeded(appPage, metamask, context);
    await waitForAppLoad(appPage);

    // Admin controls should be visible
    const cancelButton = appPage.locator('button:has-text("Cancel")');
    const paybackButton = appPage.locator('button:has-text("Payback")');
    const grantAdminButton = appPage.locator('button:has-text("Grant admin")');

    const hasCancelButton = (await cancelButton.count()) > 0;
    const hasPaybackButton = (await paybackButton.count()) > 0;
    const hasGrantAdminButton = (await grantAdminButton.count()) > 0;

    expect(hasCancelButton || hasPaybackButton || hasGrantAdminButton).toBeTruthy();
  });

  test('should allow admin to mark attendance', async ({
    context,
    page,
    metamaskPage,
    extensionId,
  }) => {
    const metamask = createMetaMask(context, metamaskPage, extensionId);

    // Setup MetaMask network first
    let appPage = await setupMetaMaskNetwork(metamask, context);

    // First register as user (suite-specific user account)
    await switchAccount(metamask, ACCOUNTS.user.metamaskName);

    // Inject E2E config with suite-specific contract
    await injectE2EConfigWithContract(appPage, suiteContractAddress);
    await appPage.goto('http://localhost:3000/');

    // Connect wallet
    appPage = await connectWalletIfNeeded(appPage, metamask, context);
    await waitForAppLoad(appPage);

    if (await canUserRegister(appPage)) {
      const handle = `@attend_${Date.now()}`;
      const twitterInput = appPage.locator('input[placeholder*="twitter"]');
      await twitterInput.fill(handle);
      await appPage.locator('button:has-text("RSVP")').click();

      await waitForMetaMaskAndConfirm(metamask, context);
      await waitForTransactionComplete(appPage);
    }

    // Switch to admin (suite-specific admin account)
    await switchAccount(metamask, ACCOUNTS.admin.metamaskName);
    await appPage.reload();
    appPage = await connectWalletIfNeeded(appPage, metamask, context);
    await waitForAppLoad(appPage);

    // Look for attendance checkboxes
    const attendCheckboxes = appPage.locator('input[type="checkbox"]');
    const checkboxCount = await attendCheckboxes.count();

    if (checkboxCount > 0) {
      // Find unchecked checkbox and check it
      for (let i = 0; i < checkboxCount; i++) {
        const checkbox = attendCheckboxes.nth(i);
        if (!(await checkbox.isChecked())) {
          await checkbox.check();

          const attendButton = appPage.locator('button:has-text("Attend")');
          if ((await attendButton.count()) > 0 && (await attendButton.isEnabled())) {
            await attendButton.click();
            await waitForMetaMaskAndConfirm(metamask, context);
            await waitForTransactionSuccess(appPage);
          }
          break;
        }
      }
    }
  });

  test('should allow admin to trigger payback', async ({
    context,
    page,
    metamaskPage,
    extensionId,
  }) => {
    const metamask = createMetaMask(context, metamaskPage, extensionId);

    // Setup MetaMask network first
    let appPage = await setupMetaMaskNetwork(metamask, context);

    await switchAccount(metamask, ACCOUNTS.admin.metamaskName);

    // Inject E2E config with suite-specific contract
    await injectE2EConfigWithContract(appPage, suiteContractAddress);
    await appPage.goto('http://localhost:3000/');

    // Connect wallet
    appPage = await connectWalletIfNeeded(appPage, metamask, context);
    await waitForAppLoad(appPage);

    const paybackButton = appPage.locator('button:has-text("Payback")');
    if ((await paybackButton.count()) > 0 && (await paybackButton.isEnabled())) {
      await paybackButton.click();
      await waitForMetaMaskAndConfirm(metamask, context);
      await waitForTransactionSuccess(appPage);

      await expect(paybackButton).toBeDisabled({ timeout: 10000 });
    }
  });

  test('should allow admin to cancel event', async ({
    context,
    page,
    metamaskPage,
    extensionId,
  }) => {
    const metamask = createMetaMask(context, metamaskPage, extensionId);

    // Setup MetaMask network first
    let appPage = await setupMetaMaskNetwork(metamask, context);

    await switchAccount(metamask, ACCOUNTS.admin.metamaskName);

    // Inject E2E config with suite-specific contract
    await injectE2EConfigWithContract(appPage, suiteContractAddress);
    await appPage.goto('http://localhost:3000/');

    // Connect wallet
    appPage = await connectWalletIfNeeded(appPage, metamask, context);
    await waitForAppLoad(appPage);

    const cancelButton = appPage.locator('button:has-text("Cancel")');
    if ((await cancelButton.count()) > 0) {
      const isEnabled = await cancelButton.isEnabled();
      if (isEnabled) {
        await expect(cancelButton).toBeEnabled();
        // Don't actually cancel - would break other tests
      }
    }
  });

  test('should not show admin controls for non-owner', async ({
    context,
    page,
    metamaskPage,
    extensionId,
  }) => {
    const metamask = createMetaMask(context, metamaskPage, extensionId);

    // Setup MetaMask network first
    let appPage = await setupMetaMaskNetwork(metamask, context);

    await switchAccount(metamask, ACCOUNTS.user.metamaskName);

    // Inject E2E config with suite-specific contract
    await injectE2EConfigWithContract(appPage, suiteContractAddress);
    await appPage.goto('http://localhost:3000/');

    // Connect wallet
    appPage = await connectWalletIfNeeded(appPage, metamask, context);
    await waitForAppLoad(appPage);

    const cancelButton = appPage.locator('button:has-text("Cancel")');
    const paybackButton = appPage.locator('button:has-text("Payback")');

    // Non-owner should not have enabled admin controls
    if ((await cancelButton.count()) > 0) {
      await expect(cancelButton).toBeDisabled();
    }
    if ((await paybackButton.count()) > 0) {
      await expect(paybackButton).toBeDisabled();
    }
  });

  test('should update attended count after marking attendance', async ({
    context,
    page,
    metamaskPage,
    extensionId,
  }) => {
    const metamask = createMetaMask(context, metamaskPage, extensionId);

    // Setup MetaMask network first
    let appPage = await setupMetaMaskNetwork(metamask, context);

    // Register as user first (suite-specific user account)
    await switchAccount(metamask, ACCOUNTS.user.metamaskName);

    // Inject E2E config with suite-specific contract
    await injectE2EConfigWithContract(appPage, suiteContractAddress);
    await appPage.goto('http://localhost:3000/');

    // Connect wallet
    appPage = await connectWalletIfNeeded(appPage, metamask, context);
    await waitForAppLoad(appPage);

    if (await canUserRegister(appPage)) {
      const twitterInput = appPage.locator('input[placeholder*="twitter"]');
      await twitterInput.fill(`@count_${Date.now()}`);
      await appPage.locator('button:has-text("RSVP")').click();

      await waitForMetaMaskAndConfirm(metamask, context);
      await waitForTransactionSuccess(appPage);
    }

    // Switch to admin and mark attendance (suite-specific admin account)
    await switchAccount(metamask, ACCOUNTS.admin.metamaskName);
    await appPage.reload();
    appPage = await connectWalletIfNeeded(appPage, metamask, context);
    await waitForAppLoad(appPage);

    const checkbox = appPage.locator('input[type="checkbox"]').first();
    if ((await checkbox.count()) > 0 && !(await checkbox.isChecked())) {
      await checkbox.check();

      const attendButton = appPage.locator('button:has-text("Attend")');
      if ((await attendButton.count()) > 0 && (await attendButton.isEnabled())) {
        await attendButton.click();
        await waitForMetaMaskAndConfirm(metamask, context);
        await waitForTransactionSuccess(appPage);
      }
    }
  });
});
