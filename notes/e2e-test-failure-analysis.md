# E2E Test Failure Analysis

## Current Status (2026-01-15)
- 16 tests pass, 5 tests fail consistently in CI
- Tests pass in isolation but fail in full suite
- All local runs of isolated tests pass
- Full suite runs sometimes pass locally but fail in CI

## CI Run History
All recent CI runs have failed with E2E tests. The failures started appearing consistently around 2026-01-13.

## Failing Tests
1. registration.spec.ts:225 - should display participants table with registration data
2. withdrawal.spec.ts:34 - should allow user to withdraw after attendance and payback
3. withdrawal.spec.ts:138 - should show withdraw button only after event ends
4. withdrawal.spec.ts:198 - should prevent double withdrawal
5. createEvent.spec.ts - show "+ New Event" button (new failure in latest run)

## Root Cause Analysis

### Primary Issue: Browser Context Corruption
Looking at CI logs, the key error is:
```
browserContext.waitForEvent: Target page, context or browser has been closed
```

This indicates the browser context is being closed/corrupted mid-test, causing subsequent tests to fail.

### Secondary Issue: MetaMask Notification Timing
```
[getNotificationPageAndWaitForLoad] Notification page did not appear after 10000ms
```

MetaMask's notification popup doesn't appear within expected timeout. This could be:
1. MetaMask in a transitional state (switching accounts/networks)
2. Transaction not being initiated by the dApp
3. Browser focus issues preventing popup appearance

### Pattern Observed
1. First ~14-17 tests pass reliably
2. Around test 17-18, MetaMask starts having issues
3. Once one test fails, subsequent tests also fail (cascading failure)

## Fixes Attempted

### 1. Network Switching After Account Switch
- Added `switchNetwork('Anvil', true)` after `switchAccount()`
- Result: Fixed original 4 failing tests in isolation, but full suite still fails

### 2. Stabilization Delays
- Added delays after account switch (1s pre, 1.5s post in CI)
- Increased waitForMetaMaskAndConfirm timeout from 20s to 30s
- Increased retries from 3 to 4
- Result: No improvement in CI

### 3. Page Focus Management
- Added `bringToFront()` calls to ensure app page has focus
- Added `ensurePageReady()` before critical interactions
- Result: Helped with some timing issues but didn't fix root cause

### 4. Modal Dismissal
- Added aggressive welcome modal dismissal
- Added RainbowKit popover dismissal
- Result: Improved early test reliability but didn't fix late-suite failures

## Key Observations

### Why Tests Pass Locally But Fail in CI
1. **Resource Constraints**: CI runners have limited CPU/memory
2. **Timing Differences**: CI is slower, race conditions more likely
3. **Browser State Accumulation**: MetaMask accumulates state over 22 tests
4. **No GPU**: CI runs without GPU acceleration

### Why Tests Pass in Isolation But Fail in Suite
1. **State Accumulation**: MetaMask browser extension accumulates state
2. **Context Leakage**: Some state persists between tests despite isolation attempts
3. **Resource Exhaustion**: Memory/CPU pressure after many tests

## Alternative Approaches to Consider

### 1. Split Test Files (Separate Workers)
Instead of running 22 tests sequentially in one worker, split into multiple files that run in parallel. Each file gets a fresh browser context.

### 2. Browser Context Reset Between Tests
Explicitly close and recreate browser context between certain tests, especially around test 17.

### 3. UI Code Changes
The dApp could be modified to be more resilient to timing issues:
- Add loading states during wallet operations
- Debounce rapid state changes
- Add retry logic in the UI itself
- Expose readiness signals for testing

### 4. Use Test Isolation Features
Playwright's `test.describe.serial()` with `beforeEach` hooks that reset browser state.

### 5. Reduce Test Complexity
Simplify tests that do multiple account switches:
- withdrawal tests do 2+ account switches
- Each switch can destabilize MetaMask state

## Recommended Next Steps

1. **Try test file splitting** - Create separate spec files for different test groups
2. **Add browser context reset** - Force fresh context after every 5-6 tests
3. **Use act tool** - Test changes locally with `act` before pushing to CI
4. **Investigate UI timing** - Look at wallet connection flow for improvement opportunities

## Files Modified
- src/__tests__/e2e-synpress/fixtures.ts - Multiple stability improvements
- playwright.synpress.config.ts - Worker count, timeout settings
- src/__tests__/e2e-synpress/global-setup.cjs - Anvil URL change

## CI Runs Analyzed
- 21025104162 - 16 passed, 5 failed (stabilization delays)
- 21022621829 - 17 passed, 5 failed (network fix)
- 21018696740 - 18 passed, 4 failed (modal dismissal)
- 21017529620 - 18 passed, 4 failed (aggressive modal)
