# OnchainTestKit Documentation Notes

## Overview

OnchainTestKit is a comprehensive, type-safe framework for end-to-end testing of blockchain applications. It integrates with Playwright for browser automation and supports MetaMask and Coinbase Wallet.

## Key Features

1. **Playwright Integration** - Automates browser-based wallet and dApp interactions
2. **Multi-Wallet Support** - Built-in support for MetaMask and Coinbase Wallet
3. **Smart Action Handling** - Automates connect, transaction, signature, approval, and network switching workflows
4. **Network Management** - Supports local Anvil nodes or remote RPC endpoints with dynamic port allocation
5. **Fluent Configuration** - Builder pattern for intuitive wallet and node setup

## Fluent Configuration API

The core pattern uses `configure()` with chainable methods:

```typescript
import { configure, createOnchainTest } from '@coinbase/onchaintestkit';

const config = configure()
  .withLocalNode({ chainId: 1337 })
  .withMetaMask()
  .withNetwork({
    name: 'Base Sepolia',
    rpcUrl: 'http://localhost:8545',
    chainId: 84532,
    symbol: 'ETH',
  })
  .withSeedPhrase({
    seedPhrase: process.env.E2E_TEST_SEED_PHRASE!,
    password: 'PASSWORD',
  })
  .build();

const test = createOnchainTest(config);
```

### Configuration Options

#### Local Node Configuration
```typescript
.withLocalNode({
  chainId: 1337,                          // Required
  forkUrl: "https://mainnet.base.org",   // Optional - fork from mainnet
  forkBlockNumber: BigInt("12345678"),   // Optional
  hardfork: "cancun",                     // Optional
  minPort: 9545,                          // Optional - port range
  maxPort: 9645,                          // Optional
})
```

#### Network Configuration
```typescript
.withNetwork({
  name: "My Custom Network",
  chainId: 12345,
  symbol: "ETH",
  rpcUrl: "https://my-rpc-endpoint.com",
  isTestnet: true,  // Optional
})
```

#### Custom Setup (for advanced scenarios)
```typescript
.withCustomSetup(async (wallet, context) => {
  // Import additional accounts
  await wallet.handleAction(BaseActionType.IMPORT_WALLET_FROM_PRIVATE_KEY, {
    privateKey: process.env.SECONDARY_PRIVATE_KEY!,
  });

  // Add custom tokens
  await wallet.handleAction(MetaMaskSpecificActionType.ADD_TOKEN, {
    tokenAddress: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    tokenSymbol: 'USDC',
    tokenDecimals: 6,
  });
})
```

## Test Fixtures

Tests automatically receive these fixtures:

- **page** (Page): Playwright browser automation object
- **metamask** (MetaMask): Wallet automation interface
- **coinbase** (CoinbaseWallet): Coinbase wallet interface (if configured)
- **node** (LocalNodeManager): Local blockchain node manager
- **smartContractManager**: Contract deployment and interaction

## Base Action Types

The `BaseActionType` enum provides standardized wallet actions:

| Action | Description |
|--------|-------------|
| `IMPORT_WALLET_FROM_SEED` | Import wallets using seed phrases |
| `IMPORT_WALLET_FROM_PRIVATE_KEY` | Import wallets using private keys |
| `SWITCH_NETWORK` | Change blockchain networks |
| `CONNECT_TO_DAPP` | Establish wallet-to-dApp connections |
| `HANDLE_TRANSACTION` | Approve or reject transactions |
| `HANDLE_SIGNATURE` | Manage message and typed data signatures |
| `CHANGE_SPENDING_CAP` | Modify token spending limits |
| `REMOVE_SPENDING_CAP` | Eliminate token spending restrictions |

## MetaMask-Specific Actions

| Action | Description |
|--------|-------------|
| `ADD_TOKEN` | Add a custom token |
| `ADD_ACCOUNT` | Create a new account |
| `SWITCH_ACCOUNT` | Switch between accounts |
| `REMOVE_ACCOUNT` | Remove an account |
| `ADD_NETWORK` | Add a custom network |
| `APPROVE_ADD_NETWORK` | Approve network addition request |

## Approval Types

Actions support two states via `ActionApprovalType`:
- `APPROVE` - Accept the requested action
- `REJECT` - Decline the requested action

## Writing Tests - Fluent Style

### Basic Test Structure

```typescript
import { createOnchainTest } from '@coinbase/onchaintestkit';
import { metamaskConfig } from './config';

const test = createOnchainTest(metamaskConfig);

test('connect wallet and perform transaction', async ({ page, metamask, node }) => {
  // Navigate to dApp
  await page.goto('http://localhost:3000');

  // Click connect button
  await page.getByTestId('connectButton').click();

  // Select MetaMask
  await page.getByText('MetaMask').click();

  // Handle connection in MetaMask
  await metamask.handleAction(BaseActionType.CONNECT_TO_DAPP);

  // Trigger transaction
  await page.getByTestId('sendButton').click();

  // Approve transaction
  await metamask.handleAction(BaseActionType.HANDLE_TRANSACTION, {
    approvalType: ActionApprovalType.APPROVE,
  });

  // Verify success
  await expect(page.getByText('Transaction Successful')).toBeVisible();
});
```

### Network Switching

```typescript
// Switch network in MetaMask
await metamask.handleAction(BaseActionType.SWITCH_NETWORK, {
  networkName: 'Base Sepolia',
  isTestnet: true,
});
```

### Account Management

```typescript
// Add new account
await metamask.handleAction(MetaMaskSpecificActionType.ADD_ACCOUNT, {
  accountName: 'Trading Account',
});

// Switch to account
await metamask.handleAction(MetaMaskSpecificActionType.SWITCH_ACCOUNT, {
  accountName: 'Trading Account',
});
```

### Identifying Notification Types

For complex flows, detect what MetaMask is showing:

```typescript
const notificationType = await metamask.identifyNotificationType();
// Returns: 'Transaction' | 'SpendingCap' | 'Signature' | 'RemoveSpendCap'
```

## LocalNodeManager

The `LocalNodeManager` provides programmatic control over Anvil nodes:

```typescript
const node = new LocalNodeManager({
  chainId: baseSepolia.id,
  forkUrl: process.env.E2E_TEST_FORK_URL,
  forkBlockNumber: BigInt(process.env.E2E_TEST_FORK_BLOCK_NUMBER ?? "0"),
  hardfork: "cancun",
});

// Lifecycle
await node.start();
await node.stop();

// State management
const snapshotId = await node.snapshot();
await node.revert(snapshotId);

// Time manipulation
await node.increaseTime(3600); // Advance 1 hour
await node.mine();
```

## Best Practices

1. **Wait for state changes** - Always await UI updates after wallet actions
2. **Use error handling** - Include try-catch for rejection scenarios
3. **Verify fixture existence** - Check wallet fixture before usage
4. **Never use production credentials** - Only test seed phrases
5. **Use `identifyNotificationType()`** for complex approval flows
6. **Separate configuration files** by wallet type for maintainability

## Debugging

- `--headed` flag shows browser during execution
- `--debug` activates Playwright Inspector
- `--slow-mo=1000` slows execution for observation

```typescript
page.on('pageerror', (error) => console.error('Page error:', error));
page.on('console', (msg) => console.log('Console:', msg.text()));
```

## Environment Variables

```bash
# Required
E2E_TEST_SEED_PHRASE="test test test test test test test test test test test junk"

# Optional
E2E_TEST_FORK_URL="https://mainnet.base.org"
E2E_TEST_FORK_BLOCK_NUMBER="12345678"
E2E_CONTRACT_PROJECT_ROOT="../smart-contracts"
E2E_TEST_TIMEOUT="60000"
```

## Installation

```bash
yarn add -D @coinbase/onchaintestkit @playwright/test
yarn playwright install --with-deps
yarn prepare-metamask  # Download MetaMask extension
```
