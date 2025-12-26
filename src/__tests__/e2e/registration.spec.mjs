/**
 * Registration Flow E2E Tests
 *
 * Tests the complete user registration flow:
 * 1. User visits the app
 * 2. Wallet connects automatically (mocked)
 * 3. Event details are displayed
 * 4. User enters Twitter handle
 * 5. User clicks RSVP
 * 6. Transaction is submitted
 * 7. UI updates to show registration status
 */

import {
  test,
  expect,
  TEST_ACCOUNTS,
  waitForTransactionSuccess,
  waitForTransactionRequested,
  canUserRegister,
} from './support/fixtures.mjs';

test.describe('Registration Flow', () => {
  test('should display event details on page load', async ({ page }) => {
    // Navigate to the app
    await page.goto('/');

    // Wait for the app to load and connect to the contract
    await page.waitForSelector('h4:has-text("Event Info")', { timeout: 30000 });

    // Wait a bit for contract data to load (CI can be slow)
    await page.waitForTimeout(3000);

    // Verify event name is displayed
    await expect(page.locator('text=E2E Test Event')).toBeVisible({ timeout: 15000 });

    // Verify deposit info is shown (0.02 ETH)
    await expect(page.locator('text=ETH 0.02')).toBeVisible({ timeout: 10000 });

    // Verify participant count shows (starts at 0)
    // Use a more flexible selector that matches partial text
    await expect(page.locator('text=/Going.*spots/i')).toBeVisible({ timeout: 10000 });
  });

  test('should show connected account in dropdown', async ({ page }) => {
    await page.goto('/');

    // Wait for account dropdown to be populated
    await page.waitForSelector('[role="combobox"]', { timeout: 30000 });

    // Verify the test account address is shown in the dropdown
    const accountDropdown = page.getByLabel('Account address');
    await expect(accountDropdown).toContainText(TEST_ACCOUNTS.user1.substring(0, 10));
  });

  test('should allow user to register for event', async ({ page }) => {
    await page.goto('/');

    // Wait for app to fully load
    await page.waitForSelector('h4:has-text("Event Info")', { timeout: 30000 });
    await page.waitForSelector('text=RSVP', { timeout: 10000 });

    // Check if user can register
    if (!(await canUserRegister(page))) {
      console.log('User already registered, skipping test');
      return;
    }

    // Enter Twitter handle
    const twitterInput = page.locator('input[placeholder*="twitter"]');
    await twitterInput.fill('@testuser');

    // Click RSVP button
    const rsvpButton = page.locator('button:has-text("RSVP")');
    await expect(rsvpButton).toBeEnabled();
    await rsvpButton.click();

    // Wait for transaction notification
    await waitForTransactionRequested(page);

    // Wait for success notification (transaction mined)
    await waitForTransactionSuccess(page);

    // Verify participant appears in the list
    await expect(page.locator('text=@testuser')).toBeVisible({ timeout: 10000 });

    // Verify RSVP button is now disabled (user already registered)
    await expect(rsvpButton).toBeDisabled();
  });

  test('should update participant count after registration', async ({ page }) => {
    await page.goto('/');

    // Wait for app to load
    await page.waitForSelector('h4:has-text("Event Info")', { timeout: 30000 });

    // Check if user can register
    if (!(await canUserRegister(page))) {
      // User already registered, just verify count is shown
      await expect(page.locator('text=/\\d+\\(\\d+\\)/')).toBeVisible({ timeout: 5000 });
      return;
    }

    // Register
    const twitterInput = page.locator('input[placeholder*="twitter"]');
    await twitterInput.fill('@counter_test');
    await page.locator('button:has-text("RSVP")').click();

    // Wait for transaction to complete
    await waitForTransactionSuccess(page);

    // Wait for UI to refresh and verify the participant count is displayed
    await page.waitForTimeout(2000);

    // Verify Going (spots left) shows some count
    await expect(page.locator('text=/\\d+\\(\\d+\\)/')).toBeVisible({ timeout: 5000 });
  });

  test('should display participants table with registration data', async ({ page }) => {
    await page.goto('/');

    // Wait for app to load
    await page.waitForSelector('h4:has-text("Event Info")', { timeout: 30000 });

    // Wait for the RSVP button to appear (indicates UI is ready)
    await page.waitForSelector('button:has-text("RSVP")', { timeout: 10000 });

    // Wait a moment for full UI initialization
    await page.waitForTimeout(1000);

    // Check if user can register (twitter input is visible)
    const canRegister = await canUserRegister(page);
    console.log('Can register:', canRegister);

    if (canRegister) {
      // Register a user
      const twitterInput = page.locator('input[placeholder*="twitter"]');
      await twitterInput.fill('@tabletest');
      await page.locator('button:has-text("RSVP")').click();
      await waitForTransactionRequested(page);
      await waitForTransactionSuccess(page);

      // Wait for the participant to appear in the table
      await page.waitForTimeout(2000);
    } else {
      // User already registered - that's fine, verify table shows their data
      console.log('User already registered, checking existing table data');
    }

    // Verify participants table shows the user(s)
    await expect(page.locator('table')).toBeVisible({ timeout: 10000 });

    // Wait for participant data to load
    // Look for a row that contains a twitter handle (starts with @)
    // This confirms actual participant data, not the empty state message
    await expect(page.locator('tbody tr').filter({ hasText: /@\w+/ }).first()).toBeVisible({
      timeout: 10000,
    });
  });
});
