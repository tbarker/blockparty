# E2E Test Refactoring Plan - Fluent API Style

## Status Summary (Updated 2026-01-18)

| Phase | Status | Notes |
|-------|--------|-------|
| Phase 1: Configuration Consolidation | ✅ Complete | Using LocalNodeManager with per-test Anvil instances |
| Phase 2: Simplify Fixtures | ✅ Complete | Fixtures reduced to essential helpers |
| Phase 3: Refactor Test Files | ✅ Complete | All 4 test files use consistent patterns |
| Phase 4: Multi-Account Testing | ✅ Functional | `switchMetaMaskAccount()` works correctly |
| Phase 5: Time Manipulation Tests | ⏭️ N/A | No tests currently need time manipulation |
| Phase 6: Smart Contract Manager | 🔮 Future | Current `deployTestEvent()` with ethers.js works well |

### Key Results
- **All 22 E2E tests pass** (run time ~23-25 minutes with single worker)
- **Test patterns standardized**: All tests use `connectWallet(page, metamask)` helper
- **Per-test isolation**: Each test deploys its own contract via `deployTestEvent()`

### MetaMask 12.8.1 Workaround
OnchainTestKit's `CONNECT_TO_DAPP` action doesn't work with MetaMask 12.8.1's two-step connection flow (Connect → Review permissions). The `connectWallet()` helper in fixtures.ts handles this correctly.

**Newer MetaMask Version Experiment (2026-01-18):**
Tested with MetaMask 12.20.1 to see if it would simplify the connection flow. Result: **Not viable**.
- MetaMask 12.20.1 introduces a "What's New" modal (`data-testid="whats-new-modal"`) on first launch
- This modal blocks all pointer events and OnchainTestKit doesn't know how to dismiss it
- The automation would need additional handling for new modals in each MetaMask version
- Conclusion: OnchainTestKit's pin to 12.8.1 is intentional; our `connectWallet()` helper is the correct approach

---

## Current State Analysis

### What We Have Now

The current E2E tests use a hybrid approach:
- **config.ts**: Uses OnchainTestKit's fluent `configure()` builder for wallet setup
- **fixtures.ts**: 800+ lines of custom helper functions that wrap/replace OnchainTestKit functionality
- **Test files**: Mix of custom helpers and some OnchainTestKit patterns

### Current Pain Points

1. **Custom MetaMask handlers** (500+ lines)
   - `handleMetaMaskConnection()` - Custom two-step connection flow
   - `handleTransactionWithNetworkApproval()` - Custom transaction handling
   - `handleNetworkApprovalDialog()` - Custom network approval
   - `switchMetaMaskAccount()` - Custom account switching
   - `ensureMetaMaskAccountExists()` - Custom account creation
   - `addAnvilNetwork()` - Disabled, uses RPC trigger instead
   - `switchToLocalhostNetwork()` - Custom network switching

2. **Workarounds for MetaMask 12.8.1**
   - OnchainTestKit's `addNetwork` doesn't work with MetaMask 12.8.1 UI
   - Custom selectors throughout for 12.8.1 compatibility

3. **Test isolation complexity**
   - Each test deploys its own contract via `deployTestEvent()`
   - Manual state management across tests

4. **Verbose test code**
   - Tests are 50-100+ lines with lots of boilerplate
   - Repetitive patterns: deploy contract, inject config, connect wallet, wait for app

## Target State - Fluent API Style

### Vision

Tests should read like a narrative:

```typescript
test('should allow user to register for event', async ({ page, metamask, node }) => {
  // Setup
  const contract = await deployConference({ name: 'Registration Test' });

  await page.goto(`http://localhost:3000/?contract=${contract.address}`);

  // Connect wallet (fluent style)
  await metamask.handleAction(BaseActionType.CONNECT_TO_DAPP);

  // Register for event
  await page.fill('input[placeholder*="twitter"]', '@testuser');
  await page.click('button:has-text("RSVP")');

  // Approve transaction
  await metamask.handleAction(BaseActionType.HANDLE_TRANSACTION, {
    approvalType: ActionApprovalType.APPROVE,
  });

  // Verify
  await expect(page.getByText('Successfully Registered')).toBeVisible();
});
```

## Refactoring Phases

### Phase 1: Configuration Consolidation

**Goal**: Use OnchainTestKit's full configuration capabilities

**Tasks**:

1. **Update config.ts to use LocalNodeManager**
   ```typescript
   export const config = configure()
     .withLocalNode({
       chainId: 1337,
       minPort: 8545,
       maxPort: 8545, // Fixed port for simplicity
     })
     .withMetaMask()
     .withNetwork({
       name: 'Localhost',
       rpcUrl: 'http://localhost:8545',
       chainId: 1337,
       symbol: 'ETH',
     })
     .withSeedPhrase({
       seedPhrase: SEED_PHRASE,
       password: PASSWORD,
     })
     .withCustomSetup(async (wallet, context) => {
       // Create additional accounts for multi-user tests
       await wallet.handleAction(MetaMaskSpecificActionType.ADD_ACCOUNT, {
         accountName: 'User 2',
       });
     })
     .build();
   ```

2. **Create test instance with createOnchainTest**
   ```typescript
   import { createOnchainTest } from '@coinbase/onchaintestkit';
   export const test = createOnchainTest(config);
   ```

3. **Remove global-setup.cjs** (or simplify to contract deployment only)
   - Let OnchainTestKit manage Anvil lifecycle
   - Use node fixture for chain state manipulation

### Phase 2: Simplify Fixtures

**Goal**: Reduce fixtures.ts from 800+ lines to ~200 lines

**Tasks**:

1. **Remove custom MetaMask handlers**
   - Delete `handleMetaMaskConnection()` - use `metamask.handleAction(BaseActionType.CONNECT_TO_DAPP)`
   - Delete `handleTransactionWithNetworkApproval()` - use `metamask.handleAction(BaseActionType.HANDLE_TRANSACTION)`
   - Delete `handleNetworkApprovalDialog()` - use `metamask.handleAction(MetaMaskSpecificActionType.APPROVE_ADD_NETWORK)`
   - Delete `switchMetaMaskAccount()` - use `metamask.handleAction(MetaMaskSpecificActionType.SWITCH_ACCOUNT)`
   - Delete `addAnvilNetwork()` / `switchToLocalhostNetwork()` - use config `.withNetwork()`

2. **Keep essential helpers**
   - `deployTestEvent()` - Contract deployment (may integrate with smartContractManager)
   - `deployFactory()` - Factory deployment
   - `injectE2EConfig()` - App configuration injection
   - `waitForAppLoad()` - Simplified
   - `waitForTransactionSuccess()` - Simplified

3. **Remove modal dismissal helpers** (if OnchainTestKit handles them)
   - `dismissWelcomeModal()` - Move to app-level config
   - `dismissRainbowKitPopovers()` - Should not be needed with proper waits

### Phase 3: Refactor Test Files

**Goal**: Rewrite tests using fluent patterns

**Order of refactoring**:
1. `registration.spec.ts` (simplest, good template)
2. `attendance.spec.ts` (multi-account, owner operations)
3. `withdrawal.spec.ts` (time manipulation, state changes)
4. `createEvent.spec.ts` (factory interaction, most complex)

**Pattern for each test**:

```typescript
import { test, expect, BaseActionType, ActionApprovalType } from './fixtures';

test.describe('Feature Name', () => {
  test('should do something', async ({ page, metamask, node }) => {
    // 1. Deploy contract (if needed)
    const contract = await deployConference({ name: 'Test' });

    // 2. Navigate
    await page.goto(`http://localhost:3000/?contract=${contract.address}`);

    // 3. Connect wallet (one line)
    await page.click('button:has-text("Connect Wallet")');
    await page.click('button:has-text("MetaMask")');
    await metamask.handleAction(BaseActionType.CONNECT_TO_DAPP);

    // 4. Perform action
    await page.click('button:has-text("RSVP")');
    await metamask.handleAction(BaseActionType.HANDLE_TRANSACTION, {
      approvalType: ActionApprovalType.APPROVE,
    });

    // 5. Assert
    await expect(page.getByText('Success')).toBeVisible();
  });
});
```

### Phase 4: Multi-Account Testing

**Goal**: Simplify tests that use multiple accounts

**Current approach**:
- `ensureMetaMaskAccountExists()` with custom UI navigation
- `switchMetaMaskAccount()` with custom selectors

**Target approach**:
```typescript
test('owner marks attendance for user', async ({ page, metamask, node }) => {
  // Deploy as owner (account 0)
  const contract = await deployConference({ name: 'Test' });

  // Register as user (switch to account 1)
  await metamask.handleAction(MetaMaskSpecificActionType.SWITCH_ACCOUNT, {
    accountName: 'Account 2',  // Created in withCustomSetup
  });
  await page.goto(`http://localhost:3000/?contract=${contract.address}`);
  await page.click('button:has-text("Connect Wallet")');
  await metamask.handleAction(BaseActionType.CONNECT_TO_DAPP);
  // ... register ...

  // Mark attendance as owner (switch back)
  await metamask.handleAction(MetaMaskSpecificActionType.SWITCH_ACCOUNT, {
    accountName: 'Account 1',
  });
  // ... mark attendance ...
});
```

### Phase 5: Time Manipulation Tests

**Goal**: Use LocalNodeManager for time-dependent tests

**Current approach**: Custom Anvil RPC calls via fetch

**Target approach**:
```typescript
test('should allow withdrawal after event ends', async ({ page, metamask, node }) => {
  const contract = await deployConference({ name: 'Test' });

  // ... setup and register ...

  // Advance time to end event
  await node.increaseTime(604800); // 1 week
  await node.mine();

  // ... verify withdrawal available ...
});
```

### Phase 6: Smart Contract Manager Integration

**Goal**: Use OnchainTestKit's smartContractManager for contract deployment

**Investigate**:
- Can smartContractManager replace our `deployTestEvent()`?
- Does it support Foundry artifacts?
- Can it handle upgradeable contracts?

**Potential pattern**:
```typescript
test('create event via factory', async ({ page, metamask, smartContractManager }) => {
  const factory = await smartContractManager.deploy('ConferenceFactory', [owner]);
  // ... test factory interaction ...
});
```

## Implementation Notes

### MetaMask 12.8.1 Compatibility

If OnchainTestKit still has issues with MetaMask 12.8.1:
1. Check for updates to OnchainTestKit
2. Consider contributing fixes upstream
3. Keep minimal compatibility layer if needed

### Parallel Execution

Current limitation: We run with 1 worker due to Anvil state conflicts.

With OnchainTestKit's LocalNodeManager:
- Each test can get its own Anvil instance
- Dynamic port allocation prevents conflicts
- May be able to re-enable parallel execution

### Test Timeouts

Current tests take ~27 minutes (22 tests, 1 worker).

Potential improvements:
- Parallel execution with isolated nodes
- Reduced wait times with proper state checks
- Snapshot/revert for faster test isolation

## Success Criteria

1. **Lines of code**: fixtures.ts reduced from 800+ to ~200 lines
2. **Test readability**: Each test is <30 lines of clear, fluent code
3. **Maintainability**: No custom MetaMask UI selectors
4. **Performance**: Tests complete in <15 minutes (if parallel enabled)
5. **Reliability**: No flaky tests, consistent CI results

## Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| OnchainTestKit MetaMask 12.8.1 bugs | Keep compatibility layer, report issues upstream |
| LocalNodeManager port conflicts | Test with dynamic port range |
| Breaking existing tests | Refactor one file at a time, keep old tests passing |
| Missing smartContractManager features | Fall back to ethers.js deployment |

## Timeline

This is a significant refactoring effort. Suggested approach:

1. **Phase 1**: Test with one spec file (registration.spec.ts)
2. **Evaluate**: Does the fluent API work as expected?
3. **Phase 2-3**: Refactor fixtures, then remaining test files
4. **Phase 4-6**: Advanced features (multi-account, time, contracts)

Each phase should be completed and tested before moving to the next.
