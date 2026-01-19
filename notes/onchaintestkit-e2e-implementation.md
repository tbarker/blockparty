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

All 22 E2E tests passing with per-test Anvil instances:
- `registration.spec.ts`: 5/5 tests passing
- `attendance.spec.ts`: 6/6 tests passing
- `withdrawal.spec.ts`: 3/3 tests passing
- `createEvent.spec.ts`: 8/8 tests passing
- Total: **22/22 tests passing** (24.5m, 1 worker)

## Phase 1 Complete: Per-Test Anvil Instances (2026-01-18)

### Implementation

Each test now gets its own isolated Anvil instance via OnchainTestKit's `LocalNodeManager`:

```typescript
// config.ts
export const walletConfig = configure()
  .withLocalNode({
    chainId: CHAIN_ID,
    minPort: 8546,
    maxPort: 9545,  // Dynamic port allocation
  })
  .withMetaMask()
  .withSeedPhrase({ seedPhrase: SEED_PHRASE, password: PASSWORD })
  // NOTE: Skip .withNetwork() - uses custom addAnvilNetwork() for MetaMask 12.8.1 compatibility
  .build();

// fixtures.ts - node fixture
node: [async ({}, use) => {
  const nodeConfig = walletConfig.nodeConfig;
  if (nodeConfig) {
    const node = new LocalNodeManager(nodeConfig);
    await node.start();
    await use(node);
    await node.stop();
  }
}, { scope: 'test', auto: true }]
```

### Benefits
- Complete test isolation - no shared state between tests
- Each test deploys its own contracts
- Enables future parallelization (currently 1 worker for MetaMask 12.8.1 stability)
- Removed global-setup.cjs - no more shared Anvil instance

### Test Changes
Each test now:
1. Gets `node` fixture with per-test Anvil
2. Uses `getAnvilUrl(node)` to get RPC URL
3. Deploys contracts to its isolated instance

```typescript
test('my test', async ({ page, metamask, node }) => {
  const rpcUrl = getAnvilUrl(node);
  const contractAddress = await deployTestEvent({
    privateKey: ANVIL_ACCOUNTS.deployer.privateKey,
    rpcUrl,  // Uses per-test Anvil
  });
  // ...
});
```

## Network Approval Dialog During Transactions (Added 2026-01-18)

### Problem

When sending transactions to localhost/Anvil networks, MetaMask may show an "Add network" approval dialog with security warnings, even if the network was previously added. This happens because MetaMask detects:
- Chain ID 1337 (common for local development)
- RPC URL pointing to localhost
- Network name/symbol that don't match known providers

The standard `metamask.handleAction(BaseActionType.HANDLE_TRANSACTION, {...})` doesn't handle this dialog - it expects a transaction confirmation dialog directly.

### Solution

Added `handleTransactionWithNetworkApproval()` function in `fixtures.ts` that:
1. First checks for network approval dialogs and clicks "Approve"
2. Then handles the actual transaction confirmation
3. Has fallback logic if the standard OnchainTestKit handler fails

```typescript
export async function handleTransactionWithNetworkApproval(
  metamask: any,
  context: any,
  extensionId: string
): Promise<void> {
  // Check for network approval dialog first
  const networkHandled = await handleNetworkApprovalDialog(context, extensionId, 10);
  if (networkHandled) {
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // Now handle the actual transaction
  await metamask.handleAction(BaseActionType.HANDLE_TRANSACTION, {
    approvalType: ActionApprovalType.APPROVE,
  });
}
```

### Usage

Tests that need to handle transactions should:
1. Import `handleTransactionWithNetworkApproval` from fixtures
2. Add `context` and `extensionId` to the test signature
3. Replace `metamask.handleAction(BaseActionType.HANDLE_TRANSACTION, ...)` with `handleTransactionWithNetworkApproval(metamask, context, extensionId)`

```typescript
test('my test', async ({ page, metamask, context, extensionId }) => {
  // ... click RSVP or other transaction trigger ...
  await handleTransactionWithNetworkApproval(metamask, context, extensionId);
  await waitForTransactionSuccess(page);
});
```
