/**
 * Create Event E2E Tests
 *
 * Tests the complete event creation flow with real MetaMask:
 * 1. User clicks "+ New Event" button in AppBar
 * 2. Fills in event creation form
 * 3. Submits and confirms MetaMask transaction
 * 4. Event is created via ConferenceFactory
 * 5. User can navigate to the newly created event
 */

import {
  test,
  expect,
  createMetaMask,
  waitForTransactionSuccess,
  connectWalletIfNeeded,
  injectE2EConfigFactoryOnly,
  injectE2EConfig,
  setupMetaMaskNetwork,
  dismissWelcomeModal,
} from './fixtures';

test.describe('Create Event Flow', () => {
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
    await appPage.waitForLoadState('networkidle');
    await dismissWelcomeModal(appPage);
    await appPage.waitForTimeout(2000);

    // Verify "+ New Event" button is visible
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
    await appPage.waitForLoadState('networkidle');
    await dismissWelcomeModal(appPage);
    await appPage.waitForTimeout(2000);

    // Click "+ New Event" button
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
    await appPage.waitForLoadState('networkidle');
    await dismissWelcomeModal(appPage);
    await appPage.waitForTimeout(3000);

    // Verify landing page shows "Create New Event" button
    const createButton = appPage.locator('button:has-text("Create New Event")');
    await expect(createButton).toBeVisible({ timeout: 15000 });
  });

  test('should create event via factory and navigate to it', async ({
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
    await appPage.waitForLoadState('networkidle');
    await dismissWelcomeModal(appPage);
    await appPage.waitForTimeout(2000);

    // Click "+ New Event" button in AppBar
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

    // Wait for MetaMask transaction popup
    await appPage.waitForTimeout(3000);

    // Confirm transaction in MetaMask
    await metamask.confirmTransaction();

    // Wait for success state
    const successDialog = appPage.locator('h2:has-text("Event Created Successfully!")');
    await expect(successDialog).toBeVisible({ timeout: 120000 });

    // Verify contract address is shown - look for it after the "Contract Address:" label
    const contractAddressLabel = appPage.locator('text=Contract Address:');
    await expect(contractAddressLabel).toBeVisible({ timeout: 5000 });

    // Get the new contract address - find the text that matches the address pattern
    // The address is in a Typography element that follows the label
    const addressPattern = /0x[a-fA-F0-9]{40}/;
    const dialogContent = await appPage.locator('[role="dialog"]').textContent();
    const addressMatch = dialogContent?.match(addressPattern);
    expect(addressMatch).not.toBeNull();
    const newContractAddress = addressMatch![0];

    // Click "Go to Event" button
    const goToEventButton = appPage.locator('button:has-text("Go to Event")');
    await expect(goToEventButton).toBeVisible();
    await goToEventButton.click();

    // Wait for navigation and event page to load
    await appPage.waitForLoadState('networkidle');
    await dismissWelcomeModal(appPage);
    await appPage.waitForTimeout(3000);

    // Verify we're on the new event page
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
    await appPage.waitForLoadState('networkidle');
    await dismissWelcomeModal(appPage);
    await appPage.waitForTimeout(2000);

    // Open dialog
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
    await appPage.waitForLoadState('networkidle');
    await dismissWelcomeModal(appPage);
    await appPage.waitForTimeout(2000);

    // Open dialog
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
});
