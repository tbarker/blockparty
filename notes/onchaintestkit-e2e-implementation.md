# OnchainTestKit E2E Implementation Notes

## Overview

OnchainTestKit is Coinbase's wallet testing library that provides an alternative to Synpress for E2E testing with MetaMask. This document describes the implementation and key learnings.

## Key Files

- `playwright.onchaintestkit.config.ts` - Playwright config for OnchainTestKit tests
- `src/__tests__/e2e/config.ts` - Wallet configuration using OnchainTestKit's builder pattern
- `src/__tests__/e2e/fixtures.ts` - Test fixtures integrating OnchainTestKit with MetaMask
- `src/__tests__/e2e/*.spec.ts` - Test suites using OnchainTestKit

## Key Learnings

### 1. MetaMask 12.x Two-Step Connection Flow

MetaMask 12.x introduced a new connection flow:
1. **Step 1**: "Connect" dialog - Select accounts to connect
2. **Step 2**: "Review permissions" dialog - Approve network access permissions

OnchainTestKit's built-in `CONNECT_TO_DAPP` action only handles Step 1 and waits for the page to close. But in MetaMask 12.x, the page doesn't close - it transitions to Step 2. This causes tests to hang.

**Solution**: Created `handleMetaMaskConnection()` function that manually handles both steps:

```typescript
export async function handleMetaMaskConnection(context: any, extensionId: string): Promise<void> {
  // Loop to find and handle MetaMask notification pages
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    // ... find notification page ...

    // Handle Step 1: Click "Connect" button
    if (hasConnect) {
      await connectButton.click();
      continue; // Page transitions to step 2
    }

    // Handle Step 2: Click "Confirm" button
    if (hasConfirm) {
      await confirmButton.click();
      return; // Connection complete
    }
  }
}
```

### 2. Network Configuration is Required

Using `.withNetwork()` in the config is **required** to:
1. Add the local Anvil network to MetaMask (chain ID 1337)
2. Switch MetaMask to use that network

Without this, MetaMask stays on Ethereum Mainnet and tests fail.

```typescript
export const walletConfig = configure()
  .withMetaMask()
  .withSeedPhrase({ seedPhrase: SEED_PHRASE, password: PASSWORD })
  .withNetwork({
    name: 'Localhost',
    chainId: CHAIN_ID,
    symbol: 'ETH',
    rpcUrl: ANVIL_URL,
  })
  .build();
```

### 3. Parallelism Issues

Running multiple workers causes race conditions during MetaMask's network setup. OnchainTestKit's `addNetwork` function has timing issues when multiple tests try to configure networks simultaneously.

**Solution**: Set `maxWorkers = 1` in the Playwright config until this is resolved upstream.

### 4. setupRpcPortInterceptor

The `setupRpcPortInterceptor` redirects HTTP requests from the browser to the Anvil instance. This is useful but **not sufficient** on its own - you still need `.withNetwork()` to configure MetaMask's UI.

## Running Tests

```bash
# Run all OnchainTestKit E2E tests
npm run test:e2e:onchainkit

# Run specific test file
xvfb-run npx playwright test --config playwright.onchaintestkit.config.ts src/__tests__/e2e/registration.spec.ts

# Debug mode (headed browser)
npm run test:e2e:onchainkit:debug
```

## Comparison with Synpress

| Feature | OnchainTestKit | Synpress |
|---------|---------------|----------|
| Setup complexity | Medium | High (needs patching) |
| MetaMask version | 12.8.1 | Various |
| Parallelism | Limited (1 worker) | Limited (2 workers) |
| Connection handling | Manual workaround needed | Built-in |
| Documentation | Sparse | Better |

## Known Issues & Solutions

### 1. Network Setup with `withNetwork()`

OnchainTestKit's `addNetwork` function uses `#networkName` selector which doesn't work reliably with MetaMask 12.8.1.

**Solution**: Created custom `addAnvilNetwork()` function in fixtures.ts that uses the correct selectors:

```typescript
async function addAnvilNetwork(metamaskPage: any): Promise<void> {
  // Uses multiple selector strategies for MetaMask 12.8.1 compatibility
  const networkNameInput = metamaskPage.locator(
    'input[placeholder="Enter network name"], #networkName, input[name="networkName"]'
  ).first();
  // ...
}
```

### 2. MetaMask 12.x Two-Step Connection Flow

OnchainTestKit's `CONNECT_TO_DAPP` waits for page to close, but MetaMask 12.x transitions to permissions dialog instead.

**Solution**: Created `handleMetaMaskConnection()` that handles both dialogs.

### 3. Parallelism Issues

Running multiple workers causes race conditions during MetaMask's network setup.

**Solution**: Set `maxWorkers = 1` in Playwright config.

### 4. Account Switching Limitations

MetaMask only creates one account by default from seed phrase. Tests can't easily switch to different accounts without creating them first.

**Solution**: Update tests to not rely on account switching, or accept that all tests run as the same account.

## Test Status

- `registration.spec.ts`: 5/5 tests passing
- `attendance.spec.ts`: 6/6 tests passing
- Total: **11/11 tests passing**
