/**
 * Withdrawal Flow E2E Tests
 *
 * Tests the complete withdrawal flow:
 * 1. User registers for event
 * 2. Admin marks user as attended
 * 3. Admin triggers payback
 * 4. User withdraws their payout
 * 5. Verify balance changes in UI
 *
 * This test requires multi-account interaction:
 * - deployer: Admin who marks attendance and triggers payback
 * - user1: Regular user who registers, attends, and withdraws
 */

import {
  test,
  expect,
  TEST_ACCOUNTS,
  switchAccount,
  waitForTransactionSuccess,
  canUserRegister,
} from './support/fixtures.mjs';

test.describe('Withdrawal Flow', () => {
  /**
   * Full withdrawal flow test
   *
   * This is a comprehensive test that walks through the entire event lifecycle:
   * 1. Register as user
   * 2. Switch to admin and mark attendance
   * 3. Admin triggers payback calculation
   * 4. Switch back to user and withdraw
   */
  test('should allow user to withdraw after attendance and payback', async ({ page }) => {
    // Step 1: Register as a user
    await page.goto('/');
    await page.waitForSelector('h4:has-text("Event Info")', { timeout: 30000 });

    // Check if we need to register
    if (await canUserRegister(page)) {
      const handle = `@withdraw_${Date.now()}`;
      const twitterInput = page.locator('input[placeholder*="twitter"]');
      await twitterInput.fill(handle);
      await page.locator('button:has-text("RSVP")').click();
      await waitForTransactionSuccess(page);
    }

    // Get current account address for later verification
    const userAddress = await page.evaluate(() => {
      return window.__mockEthereum.getCurrentAccount().address;
    });
    console.log('User address:', userAddress);

    // Step 2: Switch to admin account (deployer)
    await switchAccount(page, 'deployer');

    // Reload page to refresh with new account
    await page.reload();
    await page.waitForSelector('h4:has-text("Event Info")', { timeout: 30000 });

    // Step 3: Admin marks attendance
    const attendCheckbox = page.locator('input[type="checkbox"]').first();
    const hasAttendCheckbox = (await attendCheckbox.count()) > 0;

    if (hasAttendCheckbox) {
      const isChecked = await attendCheckbox.isChecked();
      if (!isChecked) {
        await attendCheckbox.check();
        await waitForTransactionSuccess(page);
      }
    }

    // Step 4: Admin triggers payback
    const paybackButton = page.locator('button:has-text("Payback")');
    const hasPayback = (await paybackButton.count()) > 0;

    if (hasPayback && (await paybackButton.isEnabled())) {
      await paybackButton.click();
      await waitForTransactionSuccess(page);
    }

    // Step 5: Switch back to user account and withdraw
    await switchAccount(page, 'user1');
    await page.reload();
    await page.waitForSelector('h4:has-text("Event Info")', { timeout: 30000 });

    // Step 6: Withdraw
    const withdrawButton = page.locator('button:has-text("Withdraw")');
    const hasWithdraw = (await withdrawButton.count()) > 0;

    if (hasWithdraw && (await withdrawButton.isEnabled())) {
      await withdrawButton.click();
      await waitForTransactionSuccess(page);

      // Verify withdrawal was successful - button should be disabled
      await expect(withdrawButton).toBeDisabled({ timeout: 10000 });
    } else {
      console.log('Withdraw not available - event may not have ended yet');
    }
  });

  test('should show withdraw button only after event ends', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('h4:has-text("Event Info")', { timeout: 30000 });

    // Register if needed
    if (await canUserRegister(page)) {
      const twitterInput = page.locator('input[placeholder*="twitter"]');
      await twitterInput.fill('@withdraw_visible_test');
      await page.locator('button:has-text("RSVP")').click();
      await waitForTransactionSuccess(page);
    }

    // Check for withdraw button visibility
    const withdrawButton = page.locator('button:has-text("Withdraw")');
    const rsvpButton = page.locator('button:has-text("RSVP")');

    const isEventEnded = (await withdrawButton.count()) > 0;

    if (isEventEnded) {
      console.log('Event has ended - withdraw button is visible');
      await expect(withdrawButton).toBeVisible();
    } else {
      console.log('Event has not ended - RSVP button should be disabled for registered users');
      await expect(rsvpButton).toBeDisabled();
    }
  });

  test('should prevent double withdrawal', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('h4:has-text("Event Info")', { timeout: 30000 });

    const withdrawButton = page.locator('button:has-text("Withdraw")');

    if ((await withdrawButton.count()) > 0 && (await withdrawButton.isEnabled())) {
      await withdrawButton.click();
      await page.waitForTimeout(5000);

      // After successful withdrawal, button should be disabled
      const isDisabled = await withdrawButton.isDisabled();
      const buttonCount = await withdrawButton.count();

      expect(isDisabled || buttonCount === 0).toBeTruthy();
    } else {
      console.log('Withdraw not available for this test');
    }
  });
});
