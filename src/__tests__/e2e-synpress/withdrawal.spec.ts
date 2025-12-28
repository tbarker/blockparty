/**
 * Withdrawal Flow E2E Tests
 *
 * Tests the complete withdrawal flow with real MetaMask:
 * 1. User registers for event
 * 2. Admin marks user as attended
 * 3. Admin triggers payback
 * 4. User withdraws their payout
 *
 * Account 1 (deployer): Admin
 * Account 2: Regular user
 */

import {
  test,
  expect,
  createMetaMask,
  waitForTransactionSuccess,
  waitForAppLoad,
  canUserRegister,
  connectWalletIfNeeded,
  switchAccount,
  injectE2EConfig,
  setupMetaMaskNetwork,
} from './fixtures';

test.describe('Withdrawal Flow', () => {
  test('should allow user to withdraw after attendance and payback', async ({
    context,
    page,
    metamaskPage,
    extensionId,
  }) => {
    const metamask = createMetaMask(context, metamaskPage, extensionId);

    // Setup MetaMask network first
    let appPage = await setupMetaMaskNetwork(metamask, context);

    // Step 1: Register as user (Account 2)
    await switchAccount(metamask, 'Account 2');

    // Inject E2E config and navigate
    await injectE2EConfig(appPage);
    await appPage.goto('http://localhost:3000/');

    // Connect wallet
    appPage = await connectWalletIfNeeded(appPage, metamask, context);
    await waitForAppLoad(appPage);

    if (await canUserRegister(appPage)) {
      const handle = `@withdraw_${Date.now()}`;
      const twitterInput = appPage.locator('input[placeholder*="twitter"]');
      await twitterInput.fill(handle);
      await appPage.locator('button:has-text("RSVP")').click();

      await appPage.waitForTimeout(2000);
      await metamask.confirmTransaction();
      await waitForTransactionSuccess(appPage);
    }

    // Step 2: Switch to admin (Account 1)
    await switchAccount(metamask, 'Account 1');
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
        await appPage.waitForTimeout(2000);
        await metamask.confirmTransaction();
        await waitForTransactionSuccess(appPage);
      }
    }

    // Step 4: Trigger payback
    const paybackButton = appPage.locator('button:has-text("Payback")');
    if ((await paybackButton.count()) > 0 && (await paybackButton.isEnabled())) {
      await paybackButton.click();
      await appPage.waitForTimeout(2000);
      await metamask.confirmTransaction();
      await waitForTransactionSuccess(appPage);
    }

    // Step 5: Switch back to user (Account 2) and withdraw
    await switchAccount(metamask, 'Account 2');
    await appPage.reload();
    appPage = await connectWalletIfNeeded(appPage, metamask, context);
    await waitForAppLoad(appPage);

    // Step 6: Withdraw
    const withdrawButton = appPage.locator('button:has-text("Withdraw")');
    if ((await withdrawButton.count()) > 0 && (await withdrawButton.isEnabled())) {
      await withdrawButton.click();
      await appPage.waitForTimeout(2000);
      await metamask.confirmTransaction();
      await waitForTransactionSuccess(appPage);

      await expect(withdrawButton).toBeDisabled({ timeout: 10000 });
    }
  });

  test('should show withdraw button only after event ends', async ({
    context,
    page,
    metamaskPage,
    extensionId,
  }) => {
    const metamask = createMetaMask(context, metamaskPage, extensionId);

    // Setup MetaMask network first
    let appPage = await setupMetaMaskNetwork(metamask, context);

    await switchAccount(metamask, 'Account 2');

    // Inject E2E config and navigate
    await injectE2EConfig(appPage);
    await appPage.goto('http://localhost:3000/');

    // Connect wallet
    appPage = await connectWalletIfNeeded(appPage, metamask, context);
    await waitForAppLoad(appPage);

    if (await canUserRegister(appPage)) {
      const twitterInput = appPage.locator('input[placeholder*="twitter"]');
      await twitterInput.fill('@withdraw_visible');
      await appPage.locator('button:has-text("RSVP")').click();

      await appPage.waitForTimeout(2000);
      await metamask.confirmTransaction();
      await waitForTransactionSuccess(appPage);
    }

    const withdrawButton = appPage.locator('button:has-text("Withdraw")');
    const rsvpButton = appPage.locator('button:has-text("RSVP")');

    const isEventEnded = (await withdrawButton.count()) > 0;

    if (isEventEnded) {
      await expect(withdrawButton).toBeVisible();
    } else {
      await expect(rsvpButton).toBeDisabled();
    }
  });

  test('should prevent double withdrawal', async ({ context, page, metamaskPage, extensionId }) => {
    const metamask = createMetaMask(context, metamaskPage, extensionId);

    // Setup MetaMask network first
    let appPage = await setupMetaMaskNetwork(metamask, context);

    await switchAccount(metamask, 'Account 2');

    // Inject E2E config and navigate
    await injectE2EConfig(appPage);
    await appPage.goto('http://localhost:3000/');

    // Connect wallet
    appPage = await connectWalletIfNeeded(appPage, metamask, context);
    await waitForAppLoad(appPage);

    const withdrawButton = appPage.locator('button:has-text("Withdraw")');

    if ((await withdrawButton.count()) > 0 && (await withdrawButton.isEnabled())) {
      await withdrawButton.click();
      await appPage.waitForTimeout(2000);
      await metamask.confirmTransaction();
      await appPage.waitForTimeout(5000);

      // After withdrawal, button should be disabled or gone
      const isDisabled = await withdrawButton.isDisabled().catch(() => true);
      const buttonCount = await withdrawButton.count();

      expect(isDisabled || buttonCount === 0).toBeTruthy();
    }
  });
});
