# Synpress E2E Testing Implementation Notes

## Overview

Implementing E2E tests using Synpress (real MetaMask extension) to replace mock-based tests.

## Status: WORKING

First test passing! Registration flow with real MetaMask is functional.

---

## Key Technical Solutions

### 1. Chrome Version Compatibility

**Problem**: MetaMask Manifest V2 doesn't work with Chromium 1200 (Playwright 1.57)

**Solution**: Use Chromium 1140 (Playwright 1.48.2) via environment variable:

```bash
SYNPRESS_CHROMIUM_PATH=/root/.cache/ms-playwright/chromium-1140/chrome-linux/chrome
```

### 2. Synpress Extension Loading Patch

**Problem**: Synpress only used `--disable-extensions-except` but not `--load-extension`

**Solution**: Patched `node_modules/@synthetixio/synpress-metamask/dist/playwright/index.js`:

```javascript
// BEFORE:
const browserArgs = [`--disable-extensions-except=${metamaskPath}`];

// AFTER:
const browserArgs = [
  `--disable-extensions-except=${metamaskPath}`,
  `--load-extension=${metamaskPath}`,
];
```

Also added executablePath support:

```javascript
const context = await chromium.launchPersistentContext(_contextPath, {
  executablePath: process.env.SYNPRESS_CHROMIUM_PATH || undefined,
  // ... rest
});
```

### 3. E2E Config Injection

App needs contract address via `window.__E2E_CONFIG__`. Implemented in fixtures using `page.addInitScript()`:

```typescript
export async function injectE2EConfig(page: any): Promise<void> {
  await page.addInitScript(
    (config: { contractAddress: string; chainId: number }) => {
      (window as any).__E2E_CONFIG__ = config;
    },
    { contractAddress: E2E_STATE.contractAddress, chainId: E2E_STATE.chainId }
  );
}
```

### 4. Auto-Connection Popup Handling (KEY FIX)

**Problem**: BlockParty auto-requests wallet connection on load, creating a MetaMask notification popup that blocks React from rendering.

**Solution**: Detect and handle the popup in `connectWalletIfNeeded()`:

```typescript
const notificationPage = pages.find((p: any) => p.url().includes('notification.html#connect'));
if (notificationPage) {
  await metamask.connectToDapp();
}
```

### 5. Page Reference Management

After MetaMask operations, need to get correct app page via `getAppPage(context)` which finds the page with `localhost:3000` URL.

---

## Working Test Pattern

```typescript
test('example test', async ({ context, page, metamaskPage, extensionId }) => {
  const metamask = createMetaMask(context, metamaskPage, extensionId);

  // 1. Setup MetaMask network
  let appPage = await setupMetaMaskNetwork(metamask, context);

  // 2. Inject E2E config and navigate
  await injectE2EConfig(appPage);
  await appPage.goto('http://localhost:3000/');

  // 3. Handle wallet connection (auto-popup)
  appPage = await connectWalletIfNeeded(appPage, metamask, context);

  // 4. Wait for app to load
  await waitForAppLoad(appPage);

  // 5. Assertions use appPage, not page
  await expect(appPage.locator('...')).toBeVisible();
});
```

---

## Files Structure

### Test Files (`src/__tests__/e2e-synpress/`)

- `fixtures.ts` - Test fixtures with MetaMask helpers
- `registration.spec.ts` - 5 registration tests
- `attendance.spec.ts` - 6 admin attendance tests
- `withdrawal.spec.ts` - 3 withdrawal tests
- `wallet-setup/basic.setup.js` - MetaMask wallet setup
- `global-setup.cjs` - Starts Anvil, deploys contract
- `global-teardown.cjs` - Cleanup

### Configuration Files

- `playwright.synpress.config.ts` - Playwright config
- `tsconfig.json` - TypeScript config for tests
- `scripts/ensure-synpress-cache.js` - Auto-builds cache if missing
- `scripts/patch-synpress.js` - Applies patches after npm install

---

## NPM Scripts

```json
{
  "postinstall": "node scripts/patch-synpress.js",
  "test:e2e": "node scripts/ensure-synpress-cache.js && xvfb-run npx playwright test --config playwright.synpress.config.ts",
  "test:e2e:debug": "node scripts/ensure-synpress-cache.js && xvfb-run npx playwright test --config playwright.synpress.config.ts --debug",
  "synpress:cache": "xvfb-run npx synpress src/__tests__/e2e-synpress/wallet-setup",
  "synpress:cache:force": "xvfb-run npx synpress src/__tests__/e2e-synpress/wallet-setup --force"
}
```

---

## Running Tests

### In Docker Container

```bash
# Build and start devcontainer
docker build -t blockparty-dev -f .devcontainer/Dockerfile .
docker run -d --name blockparty-test \
  -v $(pwd):/workspaces/blockparty \
  -w /workspaces/blockparty \
  -p 8545:8545 -p 3000:3000 \
  blockparty-dev sleep infinity

# Install dependencies
docker exec blockparty-test bash -c "npm ci"

# Install both Playwright versions (1.57 and 1.48.2)
docker exec blockparty-test bash -c "npx playwright install chromium && npx playwright@1.48.2 install chromium"

# Build Synpress cache
docker exec blockparty-test bash -c "xvfb-run npx synpress src/__tests__/e2e-synpress/wallet-setup"

# Run single test
docker exec -e SYNPRESS_CHROMIUM_PATH=/root/.cache/ms-playwright/chromium-1140/chrome-linux/chrome \
  blockparty-test bash -c "cd /workspaces/blockparty && xvfb-run -a npx playwright test --config playwright.synpress.config.ts --grep 'should display event details'"

# Run all E2E tests
docker exec -e SYNPRESS_CHROMIUM_PATH=/root/.cache/ms-playwright/chromium-1140/chrome-linux/chrome \
  blockparty-test bash -c "cd /workspaces/blockparty && xvfb-run -a npx playwright test --config playwright.synpress.config.ts"
```

### Locally (macOS/Linux with display)

```bash
npm run test:e2e
```

---

## Environment Variables

- `SYNPRESS_CHROMIUM_PATH` - Path to Chromium 1140 for MetaMask MV2 compatibility
- Used in Docker: `/root/.cache/ms-playwright/chromium-1140/chrome-linux/chrome`

---

## Troubleshooting

### MetaMask Not Loading

1. Ensure both Chromium versions are installed
2. Set `SYNPRESS_CHROMIUM_PATH` to Chromium 1140
3. Verify Synpress patches are applied (check `postinstall` script ran)

### React App Not Rendering

1. Check if MetaMask connection popup is blocking
2. Use `connectWalletIfNeeded()` to handle auto-connection
3. Verify `injectE2EConfig()` is called before `goto()`

### Test Timeouts

1. Increase timeout in config if needed
2. Use `await waitForAppLoad(appPage)` before assertions
3. Ensure Anvil is running and contract is deployed

---

## Parallelization

### Configuration

Tests run fully parallel with worker count automatically set to CPU cores (capped at 5):

```typescript
const cpuCount = os.cpus().length;
const maxWorkers = Math.min(cpuCount, 5);
```

### Account Isolation

Each worker gets a dedicated pair of accounts to prevent nonce conflicts:

```typescript
function getWorkerAccounts(parallelIndex: number) {
  const pairIndex = parallelIndex % 5;
  const adminIndex = pairIndex * 2;
  const userIndex = pairIndex * 2 + 1;
  return {
    admin: ALL_ANVIL_ACCOUNTS[adminIndex],
    user: ALL_ANVIL_ACCOUNTS[userIndex],
    deployer: ALL_ANVIL_ACCOUNTS[adminIndex],
  };
}
```

Worker to account mapping:
- Worker 0: Account 1 (admin), User2 (user)
- Worker 1: Admin3 (admin), User4 (user)
- Worker 2: Admin5 (admin), User6 (user)
- Worker 3: Admin7 (admin), User8 (user)
- Worker 4: Admin9 (admin), User10 (user)

### Test Pattern

Each test uses `testInfo.parallelIndex` to get isolated accounts:

```typescript
test('example', async ({ context, ... }, testInfo) => {
  const ACCOUNTS = getWorkerAccounts(testInfo.parallelIndex);

  const contractAddress = await deployTestEvent({
    deployerPrivateKey: ACCOUNTS.admin.privateKey,
  });
  // ...
});
```

### Contract Isolation

Each test deploys its own Conference contract via `deployTestEvent()`, ensuring:
- No shared contract state between tests
- Full isolation even when running in parallel
- Independent event lifecycle per test

---

## CI Stability Fix (January 2026)

### Problem

E2E tests failed consistently in GitHub Actions CI with:
- `"[getNotificationPageAndWaitForLoad] Notification page did not appear after 10000ms and 2 retries."`
- Specifically affected: registration and withdrawal tests with transactions

### Root Cause

RainbowKit/wagmi connection state isn't fully synchronized on first connect in slow CI environments. The initial connection appears successful in the UI, but the internal wallet state isn't fully established before transactions are attempted.

### Solution

Apply double-connect pattern with reload to ensure stable connection:

```typescript
// Connect wallet with reload to ensure stable connection in CI
appPage = await connectWalletIfNeeded(appPage, metamask, context);
await appPage.reload();
appPage = await connectWalletIfNeeded(appPage, metamask, context);
await waitForAppLoad(appPage);
```

This pattern (already used in attendance tests) ensures:
1. First connect establishes RainbowKit/wagmi state and persists to localStorage
2. Reload clears React Query cache and forces fresh initialization
3. Second connect verifies the connection is properly established

Applied to: `registration.spec.ts` and `withdrawal.spec.ts`

---

## Worker Count Limitation (January 2026)

### Problem

With 4 workers (matching CPU count), withdrawal tests failed with "Target page, context or browser has been closed" and READONLY mode in screenshots.

### Root Cause

Higher parallelism (4+ workers) causes:
1. **Resource contention on xvfb** - 4 headful Chrome browsers with MetaMask compete for display resources
2. **wagmi connection timing issues** - Under load, wagmi doesn't fully establish signer before tests proceed
3. **Cumulative resource exhaustion** - Over 10+ minute test runs with many MetaMask popups

### Solution

Cap workers at 2 for stability:

```typescript
// playwright.synpress.config.ts
const maxWorkers = Math.min(cpuCount, 2);
```

Key fixes to `fixtures.ts`:
1. **`ensureWalletConnected`** - Wait for wagmi to sync instead of clicking Disconnect (which breaks connection)
2. **`connectWalletIfNeeded`** - Don't throw error for READONLY mode, just warn
3. **`dismissWelcomeModal`** - Use specific selector `[role="dialog"]:has-text("Welcome to BlockParty")` to avoid matching other dialogs

---

## References

- Synpress docs: https://docs.synpress.io
- MetaMask extension loading: Chrome requires both `--disable-extensions-except` AND `--load-extension`
- Playwright persistent context: Used for extension testing
- RainbowKit connection: May require reload for state synchronization in CI
