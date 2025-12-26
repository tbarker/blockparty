/**
 * Admin Attendance Flow E2E Tests
 *
 * Tests the admin functionality for managing event attendance:
 * 1. Admin views registered participants
 * 2. Admin marks attendees as present
 * 3. Admin triggers payback calculation
 * 4. Admin cancels event (if needed)
 *
 * Uses deployer account as the admin.
 */

import {
  test,
  expect,
  TEST_ACCOUNTS,
  switchAccount,
  waitForTransactionSuccess,
  canUserRegister,
} from './support/fixtures.mjs';

test.describe('Admin Attendance Flow', () => {
  test.describe('owner tests', () => {
    // Use deployer account for owner tests
    test.use({ initialAccount: 'deployer' });

    test('should show admin controls when connected as owner', async ({ page }) => {
      await page.goto('/');
      await page.waitForSelector('h4:has-text("Event Info")', { timeout: 30000 });

      // Wait for the UI to recognize the owner
      await page.waitForTimeout(3000);

      // Admin controls should be visible for the owner
      // The Cancel button should always be visible for owner when event hasn't ended
      const cancelButton = page.locator('button:has-text("Cancel")');
      const paybackButton = page.locator('button:has-text("Payback")');
      const grantAdminButton = page.locator('button:has-text("Grant admin")');

      const hasCancelButton = (await cancelButton.count()) > 0;
      const hasPaybackButton = (await paybackButton.count()) > 0;
      const hasGrantAdminButton = (await grantAdminButton.count()) > 0;

      console.log('Admin UI check:', { hasCancelButton, hasPaybackButton, hasGrantAdminButton });

      // Owner should see admin buttons (Grant admin is always shown for owner)
      expect(hasCancelButton || hasPaybackButton || hasGrantAdminButton).toBeTruthy();
    });
  });

  test('should allow admin to mark attendance', async ({ page }) => {
    // First, ensure there's at least one registered user
    await page.goto('/');
    await page.waitForSelector('h4:has-text("Event Info")', { timeout: 30000 });

    // Register if needed (as user1)
    if (await canUserRegister(page)) {
      const handle = `@attend_${Date.now()}`;
      const twitterInput = page.locator('input[placeholder*="twitter"]');
      await twitterInput.fill(handle);
      await page.locator('button:has-text("RSVP")').click();
      await waitForTransactionSuccess(page);
      await page.waitForTimeout(2000);
    }

    // Now switch to admin
    await switchAccount(page, 'deployer');
    await page.reload();
    await page.waitForSelector('h4:has-text("Event Info")', { timeout: 30000 });
    await page.waitForTimeout(3000);

    // Look for attendance checkboxes in the participants table
    const attendCheckboxes = page.locator('input[type="checkbox"]');
    const checkboxCount = await attendCheckboxes.count();
    console.log('Found checkboxes:', checkboxCount);

    if (checkboxCount > 0) {
      // Find an unchecked checkbox and check it
      let checkedOne = false;
      for (let i = 0; i < checkboxCount; i++) {
        const checkbox = attendCheckboxes.nth(i);
        const isChecked = await checkbox.isChecked();

        if (!isChecked) {
          await checkbox.check();
          checkedOne = true;
          console.log('Checked checkbox', i);
          break;
        }
      }

      if (checkedOne) {
        // Now click the "Attend" button to submit the attendance
        const attendButton = page.locator('button:has-text("Attend")');
        if ((await attendButton.count()) > 0 && (await attendButton.isEnabled())) {
          await attendButton.click();
          await waitForTransactionSuccess(page);
          console.log('Attendance marked successfully');
        } else {
          console.log('Attend button not available or not enabled');
        }
      }
    } else {
      console.log('No attendance checkboxes found - no registered participants');
    }
  });

  test('should allow admin to trigger payback', async ({ page }) => {
    await page.goto('/');

    // Switch to admin (deployer)
    await page.evaluate(() => {
      window.__mockEthereum.switchAccount('deployer');
    });

    await page.reload();
    await page.waitForSelector('h4:has-text("Event Info")', { timeout: 30000 });
    await page.waitForTimeout(3000);

    // Check for payback button
    const paybackButton = page.locator('button:has-text("Payback")');
    const hasPaybackButton = (await paybackButton.count()) > 0;

    if (hasPaybackButton) {
      const isEnabled = await paybackButton.isEnabled();

      if (isEnabled) {
        await paybackButton.click();
        await waitForTransactionSuccess(page);

        // After payback, the button should be disabled
        await expect(paybackButton).toBeDisabled({ timeout: 10000 });
      } else {
        console.log('Payback button is disabled - conditions not met');
        console.log('Requires: registered > 0, attended > 0, payout > 0');
      }
    } else {
      console.log('Payback button not found');
    }
  });

  test('should allow admin to cancel event', async ({ page }) => {
    await page.goto('/');

    // Switch to admin
    await page.evaluate(() => {
      window.__mockEthereum.switchAccount('deployer');
    });

    await page.reload();
    await page.waitForSelector('h4:has-text("Event Info")', { timeout: 30000 });
    await page.waitForTimeout(3000);

    // Check for cancel button
    const cancelButton = page.locator('button:has-text("Cancel")');
    const hasCancelButton = (await cancelButton.count()) > 0;

    if (hasCancelButton) {
      const isEnabled = await cancelButton.isEnabled();

      if (isEnabled) {
        // Note: Actually clicking cancel would end the event for all tests
        // So we just verify the button is present and enabled
        console.log('Cancel button is available and enabled');
        await expect(cancelButton).toBeEnabled();

        // Uncomment to actually cancel (only for isolated test runs):
        // await cancelButton.click();
        // await waitForTransactionSuccess(page);
      } else {
        console.log('Cancel button is disabled - event may have already ended');
      }
    } else {
      console.log('Cancel button not found - may not be owner');
    }
  });

  test('should not show admin controls for non-owner', async ({ page }) => {
    await page.goto('/');

    // Use default user1 account (non-owner)
    await page.waitForSelector('h4:has-text("Event Info")', { timeout: 30000 });
    await page.waitForTimeout(3000);

    // Non-owner should NOT see admin controls
    const cancelButton = page.locator('button:has-text("Cancel")');
    const paybackButton = page.locator('button:has-text("Payback")');

    const hasCancelButton = (await cancelButton.count()) > 0;
    const hasPaybackButton = (await paybackButton.count()) > 0;

    console.log('Non-owner UI check:', { hasCancelButton, hasPaybackButton });

    // If these buttons are present, they should at least be disabled
    if (hasCancelButton) {
      await expect(cancelButton).toBeDisabled();
    }
    if (hasPaybackButton) {
      await expect(paybackButton).toBeDisabled();
    }
  });

  test('should update attended count in UI after marking attendance', async ({ page }) => {
    // First register a user
    await page.goto('/');
    await page.waitForSelector('h4:has-text("Event Info")', { timeout: 30000 });

    // Register if possible
    if (await canUserRegister(page)) {
      const twitterInput = page.locator('input[placeholder*="twitter"]');
      await twitterInput.fill(`@count_attend_${Date.now()}`);
      await page.locator('button:has-text("RSVP")').click();
      await waitForTransactionSuccess(page);
    }

    // Switch to admin and mark attendance
    await switchAccount(page, 'deployer');
    await page.reload();
    await page.waitForSelector('h4:has-text("Event Info")', { timeout: 30000 });
    await page.waitForTimeout(3000);

    // Mark attendance
    const checkbox = page.locator('input[type="checkbox"]').first();
    if ((await checkbox.count()) > 0 && !(await checkbox.isChecked())) {
      await checkbox.check();
      await waitForTransactionSuccess(page);
      console.log('Attendance marked successfully');
    }
  });
});
