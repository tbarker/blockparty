/**
 * Create Event E2E Tests (OnchainTestKit)
 *
 * Tests the complete event creation flow with real MetaMask:
 * 1. User clicks "+ New Event" button in AppBar
 * 2. Fills in event creation form (including metadata and banner image)
 * 3. Uploads metadata and image to Arweave devnet
 * 4. Submits and confirms MetaMask transaction
 * 5. Event is created via ConferenceFactory
 * 6. User can navigate to the newly created event
 * 7. Metadata is fetched from Arweave and displayed
 *
 * Uses OnchainTestKit for wallet interactions with shared Anvil instance.
 */

import path from 'path';
import {
  test,
  expect,
  BaseActionType,
  ActionApprovalType,
  ANVIL_URL,
  injectE2EConfigFactoryOnly,
  dismissWelcomeModal,
  waitForAppLoad,
  waitForPageReady,
  waitForTransactionSuccess,
  connectWallet,
} from './fixtures';
import { runDiagnostics } from './diagnostics';

test.describe('Create Event Flow', () => {
  // Run diagnostics on test failure
  test.afterEach(async ({}, testInfo) => {
    if (testInfo.status !== 'passed') {
      console.log(`\n[${testInfo.title}] Test ${testInfo.status} - running diagnostics...`);
      await runDiagnostics(ANVIL_URL, null, `TEST FAILURE: ${testInfo.title}`);
    }
  });

  test('should show "+ New Event" button when wallet is connected', async ({ page, metamask }) => {
    if (!metamask) throw new Error('MetaMask fixture required');

    // Inject E2E config with factory address (no contract needed)
    await injectE2EConfigFactoryOnly(page);
    await page.goto('http://localhost:3000/');

    // Connect wallet
    await connectWallet(page, metamask);
    await waitForPageReady(page);
    await dismissWelcomeModal(page);

    // Verify "+ New Event" button is visible
    const newEventButton = page.locator('button:has-text("+ New Event")');
    await expect(newEventButton).toBeVisible({ timeout: 15000 });
  });

  test('should open New Event dialog when clicking "+ New Event"', async ({ page, metamask }) => {
    if (!metamask) throw new Error('MetaMask fixture required');

    // Inject E2E config
    await injectE2EConfigFactoryOnly(page);
    await page.goto('http://localhost:3000/');

    // Connect wallet
    await connectWallet(page, metamask);
    await waitForPageReady(page);
    await dismissWelcomeModal(page);

    // Click "+ New Event" button
    const newEventButton = page.locator('button:has-text("+ New Event")');
    await expect(newEventButton).toBeVisible({ timeout: 15000 });
    await newEventButton.click();

    // Verify dialog opens
    const dialogTitle = page.locator('h2:has-text("Create New Event")');
    await expect(dialogTitle).toBeVisible({ timeout: 10000 });

    // Verify form fields are present
    await expect(
      page.locator('input[id*="Event Name"], label:has-text("Event Name")')
    ).toBeVisible();
    await expect(
      page.locator('input[id*="Deposit Amount"], label:has-text("Deposit Amount")')
    ).toBeVisible();
    await expect(
      page.locator('input[id*="Max Participants"], label:has-text("Max Participants")')
    ).toBeVisible();
    await expect(page.locator('label:has-text("Cooling Period")')).toBeVisible();

    // Verify Create Event button is present
    await expect(page.locator('button:has-text("Create Event")')).toBeVisible();
  });

  test('should show "Create New Event" button on landing page when no contract', async ({
    page,
    metamask,
  }) => {
    if (!metamask) throw new Error('MetaMask fixture required');

    // Inject E2E config without contract address (factory only)
    await injectE2EConfigFactoryOnly(page);
    await page.goto('http://localhost:3000/');

    // Connect wallet
    await connectWallet(page, metamask);

    // Wait for React to render the app content
    await page.waitForLoadState('domcontentloaded');
    await page
      .waitForFunction(
        () => {
          const appDiv = document.getElementById('app');
          return appDiv && appDiv.innerHTML.length > 100;
        },
        { timeout: 30000 }
      )
      .catch(() => {});

    // Wait for modal to appear
    await page
      .locator('.MuiDialog-root')
      .waitFor({ state: 'visible', timeout: 2000 })
      .catch(() => {});
    await dismissWelcomeModal(page);

    // Verify landing page shows "Create New Event" button
    const createButton = page.locator('button:has-text("Create New Event")');
    await expect(createButton).toBeVisible({ timeout: 15000 });
  });

  test('should create event via factory and navigate to it', async ({ page, metamask }) => {
    if (!metamask) throw new Error('MetaMask fixture required');

    // Inject E2E config without contract address (factory only)
    await injectE2EConfigFactoryOnly(page);
    await page.goto('http://localhost:3000/');

    // Connect wallet (account 0 has ETH from Anvil)
    await connectWallet(page, metamask, { accountIndex: 0 });
    await waitForPageReady(page);
    await dismissWelcomeModal(page);

    // Click "+ New Event" button in AppBar
    const newEventButton = page.locator('button:has-text("+ New Event")');
    await expect(newEventButton).toBeVisible({ timeout: 15000 });
    await newEventButton.click();

    // Wait for dialog to open
    const dialogTitle = page.locator('h2:has-text("Create New Event")');
    await expect(dialogTitle).toBeVisible({ timeout: 10000 });

    // Fill in form fields
    const eventName = `E2E Test Event ${Date.now()}`;

    // Find and fill Event Name input
    const nameInput = page.locator('label:has-text("Event Name")').locator('..').locator('input');
    await nameInput.fill(eventName);

    // Deposit defaults to 0.02, keep it
    // Max Participants defaults to 20, keep it
    // Cooling Period defaults to 1 week, keep it

    // Click Create Event button
    const createButton = page.locator('button:has-text("Create Event")');
    await expect(createButton).toBeEnabled({ timeout: 5000 });
    await createButton.click();

    // Confirm transaction in MetaMask
    await metamask.handleAction(BaseActionType.HANDLE_TRANSACTION, {
      approvalType: ActionApprovalType.APPROVE,
    });

    // Wait for success state
    const successDialog = page.locator('h2:has-text("Event Created Successfully!")');
    await expect(successDialog).toBeVisible({ timeout: 120000 });

    // Verify contract address is shown
    const contractAddressLabel = page.locator('text=Contract Address:');
    await expect(contractAddressLabel).toBeVisible({ timeout: 5000 });

    // Get the new contract address
    const addressPattern = /0x[a-fA-F0-9]{40}/;
    const dialogContent = await page
      .locator('[role="dialog"]:has-text("Event Created Successfully")')
      .textContent();
    const addressMatch = dialogContent?.match(addressPattern);
    expect(addressMatch).not.toBeNull();
    const newContractAddress = addressMatch![0];

    // Dismiss any welcome modal
    await dismissWelcomeModal(page);

    // Click "Go to Event" button
    const goToEventButton = page.locator('button:has-text("Go to Event")');
    await expect(goToEventButton).toBeVisible();
    await goToEventButton.click();

    // Wait for navigation and event page to load
    await waitForPageReady(page);
    await dismissWelcomeModal(page);

    // Verify we're on the new event page
    await expect(page).toHaveURL(new RegExp(`contract=${newContractAddress}`, 'i'), {
      timeout: 30000,
    });

    // Verify event info section appears
    await expect(page.locator('h4:has-text("Event Info")')).toBeVisible({ timeout: 30000 });

    // Verify event name is shown somewhere on the page
    await expect(page.locator(`text=${eventName}`).first()).toBeVisible({ timeout: 10000 });
  });

  test('should validate required fields before submitting', async ({ page, metamask }) => {
    if (!metamask) throw new Error('MetaMask fixture required');

    // Inject E2E config
    await injectE2EConfigFactoryOnly(page);
    await page.goto('http://localhost:3000/');

    // Connect wallet
    await connectWallet(page, metamask);
    await waitForPageReady(page);
    await dismissWelcomeModal(page);

    // Open dialog
    const newEventButton = page.locator('button:has-text("+ New Event")');
    await expect(newEventButton).toBeVisible({ timeout: 15000 });
    await newEventButton.click();

    // Wait for dialog
    await expect(page.locator('h2:has-text("Create New Event")')).toBeVisible({
      timeout: 10000,
    });

    // Clear the Event Name field
    const nameInput = page.locator('label:has-text("Event Name")').locator('..').locator('input');
    await nameInput.clear();

    // Try to submit without event name
    const createButton = page.locator('button:has-text("Create Event")');
    await createButton.click();

    // Should show validation error
    const errorAlert = page.locator('[role="alert"]').filter({ hasText: /name/i });
    await expect(errorAlert).toBeVisible({ timeout: 5000 });
  });

  test('should close dialog when clicking Cancel', async ({ page, metamask }) => {
    if (!metamask) throw new Error('MetaMask fixture required');

    // Inject E2E config
    await injectE2EConfigFactoryOnly(page);
    await page.goto('http://localhost:3000/');

    // Connect wallet
    await connectWallet(page, metamask);
    await waitForPageReady(page);
    await dismissWelcomeModal(page);

    // Open dialog
    const newEventButton = page.locator('button:has-text("+ New Event")');
    await expect(newEventButton).toBeVisible({ timeout: 15000 });
    await newEventButton.click();

    // Verify dialog is open
    const dialogTitle = page.locator('h2:has-text("Create New Event")');
    await expect(dialogTitle).toBeVisible({ timeout: 10000 });

    // Click Cancel button
    const cancelButton = page.locator('button:has-text("Cancel")');
    await cancelButton.click();

    // Verify dialog is closed
    await expect(dialogTitle).not.toBeVisible({ timeout: 5000 });
  });

  test('should verify Arweave upload is available when filling metadata fields', async ({
    page,
    metamask,
  }) => {
    if (!metamask) throw new Error('MetaMask fixture required');

    // Inject E2E config
    await injectE2EConfigFactoryOnly(page);
    await page.goto('http://localhost:3000/');

    // Connect wallet
    await connectWallet(page, metamask);
    await waitForPageReady(page);
    await dismissWelcomeModal(page);

    // Open dialog
    const newEventButton = page.locator('button:has-text("+ New Event")');
    await expect(newEventButton).toBeVisible({ timeout: 15000 });
    await newEventButton.click();

    // Wait for dialog to open
    const dialogTitle = page.locator('h2:has-text("Create New Event")');
    await expect(dialogTitle).toBeVisible({ timeout: 10000 });

    // Wait for upload availability check to complete
    await page
      .locator('text=Event Details (stored on Arweave)')
      .waitFor({ state: 'visible', timeout: 10000 })
      .catch(() => {});

    // Check if Arweave upload unavailable warning is shown
    const uploadUnavailableWarning = page.locator(
      '[role="alert"]:has-text("Arweave upload is not available")'
    );

    // The warning should NOT be visible if upload is available
    const isWarningVisible = await uploadUnavailableWarning.isVisible().catch(() => false);
    expect(isWarningVisible).toBe(false);

    // Also verify the metadata section header is visible
    await expect(page.locator('text=Event Details (stored on Arweave)')).toBeVisible();

    // Fill in metadata fields to ensure they work
    const dateInput = page.locator('label:has-text("Start Date")').locator('..').locator('input');
    if (await dateInput.isVisible()) {
      await dateInput.fill('2026-06-15T18:00');
    }

    const descriptionInput = page
      .locator('label:has-text("Description")')
      .locator('..')
      .locator('textarea')
      .first();
    if (await descriptionInput.isVisible()) {
      await descriptionInput.fill('Test event description for E2E testing');
    }

    const locationNameInput = page
      .locator('label:has-text("Venue Name")')
      .locator('..')
      .locator('input');
    if (await locationNameInput.isVisible()) {
      await locationNameInput.fill('Test Venue');
    }

    // Verify that the image upload button exists
    const uploadButton = page.locator('label:has-text("Upload Image")');
    await expect(uploadButton).toBeVisible({ timeout: 5000 });
  });

  // This test involves image upload + Arweave + contract creation
  test('should create event via factory and verify on event page', async ({ page, metamask }) => {
    if (!metamask) throw new Error('MetaMask fixture required');

    // Triple the default timeout for Arweave upload + signature operations
    test.slow();

    // Inject E2E config without contract address (factory only)
    await injectE2EConfigFactoryOnly(page);
    await page.goto('http://localhost:3000/');

    // Connect wallet (account 0 has ETH from Anvil)
    await connectWallet(page, metamask, { accountIndex: 0 });

    // Wait for app to fully load
    await waitForPageReady(page);
    await page
      .waitForFunction(
        () => {
          const appDiv = document.getElementById('app');
          return appDiv && appDiv.innerHTML.length > 100;
        },
        { timeout: 30000 }
      )
      .catch(() => {});

    // Wait for modal to appear
    await page
      .locator('.MuiDialog-root')
      .waitFor({ state: 'visible', timeout: 2000 })
      .catch(() => {});
    await dismissWelcomeModal(page);

    // Click "+ New Event" button in AppBar
    const newEventButton = page.locator('button:has-text("+ New Event")');
    await expect(newEventButton).toBeVisible({ timeout: 15000 });
    await newEventButton.click();

    // Wait for dialog to open
    const dialogTitle = page.locator('h2:has-text("Create New Event")');
    await expect(dialogTitle).toBeVisible({ timeout: 10000 });

    // Wait for upload availability check
    await page
      .locator('text=Event Details (stored on Arweave)')
      .waitFor({ state: 'visible', timeout: 10000 })
      .catch(() => {});

    // Verify Arweave upload IS available
    const uploadUnavailableWarning = page.locator(
      '[role="alert"]:has-text("Arweave upload is not available")'
    );
    const isWarningVisible = await uploadUnavailableWarning.isVisible().catch(() => false);
    expect(isWarningVisible).toBe(false);

    // Fill in required form fields
    const testDescription = 'E2E test event with metadata and image upload';
    const testVenueName = 'E2E Test Venue';
    const eventName = `E2E Arweave Test ${Date.now()}`;

    const nameInput = page.locator('label:has-text("Event Name")').locator('..').locator('input');
    await nameInput.fill(eventName);

    // Fill in metadata fields
    const descriptionInput = page
      .locator('label:has-text("Description")')
      .locator('..')
      .locator('textarea')
      .first();
    await descriptionInput.fill(testDescription);

    const locationNameInput = page
      .locator('label:has-text("Venue Name")')
      .locator('..')
      .locator('input');
    await locationNameInput.fill(testVenueName);

    // Upload test banner image
    const fileInput = page.locator('input[type="file"][accept="image/*"]');
    const testImagePath = path.join(__dirname, 'assets', 'test-banner.png');
    await fileInput.setInputFiles(testImagePath);
    const imagePreview = page.locator('img[alt="Banner preview"]');
    await expect(imagePreview).toBeVisible({ timeout: 5000 });

    // Log console messages for debugging
    page.on('console', (msg) => {
      const text = msg.text();
      if (msg.type() === 'error') {
        console.log('Browser console error:', text);
      } else if (text.includes('[Arweave]')) {
        console.log('Arweave log:', text);
      }
    });

    // Scroll to top then bottom
    const dialogContent = page.locator('[role="dialog"]');
    await dialogContent.evaluate((el) => el.scrollTo(0, 0));
    await page
      .waitForFunction(
        () => {
          const dialog = document.querySelector('[role="dialog"]');
          return dialog && dialog.scrollTop === 0;
        },
        { timeout: 1000 }
      )
      .catch(() => {});

    // Take a screenshot to debug form state
    await page.screenshot({ path: 'test-results/form-before-submit.png' });

    // Click Create Event button
    const createButton = page.locator('button:has-text("Create Event")');
    await createButton.scrollIntoViewIfNeeded();
    await expect(createButton).toBeEnabled({ timeout: 5000 });
    await createButton.click();

    // Wait for upload to start
    const creatingButton = page.locator('button:has-text("Creating...")');
    await expect(creatingButton).toBeVisible({ timeout: 10000 });

    // Handle all signature requests for Arweave + contract creation
    const maxSignatures = 10;
    let signaturesConfirmed = 0;
    let transactionConfirmed = false;

    for (let i = 0; i < maxSignatures && !transactionConfirmed; i++) {
      // Check if we've reached success first
      const successVisible = await page
        .locator('h2:has-text("Event Created Successfully!")')
        .isVisible()
        .catch(() => false);
      if (successVisible) {
        transactionConfirmed = true;
        break;
      }

      // Try to handle any pending MetaMask action
      try {
        await metamask.handleAction(BaseActionType.HANDLE_TRANSACTION, {
          approvalType: ActionApprovalType.APPROVE,
        });
        signaturesConfirmed++;
        console.log(`Confirmed MetaMask action ${signaturesConfirmed}`);
      } catch {
        // No pending action, check if still creating
        const isCreating = await page
          .locator('button:has-text("Creating...")')
          .isVisible()
          .catch(() => false);
        if (!isCreating) {
          break;
        }
        await page.waitForTimeout(200);
        console.log('No MetaMask popup found, continuing...');
      }
    }

    console.log(`Total signatures/transactions confirmed: ${signaturesConfirmed}`);

    // Wait for success state
    const successDialog = page.locator('h2:has-text("Event Created Successfully!")');
    await expect(successDialog).toBeVisible({ timeout: 120000 });

    // Extract contract address from success dialog
    const contractAddressElement = page.locator('[role="dialog"] >> text=/0x[a-fA-F0-9]{40}/');
    const contractAddressText = await contractAddressElement.textContent();
    const contractAddress = contractAddressText?.match(/0x[a-fA-F0-9]{40}/)?.[0];
    expect(contractAddress).toBeTruthy();

    // Click "Go to Event" to navigate to the new event
    const goToEventButton = page.locator('[role="dialog"] button:has-text("Go to Event")');
    await goToEventButton.click();

    // Wait for app to fully load with contract data
    await waitForAppLoad(page);

    // Verify event name is displayed
    await expect(page.locator(`text=${eventName}`).first()).toBeVisible({ timeout: 10000 });

    console.log(
      `Event created successfully at ${contractAddress} with Arweave metadata uploaded to devnet`
    );
  });
});
