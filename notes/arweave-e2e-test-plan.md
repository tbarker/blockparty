# E2E Test Plan: Arweave Metadata Upload Verification

## Status: IMPLEMENTED

The test coverage described in this plan has been implemented in `src/__tests__/e2e-synpress/createEvent.spec.ts` - specifically in the test "should create event with metadata and image, then verify on event page".

## Overview

This test will verify the complete flow of creating an event with metadata (including an image), uploading to Arweave devnet via ArDrive Turbo, and verifying the metadata is readable by the UX.

## Test Requirements

### Prerequisites
- Wallet seed phrase (provided via `ARWEAVE_SEED_PHRASE` env var)
- Sepolia testnet RPC access
- **Note**: Files under 105KB are free on ArDrive Turbo - no ETH or credits needed

### Test Scope
1. Create a new event through the UX
2. Fill in metadata fields (name, description, date, location)
3. Upload a test banner image
4. Submit and confirm Arweave upload to devnet
5. Confirm contract creation transaction
6. Navigate to the new event page
7. Verify metadata is fetched and displayed from Arweave gateway

---

## Implementation Plan

### Phase 1: Environment & Configuration

#### 1.1 New Environment Variables

```bash
# Required for Arweave upload test
ARWEAVE_SEED_PHRASE="word1 word2 ... word12"  # Wallet with Sepolia ETH
SEPOLIA_RPC_URL="https://rpc.sepolia.org"     # Optional, has default
```

#### 1.2 New Wallet Setup File

Create `src/__tests__/e2e-synpress/wallet-setup/arweave.setup.js`:

```javascript
import { defineWalletSetup } from '@synthetixio/synpress';
import { MetaMask } from '@synthetixio/synpress/playwright';

// Use seed phrase from environment
const SEED_PHRASE = process.env.ARWEAVE_SEED_PHRASE;
const PASSWORD = 'BlockPartyArweaveTest!';

if (!SEED_PHRASE) {
  throw new Error('ARWEAVE_SEED_PHRASE environment variable is required');
}

export default defineWalletSetup(PASSWORD, async (context, walletPage) => {
  const metamask = new MetaMask(context, walletPage, PASSWORD);

  // Import wallet from seed phrase
  await metamask.importWallet(SEED_PHRASE);

  // Add Sepolia network
  await metamask.addNetwork({
    name: 'Sepolia',
    rpcUrl: process.env.SEPOLIA_RPC_URL || 'https://rpc.sepolia.org',
    chainId: 11155111,
    symbol: 'ETH',
    blockExplorerUrl: 'https://sepolia.etherscan.io',
  });

  // Switch to Sepolia
  await metamask.switchNetwork('Sepolia');
});
```

#### 1.3 Test Image Asset

Add test image at `src/__tests__/e2e-synpress/assets/test-banner.png`:
- Small PNG image (~50KB to minimize upload cost)
- Could be a simple BlockParty logo or gradient

---

### Phase 2: New Fixture Helpers

#### 2.1 Update `fixtures.ts`

Add new helpers for Arweave-enabled tests:

```typescript
/**
 * Inject config that enables Arweave uploads (no __E2E_CONFIG__)
 * Only sets factory address for event creation
 */
export async function injectArweaveTestConfig(page: Page) {
  const factoryAddress = E2E_STATE.factoryAddress;

  await page.addInitScript((factory) => {
    // Set localStorage for Turbo devnet mode
    window.localStorage.setItem('turbo_devnet', 'true');

    // Expose factory address without E2E config (enables uploads)
    window.__ARWEAVE_TEST_CONFIG__ = {
      factoryAddress: factory,
    };
  }, factoryAddress);
}

/**
 * Setup MetaMask for Sepolia network (not Anvil)
 */
export async function setupSepoliaNetwork(
  metamask: MetaMask,
  context: BrowserContext
): Promise<Page> {
  const sepoliaNetwork = {
    name: 'Sepolia',
    rpcUrl: process.env.SEPOLIA_RPC_URL || 'https://rpc.sepolia.org',
    chainId: 11155111,
    symbol: 'ETH',
    blockExplorerUrl: 'https://sepolia.etherscan.io',
  };

  await metamask.addNetwork(sepoliaNetwork);
  await metamask.switchNetwork('Sepolia');

  // Open app page
  const appPage = await context.newPage();
  return appPage;
}

/**
 * Wait for Arweave upload progress indicator
 */
export async function waitForArweaveUploadComplete(
  page: Page,
  timeout = 120000
): Promise<void> {
  // Wait for upload progress to appear then disappear
  const progressText = page.locator('text=/Uploading.*Arweave/i');

  // Wait for upload to start (may not always show)
  try {
    await progressText.waitFor({ state: 'visible', timeout: 10000 });
  } catch {
    // Upload may be fast, continue
  }

  // Wait for upload confirmation step
  const confirmingText = page.locator('text=/Waiting for Arweave/i');
  try {
    await confirmingText.waitFor({ state: 'visible', timeout: 30000 });
    // Wait for it to disappear (upload confirmed)
    await confirmingText.waitFor({ state: 'hidden', timeout: timeout });
  } catch {
    // May have completed quickly
  }
}

/**
 * Wait for metadata to be displayed on event page
 */
export async function waitForMetadataDisplay(
  page: Page,
  expectedDescription: string,
  timeout = 60000
): Promise<void> {
  const descriptionElement = page.locator(`text=${expectedDescription}`);
  await descriptionElement.waitFor({ state: 'visible', timeout });
}
```

---

### Phase 3: Test Specification

#### 3.1 New Test File

Create `src/__tests__/e2e-synpress/arweaveUpload.spec.ts`:

```typescript
/**
 * Arweave Metadata Upload E2E Tests
 *
 * These tests verify the complete flow of uploading event metadata
 * (including images) to Arweave devnet and reading it back in the UX.
 *
 * REQUIREMENTS:
 * - ARWEAVE_SEED_PHRASE env var with a wallet that has Sepolia ETH
 * - Network access to Sepolia RPC and ArDrive devnet services
 *
 * NOTE: These tests interact with real Arweave devnet and cost
 * Turbo credits. Run sparingly and only when testing Arweave integration.
 */

import { test, expect } from './fixtures';
import path from 'path';

// Skip if seed phrase not provided
const SKIP_ARWEAVE_TESTS = !process.env.ARWEAVE_SEED_PHRASE;

test.describe('Arweave Metadata Upload', () => {
  test.skip(SKIP_ARWEAVE_TESTS, 'ARWEAVE_SEED_PHRASE not provided');

  test.describe.configure({ mode: 'serial' }); // Run tests in order

  let createdContractAddress: string;
  const testEventName = `Arweave Test Event ${Date.now()}`;
  const testDescription = `E2E test description ${Date.now()}`;
  const testVenueName = 'E2E Test Venue';
  const testVenueAddress = '123 Test Street, Testville';

  test('should create event with metadata and image uploaded to Arweave devnet', async ({
    context,
    metamaskPage,
    extensionId,
  }) => {
    const metamask = createMetaMask(context, metamaskPage, extensionId);

    // Setup for Sepolia (not Anvil)
    let appPage = await setupSepoliaNetwork(metamask, context);

    // Inject config that enables Arweave uploads
    await injectArweaveTestConfig(appPage);
    await appPage.goto('http://localhost:3000/');

    // Connect wallet
    appPage = await connectWalletIfNeeded(appPage, metamask, context);
    await appPage.waitForLoadState('networkidle');
    await dismissWelcomeModal(appPage);
    await appPage.waitForTimeout(2000);

    // Verify network is Sepolia (chain ID 11155111)
    const networkLabel = appPage.locator('[data-testid="network-label"]');
    await expect(networkLabel).toContainText(/sepolia/i, { timeout: 10000 });

    // Click "+ New Event" button
    const newEventButton = appPage.locator('button:has-text("+ New Event")');
    await expect(newEventButton).toBeVisible({ timeout: 15000 });
    await newEventButton.click();

    // Wait for dialog
    await expect(appPage.locator('h2:has-text("Create New Event")')).toBeVisible();

    // Verify Arweave upload IS available (no warning)
    await appPage.waitForTimeout(2000); // Wait for availability check
    const uploadWarning = appPage.locator('[role="alert"]:has-text("Arweave upload is not available")');
    const warningVisible = await uploadWarning.isVisible().catch(() => false);
    expect(warningVisible).toBe(false);

    // Fill required fields
    const nameInput = appPage.locator('label:has-text("Event Name")').locator('..').locator('input');
    await nameInput.fill(testEventName);

    // Fill metadata fields
    const descriptionInput = appPage.locator('label:has-text("Description")').locator('..').locator('textarea').first();
    await descriptionInput.fill(testDescription);

    const venueNameInput = appPage.locator('label:has-text("Venue Name")').locator('..').locator('input');
    await venueNameInput.fill(testVenueName);

    const venueAddressInput = appPage.locator('label:has-text("Address")').locator('..').locator('input');
    await venueAddressInput.fill(testVenueAddress);

    // Set date (tomorrow)
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateInput = appPage.locator('label:has-text("Start Date")').locator('..').locator('input');
    await dateInput.fill(tomorrow.toISOString().slice(0, 16));

    // Upload test image
    const fileInput = appPage.locator('input[type="file"][accept="image/*"]');
    const testImagePath = path.join(__dirname, 'assets', 'test-banner.png');
    await fileInput.setInputFiles(testImagePath);

    // Verify image preview appears
    const imagePreview = appPage.locator('img[alt="Banner preview"]');
    await expect(imagePreview).toBeVisible({ timeout: 5000 });

    // Submit form
    const createButton = appPage.locator('button:has-text("Create Event")');
    await expect(createButton).toBeEnabled();
    await createButton.click();

    // Wait for Arweave upload to complete
    // This involves multiple steps:
    // 1. "Uploading metadata to Arweave..."
    // 2. "Uploading <filename>..."
    // 3. "Waiting for Arweave to confirm upload..."
    await waitForArweaveUploadComplete(appPage, 180000); // 3 minutes for upload

    // Wait for MetaMask transaction popup (contract creation)
    await appPage.waitForTimeout(3000);

    // Confirm transaction
    await metamask.confirmTransaction();

    // Wait for success dialog
    const successDialog = appPage.locator('h2:has-text("Event Created Successfully!")');
    await expect(successDialog).toBeVisible({ timeout: 120000 });

    // Extract contract address
    const dialogContent = await appPage.locator('[role="dialog"]').textContent();
    const addressMatch = dialogContent?.match(/0x[a-fA-F0-9]{40}/);
    expect(addressMatch).not.toBeNull();
    createdContractAddress = addressMatch![0];

    console.log(`Created event at: ${createdContractAddress}`);
  });

  test('should display uploaded metadata on event page', async ({
    context,
    metamaskPage,
    extensionId,
  }) => {
    test.skip(!createdContractAddress, 'No contract address from previous test');

    const metamask = createMetaMask(context, metamaskPage, extensionId);

    // Setup for Sepolia
    let appPage = await setupSepoliaNetwork(metamask, context);

    // Navigate directly to the created event
    await appPage.goto(`http://localhost:3000/?contract=${createdContractAddress}`);

    // Connect wallet
    appPage = await connectWalletIfNeeded(appPage, metamask, context);
    await appPage.waitForLoadState('networkidle');
    await dismissWelcomeModal(appPage);

    // Wait for event info to load
    await expect(appPage.locator('h4:has-text("Event Info")')).toBeVisible({ timeout: 30000 });

    // Verify event name from contract
    await expect(appPage.locator(`text=${testEventName}`).first()).toBeVisible({ timeout: 10000 });

    // Verify metadata was fetched from Arweave
    // Description should be displayed
    await waitForMetadataDisplay(appPage, testDescription, 60000);

    // Venue name should be displayed
    await expect(appPage.locator(`text=${testVenueName}`)).toBeVisible({ timeout: 10000 });

    // Venue address should be displayed
    await expect(appPage.locator(`text=${testVenueAddress}`)).toBeVisible({ timeout: 10000 });

    // Banner image should be displayed (loaded from Arweave gateway)
    const bannerImage = appPage.locator('img[src*="arweave.net"]');
    await expect(bannerImage).toBeVisible({ timeout: 30000 });

    // Verify image actually loaded (not broken)
    const imageLoaded = await bannerImage.evaluate((img: HTMLImageElement) => {
      return img.complete && img.naturalWidth > 0;
    });
    expect(imageLoaded).toBe(true);
  });

  test('should fetch metadata from Arweave gateway directly', async ({
    context,
  }) => {
    test.skip(!createdContractAddress, 'No contract address from previous test');

    // Create a new page to fetch the metadata URI from contract
    const page = await context.newPage();

    // We need to query the contract for the metadataUri
    // This is a read-only call, can be done with any RPC
    const { ethers } = await import('ethers');
    const provider = new ethers.JsonRpcProvider(
      process.env.SEPOLIA_RPC_URL || 'https://rpc.sepolia.org'
    );

    const conferenceAbi = ['function metadataUri() view returns (string)'];
    const contract = new ethers.Contract(createdContractAddress, conferenceAbi, provider);

    const metadataUri = await contract.metadataUri();
    console.log(`Metadata URI: ${metadataUri}`);

    // Should be an ar:// URI
    expect(metadataUri).toMatch(/^ar:\/\/[a-zA-Z0-9_-]+$/);

    // Convert to gateway URL and fetch
    const txId = metadataUri.replace('ar://', '');
    const gatewayUrl = `https://arweave.net/${txId}`;

    const response = await page.request.get(gatewayUrl);
    expect(response.ok()).toBe(true);

    const metadata = await response.json();

    // Verify metadata structure
    expect(metadata.name).toBe(testEventName);
    expect(metadata.description).toBe(testDescription);
    expect(metadata.location?.name).toBe(testVenueName);
    expect(metadata.location?.address).toBe(testVenueAddress);

    // Verify image URI is present
    expect(metadata.images?.banner).toMatch(/^ar:\/\/[a-zA-Z0-9_-]+$/);

    // Verify image is accessible
    const imageTxId = metadata.images.banner.replace('ar://', '');
    const imageUrl = `https://arweave.net/${imageTxId}`;
    const imageResponse = await page.request.get(imageUrl);
    expect(imageResponse.ok()).toBe(true);
    expect(imageResponse.headers()['content-type']).toMatch(/^image\//);

    await page.close();
  });
});
```

---

### Phase 4: Configuration Updates

#### 4.1 Separate Playwright Config for Arweave Tests

Create `playwright.arweave.config.ts`:

```typescript
import { defineConfig } from '@playwright/test';
import baseConfig from './playwright.synpress.config';

export default defineConfig({
  ...baseConfig,

  testDir: './src/__tests__/e2e-synpress',
  testMatch: 'arweaveUpload.spec.ts',

  // Longer timeouts for Arweave operations
  timeout: 300000, // 5 minutes per test
  expect: {
    timeout: 60000,
  },

  // Use Arweave-specific wallet setup
  use: {
    ...baseConfig.use,
    // Will need Synpress-specific config here
  },

  // Don't need Anvil for this test (uses Sepolia)
  globalSetup: undefined,
  globalTeardown: undefined,

  // Web server still needed
  webServer: {
    command: 'npm run start',
    url: 'http://localhost:3000',
    reuseExistingServer: true,
    timeout: 180000,
  },
});
```

#### 4.2 New NPM Script

Add to `package.json`:

```json
{
  "scripts": {
    "test:e2e:arweave": "ARWEAVE_SEED_PHRASE=$ARWEAVE_SEED_PHRASE synpress test --config playwright.arweave.config.ts"
  }
}
```

---

### Phase 5: Code Modifications

#### 5.1 Update `arweaveUpload.js` to Support Test Mode

Modify `isE2ETest()` to allow Arweave-enabled tests:

```javascript
const isE2ETest = () => {
  // Check if we're in E2E test mode that DISABLES uploads
  // __ARWEAVE_TEST_CONFIG__ enables uploads for Arweave-specific tests
  if (typeof window !== 'undefined') {
    if (window.__ARWEAVE_TEST_CONFIG__) {
      return false; // Allow uploads for Arweave tests
    }
    return window.__E2E_CONFIG__ !== undefined;
  }
  return false;
};
```

#### 5.2 Update `src/index.js` to Handle Arweave Test Config

```javascript
// Get factory address from multiple sources
const factoryAddress =
  network_obj?.factory_address ||
  process.env.FACTORY_ADDRESS ||
  (window.__E2E_CONFIG__ && window.__E2E_CONFIG__.factoryAddress) ||
  (window.__ARWEAVE_TEST_CONFIG__ && window.__ARWEAVE_TEST_CONFIG__.factoryAddress);
```

---

### Phase 6: Test Assets

#### 6.1 Create Test Image

Create a minimal test image:
- Path: `src/__tests__/e2e-synpress/assets/test-banner.png`
- Size: **Under 100KB** (hard cap to ensure free tier - ArDrive charges for files over 105KB)
- Dimensions: 800x400 pixels
- Content: Simple gradient or BlockParty logo

```bash
# Can generate with ImageMagick
convert -size 800x400 gradient:blue-purple \
  -gravity center -pointsize 48 -fill white \
  -annotate 0 "BlockParty Test Event" \
  src/__tests__/e2e-synpress/assets/test-banner.png
```

---

## Test Execution

### Running the Test

```bash
# Set seed phrase and run
export ARWEAVE_SEED_PHRASE="your twelve word seed phrase here"
npm run test:e2e:arweave
```

### CI/CD Considerations

For CI environments:
1. Store `ARWEAVE_SEED_PHRASE` as a secret
2. Test image capped at 100KB (free tier limit is 105KB)
3. Can run on every PR since uploads are free

```yaml
# GitHub Actions example
jobs:
  arweave-e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Run Arweave E2E tests
        env:
          ARWEAVE_SEED_PHRASE: ${{ secrets.ARWEAVE_SEED_PHRASE }}
        run: npm run test:e2e:arweave
```

---

## Success Criteria

1. **Event Creation**: Event is created successfully with metadata URI stored in contract
2. **Arweave Upload**: Metadata JSON and image are uploaded to Arweave devnet
3. **Gateway Availability**: Data is accessible via `arweave.net` gateway
4. **UI Display**: Metadata and image are correctly displayed in the event page
5. **Data Integrity**: Fetched metadata matches what was submitted

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Test image too large | Hard cap at 100KB (free tier limit is 105KB) |
| Sepolia RPC rate limits | Use premium RPC endpoint or retry logic |
| Arweave gateway slow | 3-minute timeout on upload confirmation |
| MetaMask popup timing | Explicit waits before transaction confirmation |
| Test flakiness | Serial test execution, proper state sharing |

---

## Estimated Implementation Time

| Task | Time |
|------|------|
| Wallet setup file | 30 min |
| Fixture helpers | 1 hour |
| Test specification | 2 hours |
| Config updates | 30 min |
| Code modifications | 30 min |
| Test assets | 15 min |
| Testing & debugging | 2 hours |
| **Total** | **~7 hours** |

---

## Files to Create/Modify

### New Files
- `src/__tests__/e2e-synpress/wallet-setup/arweave.setup.js`
- `src/__tests__/e2e-synpress/arweaveUpload.spec.ts`
- `src/__tests__/e2e-synpress/assets/test-banner.png`
- `playwright.arweave.config.ts`

### Modified Files
- `src/__tests__/e2e-synpress/fixtures.ts` - Add Arweave test helpers
- `src/util/arweaveUpload.js` - Update `isE2ETest()` to allow Arweave tests
- `src/index.js` - Handle `__ARWEAVE_TEST_CONFIG__`
- `package.json` - Add `test:e2e:arweave` script
