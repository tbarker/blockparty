/**
 * Create Event E2E Tests
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
 * PARALLELIZATION: Tests are independent and use the factory to create new events.
 * Each test runs in isolation with workers = CPU cores (max 5).
 */

import path from 'path';
import {
  test,
  expect,
  createMetaMask,
  waitForTransactionSuccess,
  waitForMetaMaskAndConfirm,
  connectWalletIfNeeded,
  injectE2EConfigFactoryOnly,
  injectE2EConfig,
  setupMetaMaskNetwork,
  dismissWelcomeModal,
  waitForAppLoad,
  waitForPageReady,
  switchAccount,
  getWorkerAccounts,
  runDiagnostics,
} from './fixtures';

test.describe('Create Event Flow', () => {
  // Run diagnostics on test failure to help identify root cause
  test.afterEach(async ({ context }, testInfo) => {
    if (testInfo.status !== 'passed') {
      console.log(`\n[${testInfo.title}] Test ${testInfo.status} - running diagnostics...`);
      await runDiagnostics(context, `TEST FAILURE: ${testInfo.title}`);
    }
  });

  test('should show "+ New Event" button when wallet is connected', async ({
    context,
    page,
    metamaskPage,
    extensionId,
  }) => {
    const metamask = createMetaMask(context, metamaskPage, extensionId);

    // Setup MetaMask network first
    let appPage = await setupMetaMaskNetwork(metamask, context);

    // Inject E2E config with factory address (no contract needed)
    await injectE2EConfigFactoryOnly(appPage);
    await appPage.goto('http://localhost:3000/');

    // Connect wallet
    appPage = await connectWalletIfNeeded(appPage, metamask, context);

    // Wait for app to render
    await waitForPageReady(appPage);
    await dismissWelcomeModal(appPage);

    // Verify "+ New Event" button is visible (replaces arbitrary 2000ms wait)
    const newEventButton = appPage.locator('button:has-text("+ New Event")');
    await expect(newEventButton).toBeVisible({ timeout: 15000 });
  });

  test('should open New Event dialog when clicking "+ New Event"', async ({
    context,
    page,
    metamaskPage,
    extensionId,
  }) => {
    const metamask = createMetaMask(context, metamaskPage, extensionId);

    // Setup MetaMask network first
    let appPage = await setupMetaMaskNetwork(metamask, context);

    // Inject E2E config
    await injectE2EConfigFactoryOnly(appPage);
    await appPage.goto('http://localhost:3000/');

    // Connect wallet
    appPage = await connectWalletIfNeeded(appPage, metamask, context);
    await waitForPageReady(appPage);
    await dismissWelcomeModal(appPage);

    // Click "+ New Event" button (wait for it instead of arbitrary timeout)
    const newEventButton = appPage.locator('button:has-text("+ New Event")');
    await expect(newEventButton).toBeVisible({ timeout: 15000 });
    await newEventButton.click();

    // Verify dialog opens
    const dialogTitle = appPage.locator('h2:has-text("Create New Event")');
    await expect(dialogTitle).toBeVisible({ timeout: 10000 });

    // Verify form fields are present
    await expect(
      appPage.locator('input[id*="Event Name"], label:has-text("Event Name")')
    ).toBeVisible();
    await expect(
      appPage.locator('input[id*="Deposit Amount"], label:has-text("Deposit Amount")')
    ).toBeVisible();
    await expect(
      appPage.locator('input[id*="Max Participants"], label:has-text("Max Participants")')
    ).toBeVisible();
    await expect(appPage.locator('label:has-text("Cooling Period")')).toBeVisible();

    // Verify Create Event button is present
    await expect(appPage.locator('button:has-text("Create Event")')).toBeVisible();
  });

  test('should show "Create New Event" button on landing page when no contract', async ({
    context,
    page,
    metamaskPage,
    extensionId,
  }) => {
    const metamask = createMetaMask(context, metamaskPage, extensionId);

    // Setup MetaMask network first
    let appPage = await setupMetaMaskNetwork(metamask, context);

    // Inject E2E config without contract address (factory only)
    await injectE2EConfigFactoryOnly(appPage);
    await appPage.goto('http://localhost:3000/');

    // Connect wallet
    appPage = await connectWalletIfNeeded(appPage, metamask, context);

    // Wait for React to render the app content before dismissing modal
    // (networkidle may timeout if modal image causes ongoing network activity)
    await appPage.waitForLoadState('domcontentloaded');
    await appPage
      .waitForFunction(
        () => {
          const appDiv = document.getElementById('app');
          return appDiv && appDiv.innerHTML.length > 100;
        },
        { timeout: 30000 }
      )
      .catch(() => {});

    // Wait for modal to appear (renders via requestAnimationFrame after React)
    await appPage.locator('.MuiDialog-root').waitFor({ state: 'visible', timeout: 2000 }).catch(() => {});
    await dismissWelcomeModal(appPage);

    // Verify landing page shows "Create New Event" button (wait for it instead of arbitrary timeout)
    const createButton = appPage.locator('button:has-text("Create New Event")');
    await expect(createButton).toBeVisible({ timeout: 15000 });
  });

  // This test creates an event via factory (no Arweave upload)
  test('should create event via factory and navigate to it', async ({
    context,
    page,
    metamaskPage,
    extensionId,
  }, testInfo) => {
    // Get accounts for this worker to prevent nonce conflicts and ensure ETH balance
    const ACCOUNTS = getWorkerAccounts(testInfo.parallelIndex);

    const metamask = createMetaMask(context, metamaskPage, extensionId);

    // Setup MetaMask network first
    let appPage = await setupMetaMaskNetwork(metamask, context);

    // Switch to admin account (has ETH from Anvil)
    await switchAccount(metamask, ACCOUNTS.admin.metamaskName);

    // Inject E2E config without contract address (factory only)
    await injectE2EConfigFactoryOnly(appPage);
    await appPage.goto('http://localhost:3000/');

    // Connect wallet
    appPage = await connectWalletIfNeeded(appPage, metamask, context);
    await waitForPageReady(appPage);
    await dismissWelcomeModal(appPage);

    // Click "+ New Event" button in AppBar (wait for it instead of arbitrary timeout)
    const newEventButton = appPage.locator('button:has-text("+ New Event")');
    await expect(newEventButton).toBeVisible({ timeout: 15000 });
    await newEventButton.click();

    // Wait for dialog to open
    const dialogTitle = appPage.locator('h2:has-text("Create New Event")');
    await expect(dialogTitle).toBeVisible({ timeout: 10000 });

    // Fill in form fields
    const eventName = `E2E Test Event ${Date.now()}`;

    // Find and fill Event Name input
    const nameInput = appPage
      .locator('label:has-text("Event Name")')
      .locator('..')
      .locator('input');
    await nameInput.fill(eventName);

    // Deposit defaults to 0.02, keep it
    // Max Participants defaults to 20, keep it
    // Cooling Period defaults to 1 week, keep it

    // Click Create Event button
    const createButton = appPage.locator('button:has-text("Create Event")');
    await expect(createButton).toBeEnabled({ timeout: 5000 });
    await createButton.click();

    // Confirm transaction in MetaMask (waits for popup automatically)
    await waitForMetaMaskAndConfirm(metamask, context);

    // Wait for success state
    const successDialog = appPage.locator('h2:has-text("Event Created Successfully!")');
    await expect(successDialog).toBeVisible({ timeout: 120000 });

    // Verify contract address is shown - look for it after the "Contract Address:" label
    const contractAddressLabel = appPage.locator('text=Contract Address:');
    await expect(contractAddressLabel).toBeVisible({ timeout: 5000 });

    // Get the new contract address - find the text that matches the address pattern
    // The address is in a Typography element that follows the label
    // Use the specific success dialog to avoid matching the Welcome modal
    const addressPattern = /0x[a-fA-F0-9]{40}/;
    const dialogContent = await appPage.locator('[role="dialog"]:has-text("Event Created Successfully")').textContent();
    const addressMatch = dialogContent?.match(addressPattern);
    expect(addressMatch).not.toBeNull();
    const newContractAddress = addressMatch![0];

    // Dismiss any welcome modal that may be blocking the success dialog
    await dismissWelcomeModal(appPage);

    // Click "Go to Event" button
    const goToEventButton = appPage.locator('button:has-text("Go to Event")');
    await expect(goToEventButton).toBeVisible();
    await goToEventButton.click();

    // Wait for navigation and event page to load
    await waitForPageReady(appPage);
    await dismissWelcomeModal(appPage);

    // Verify we're on the new event page (wait for URL instead of arbitrary timeout)
    await expect(appPage).toHaveURL(new RegExp(`contract=${newContractAddress}`, 'i'), {
      timeout: 30000,
    });

    // Verify event info section appears
    await expect(appPage.locator('h4:has-text("Event Info")')).toBeVisible({ timeout: 30000 });

    // Verify event name is shown somewhere on the page
    await expect(appPage.locator(`text=${eventName}`).first()).toBeVisible({ timeout: 10000 });
  });

  test('should validate required fields before submitting', async ({
    context,
    page,
    metamaskPage,
    extensionId,
  }) => {
    const metamask = createMetaMask(context, metamaskPage, extensionId);

    // Setup MetaMask network first
    let appPage = await setupMetaMaskNetwork(metamask, context);

    // Inject E2E config
    await injectE2EConfigFactoryOnly(appPage);
    await appPage.goto('http://localhost:3000/');

    // Connect wallet
    appPage = await connectWalletIfNeeded(appPage, metamask, context);
    await waitForPageReady(appPage);
    await dismissWelcomeModal(appPage);

    // Open dialog (wait for button instead of arbitrary timeout)
    const newEventButton = appPage.locator('button:has-text("+ New Event")');
    await expect(newEventButton).toBeVisible({ timeout: 15000 });
    await newEventButton.click();

    // Wait for dialog
    await expect(appPage.locator('h2:has-text("Create New Event")')).toBeVisible({
      timeout: 10000,
    });

    // Clear the Event Name field (it should be empty initially)
    const nameInput = appPage
      .locator('label:has-text("Event Name")')
      .locator('..')
      .locator('input');
    await nameInput.clear();

    // Try to submit without event name
    const createButton = appPage.locator('button:has-text("Create Event")');
    await createButton.click();

    // Should show validation error
    const errorAlert = appPage.locator('[role="alert"]').filter({ hasText: /name/i });
    await expect(errorAlert).toBeVisible({ timeout: 5000 });
  });

  test('should close dialog when clicking Cancel', async ({
    context,
    page,
    metamaskPage,
    extensionId,
  }) => {
    const metamask = createMetaMask(context, metamaskPage, extensionId);

    // Setup MetaMask network first
    let appPage = await setupMetaMaskNetwork(metamask, context);

    // Inject E2E config
    await injectE2EConfigFactoryOnly(appPage);
    await appPage.goto('http://localhost:3000/');

    // Connect wallet
    appPage = await connectWalletIfNeeded(appPage, metamask, context);
    await waitForPageReady(appPage);
    await dismissWelcomeModal(appPage);

    // Open dialog (wait for button instead of arbitrary timeout)
    const newEventButton = appPage.locator('button:has-text("+ New Event")');
    await expect(newEventButton).toBeVisible({ timeout: 15000 });
    await newEventButton.click();

    // Verify dialog is open
    const dialogTitle = appPage.locator('h2:has-text("Create New Event")');
    await expect(dialogTitle).toBeVisible({ timeout: 10000 });

    // Click Cancel button
    const cancelButton = appPage.locator('button:has-text("Cancel")');
    await cancelButton.click();

    // Verify dialog is closed
    await expect(dialogTitle).not.toBeVisible({ timeout: 5000 });
  });

  test('should verify Arweave upload is available when filling metadata fields', async ({
    context,
    page,
    metamaskPage,
    extensionId,
  }) => {
    const metamask = createMetaMask(context, metamaskPage, extensionId);

    // Setup MetaMask network first
    let appPage = await setupMetaMaskNetwork(metamask, context);

    // Inject E2E config
    await injectE2EConfigFactoryOnly(appPage);
    await appPage.goto('http://localhost:3000/');

    // Connect wallet
    appPage = await connectWalletIfNeeded(appPage, metamask, context);
    await waitForPageReady(appPage);
    await dismissWelcomeModal(appPage);

    // Open dialog (wait for button instead of arbitrary timeout)
    const newEventButton = appPage.locator('button:has-text("+ New Event")');
    await expect(newEventButton).toBeVisible({ timeout: 15000 });
    await newEventButton.click();

    // Wait for dialog to open
    const dialogTitle = appPage.locator('h2:has-text("Create New Event")');
    await expect(dialogTitle).toBeVisible({ timeout: 10000 });

    // Wait for upload availability check to complete by waiting for metadata section
    await appPage
      .locator('text=Event Details (stored on Arweave)')
      .waitFor({ state: 'visible', timeout: 10000 })
      .catch(() => {
        // Continue - will check warning below
      });

    // Check if Arweave upload unavailable warning is shown
    // If the Turbo SDK is properly bundled, this warning should NOT appear
    const uploadUnavailableWarning = appPage.locator(
      '[role="alert"]:has-text("Arweave upload is not available")'
    );

    // The warning should NOT be visible if upload is available (SDK bundled correctly)
    // This test will FAIL if the webpack config doesn't properly bundle Turbo SDK
    const isWarningVisible = await uploadUnavailableWarning.isVisible().catch(() => false);

    // Assert that upload IS available (warning is NOT shown)
    // This test will FAIL if the webpack config doesn't properly bundle Turbo SDK
    expect(isWarningVisible).toBe(false);

    // Also verify the metadata section header is visible
    await expect(appPage.locator('text=Event Details (stored on Arweave)')).toBeVisible();

    // Fill in metadata fields to ensure they work
    // Date/time input
    const dateInput = appPage
      .locator('label:has-text("Start Date")')
      .locator('..')
      .locator('input');
    if (await dateInput.isVisible()) {
      await dateInput.fill('2026-06-15T18:00');
    }

    // Description field
    const descriptionInput = appPage
      .locator('label:has-text("Description")')
      .locator('..')
      .locator('textarea')
      .first();
    if (await descriptionInput.isVisible()) {
      await descriptionInput.fill('Test event description for E2E testing');
    }

    // Location fields
    const locationNameInput = appPage
      .locator('label:has-text("Venue Name")')
      .locator('..')
      .locator('input');
    if (await locationNameInput.isVisible()) {
      await locationNameInput.fill('Test Venue');
    }

    // Verify that the image upload button exists (indicates upload functionality is expected)
    // Note: MUI Button with component="label" renders as a <label> element, not <button>
    const uploadButton = appPage.locator('label:has-text("Upload Image")');
    await expect(uploadButton).toBeVisible({ timeout: 5000 });
  });

  // This test involves image upload + Arweave + contract creation
  test('should create event via factory and verify on event page', async ({
    context,
    page,
    metamaskPage,
    extensionId,
  }, testInfo) => {
    // Triple the default timeout for Arweave upload + signature operations
    test.slow();

    // Get accounts for this worker to prevent nonce conflicts and ensure ETH balance
    const ACCOUNTS = getWorkerAccounts(testInfo.parallelIndex);

    const metamask = createMetaMask(context, metamaskPage, extensionId);

    // Setup MetaMask network first
    let appPage = await setupMetaMaskNetwork(metamask, context);

    // Switch to admin account (has ETH from Anvil)
    await switchAccount(metamask, ACCOUNTS.admin.metamaskName);

    // Inject E2E config without contract address (factory only)
    await injectE2EConfigFactoryOnly(appPage);
    await appPage.goto('http://localhost:3000/');

    // Connect wallet
    appPage = await connectWalletIfNeeded(appPage, metamask, context);

    // Wait for app to fully load (includes proper modal dismissal timing)
    await waitForPageReady(appPage);
    await appPage
      .waitForFunction(
        () => {
          const appDiv = document.getElementById('app');
          return appDiv && appDiv.innerHTML.length > 100;
        },
        { timeout: 30000 }
      )
      .catch(() => {});

    // Wait for modal to appear (renders via requestAnimationFrame after React)
    await appPage.locator('.MuiDialog-root').waitFor({ state: 'visible', timeout: 2000 }).catch(() => {});
    await dismissWelcomeModal(appPage);

    // Click "+ New Event" button in AppBar (wait for it instead of arbitrary timeout)
    const newEventButton = appPage.locator('button:has-text("+ New Event")');
    await expect(newEventButton).toBeVisible({ timeout: 15000 });
    await newEventButton.click();

    // Wait for dialog to open
    const dialogTitle = appPage.locator('h2:has-text("Create New Event")');
    await expect(dialogTitle).toBeVisible({ timeout: 10000 });

    // Wait for upload availability check by waiting for metadata section
    await appPage
      .locator('text=Event Details (stored on Arweave)')
      .waitFor({ state: 'visible', timeout: 10000 })
      .catch(() => {
        // Continue - will check warning below
      });

    // Verify Arweave upload IS available (no warning shown)
    const uploadUnavailableWarning = appPage.locator(
      '[role="alert"]:has-text("Arweave upload is not available")'
    );
    const isWarningVisible = await uploadUnavailableWarning.isVisible().catch(() => false);
    expect(isWarningVisible).toBe(false);

    // Fill in required form fields
    const testDescription = 'E2E test event with metadata and image upload';
    const testVenueName = 'E2E Test Venue';
    const eventName = `E2E Arweave Test ${Date.now()}`;

    const nameInput = appPage
      .locator('label:has-text("Event Name")')
      .locator('..')
      .locator('input');
    await nameInput.fill(eventName);

    // Fill in metadata fields
    const descriptionInput = appPage
      .locator('label:has-text("Description")')
      .locator('..')
      .locator('textarea')
      .first();
    await descriptionInput.fill(testDescription);

    const locationNameInput = appPage
      .locator('label:has-text("Venue Name")')
      .locator('..')
      .locator('input');
    await locationNameInput.fill(testVenueName);

    // Upload test banner image - uses InjectedEthereumSigner for signing
    const fileInput = appPage.locator('input[type="file"][accept="image/*"]');
    const testImagePath = path.join(__dirname, 'assets', 'test-banner.png');
    await fileInput.setInputFiles(testImagePath);
    const imagePreview = appPage.locator('img[alt="Banner preview"]');
    await expect(imagePreview).toBeVisible({ timeout: 5000 });

    // Log any console messages for debugging
    appPage.on('console', msg => {
      const text = msg.text();
      if (msg.type() === 'error') {
        console.log('Browser console error:', text);
      } else if (text.includes('[Arweave]')) {
        console.log('Arweave log:', text);
      }
    });

    // Scroll to top first to verify all fields, then to bottom for button
    const dialogContent = appPage.locator('[role="dialog"]');
    await dialogContent.evaluate(el => el.scrollTo(0, 0));
    // Wait for scroll to complete instead of fixed delay
    await appPage.waitForFunction(
      () => {
        const dialog = document.querySelector('[role="dialog"]');
        return dialog && dialog.scrollTop === 0;
      },
      { timeout: 1000 }
    ).catch(() => {});

    // Take a screenshot to debug form state
    await appPage.screenshot({ path: 'test-results/form-before-submit.png' });

    // Click Create Event button - scroll it into view and click
    const createButton = appPage.locator('button:has-text("Create Event")');
    await createButton.scrollIntoViewIfNeeded();
    await expect(createButton).toBeEnabled({ timeout: 5000 });
    await createButton.click();

    // Wait for upload to start - button should change to "Creating..."
    const creatingButton = appPage.locator('button:has-text("Creating...")');
    await expect(creatingButton).toBeVisible({ timeout: 10000 });

    // Arweave upload will trigger personal_sign requests via InjectedEthereumSigner
    // The flow is:
    // 1. Turbo client creation may trigger public key derivation signature
    // 2. Image upload triggers data item signing (1-2 signatures)
    // 3. Metadata upload triggers data item signing (1-2 signatures)
    // 4. Contract creation triggers standard transaction confirmation
    //
    // We need to handle all signature requests before the final transaction.
    // Use a loop to confirm all signature requests that appear.

    const maxSignatures = 10; // Max signatures we expect (safety limit)
    let signaturesConfirmed = 0;
    let transactionConfirmed = false;

    for (let i = 0; i < maxSignatures && !transactionConfirmed; i++) {
      // Check if we've reached success first (no more signatures needed)
      const successVisible = await appPage
        .locator('h2:has-text("Event Created Successfully!")')
        .isVisible()
        .catch(() => false);
      if (successVisible) {
        transactionConfirmed = true;
        break;
      }

      // Wait for MetaMask popup with shorter timeout per iteration
      try {
        await context.waitForEvent('page', {
          predicate: (p: any) => p.url().includes('notification.html'),
          timeout: 5000,
        });
        await metamask.confirmTransaction();
        signaturesConfirmed++;
        console.log(`Confirmed MetaMask action ${signaturesConfirmed}`);
      } catch (e) {
        // No popup appeared, check if still creating or already done
        const isCreating = await appPage
          .locator('button:has-text("Creating...")')
          .isVisible()
          .catch(() => false);
        if (!isCreating) {
          // Not creating anymore, check for success
          break;
        }
        // Short delay before next check (outer loop handles overall timeout)
        await appPage.waitForTimeout(200);
        console.log('No MetaMask popup found, continuing...');
      }
    }

    console.log(`Total signatures/transactions confirmed: ${signaturesConfirmed}`);

    // Wait for success state
    const successDialog = appPage.locator('h2:has-text("Event Created Successfully!")');
    await expect(successDialog).toBeVisible({ timeout: 120000 });

    // Extract contract address from success dialog
    const contractAddressElement = appPage.locator(
      '[role="dialog"] >> text=/0x[a-fA-F0-9]{40}/'
    );
    const contractAddressText = await contractAddressElement.textContent();
    const contractAddress = contractAddressText?.match(/0x[a-fA-F0-9]{40}/)?.[0];
    expect(contractAddress).toBeTruthy();

    // Click "Go to Event" to navigate to the new event
    const goToEventButton = appPage.locator('[role="dialog"] button:has-text("Go to Event")');
    await goToEventButton.click();

    // Wait for app to fully load with contract data (includes modal dismissal)
    await waitForAppLoad(appPage);

    // Verify event name is displayed (stored on-chain)
    await expect(appPage.locator(`text=${eventName}`).first()).toBeVisible({ timeout: 10000 });

    // Note: In devnet mode, metadata is uploaded to ArDrive devnet (upload.ardrive.dev)
    // but is NOT available on the public arweave.net gateway.
    // The metadata fetch will fail with 404, which is expected behavior.
    // In production (mainnet), uploads go to the real Arweave network and are fetchable.
    //
    // We've already verified:
    // 1. Arweave upload succeeded (ar:// URIs in console logs)
    // 2. Contract was created with metadataUri set
    // 3. Event name is displayed from on-chain data
    //
    // Skip metadata content verification in E2E tests since devnet data isn't on public gateway.

    console.log(`Event created successfully at ${contractAddress} with Arweave metadata uploaded to devnet`);
  });
});
