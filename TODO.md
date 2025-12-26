# BlockParty - Deferred Upgrades

This document tracks upgrades deferred to maintain stability.

## Completed

### Solidity 0.8.20 Upgrade

- Migrated contracts from 0.4.24 to 0.8.20
- Updated syntax (`address payable`, `block.timestamp`, custom errors)
- All 49 smart contract tests passing

### React 18 + MUI v7 Upgrade

- React 16 -> 18 (React 19 blocked by react-notifications)
- Material-UI v0.20 -> @mui/material v7
- All 45 UI tests passing

### Build Tooling

- Node.js 22 LTS support
- Webpack 5 with modern config
- ESLint 9 flat config
- VS Code Dev Container
- GitHub Actions CI

### Ethers.js Migration

- Migrated from web3.js v1.x to ethers.js v6.x
- Rewrote all contract interactions in `src/index.js`
- Uses native ethers.js ENS support for name resolution
- Created ethers-compatible wrapper for components

### Foundry/Forge Migration

- Migrated from Truffle to Foundry/Forge
- Created `foundry.toml` configuration
- Installed `forge-std` library
- Created `script/Deploy.s.sol` deployment script
- Converted all Truffle JavaScript tests to Solidity:
  - `test/Conference.t.sol` (34 tests)
  - `test/GroupAdmin.t.sol` (8 tests)
- All 46 Forge tests passing
- Removed old Truffle config, migrations, and JavaScript tests
- Uses `out/` directory for Forge artifacts

### Contract Integration Tests (Level 4)

- Implemented comprehensive integration tests using Anvil + Jest + ethers.js
- Test files in `src/__tests__/integration/`:
  - `anvilSetup.js` - Test harness with contract deployment, helpers, time manipulation
  - `userJourney.test.js` - Full user flows (register, attend, withdraw)
  - `adminWorkflow.test.js` - Admin operations (config, roles, payback, cancel, clear)
  - `errorHandling.test.js` - Revert scenarios and edge cases
- Run with `npm run test:integration` (requires Anvil running)
- Uses snapshot/revert for test isolation
- Tests contract interactions directly without browser

## Completed

### React 19 Migration

**Status:** Complete

- Replaced react-notifications with MUI Snackbar/Alert (removed findDOMNode deprecation)
- Upgraded React 18.3.1 -> 19.x
- Upgraded react-dom 18.3.1 -> 19.x
- Upgraded @testing-library/react 14.x -> 16.x

## Deferred

### Synpress for E2E Wallet Testing

**Current:** Custom `mockEthereum.js` that simulates MetaMask and forwards RPC to Anvil
**Alternative:** Synpress (`@synthetixio/synpress`) - E2E framework with real MetaMask automation

**Why deferred:**

- Current custom approach is simpler and faster (no extension overhead)
- Synpress requires Xvfb/display server in CI for browser extensions
- May have Docker/devcontainer compatibility issues
- Custom mock is working and sufficient for current needs

**Revisit if:**

- Need to test actual MetaMask-specific behaviors (signing UX, network switching prompts)
- Custom mock becomes a maintenance burden
- Synpress improves headless/container support

**Note:** `@depay/web3-mock` was evaluated but is not suitable - it mocks RPC responses entirely rather than forwarding to a real blockchain.

### TypeScript Migration

**Why deferred:** Large effort, can be done incrementally

### Vite Migration

**Current:** Webpack 5
**Why deferred:** Webpack works fine; lower priority

## Future Improvements

### Testing

- Build verification tests (`npm run test:build`) - catches webpack/import issues
- Contract integration tests (`npm run test:integration`) - tests against Anvil
- Expand beyond smoke tests
- Add E2E tests with Playwright
- Target >80% coverage

### E2E Tests (Playwright)

**Status:** Complete

- Implemented E2E tests using Playwright + custom wallet mock
- Test files in `src/__tests__/e2e/`:
  - `registration.spec.mjs` - User registration flow
  - `attendance.spec.mjs` - Admin attendance marking
  - `withdrawal.spec.mjs` - Withdrawal after event ends
- Custom `mockEthereum.js` simulates MetaMask, forwards transactions to Anvil
- Run with `npm run test:e2e`
- All 14 tests passing in CI

#### Future Testing Improvements

1. **ENS Integration Tests**
   - Deploy ENS contracts locally
   - Register names
   - Verify reverse resolution works in UI

2. **Visual Regression Testing**
   - Add Playwright visual comparison tests
   - Catch unintended UI changes

### Code Quality

- Pre-commit hooks with Husky
- Stricter ESLint rules

### Bug Fixes

- Removed defunct CoinMarketCap API call (`coinmarketcap-nexuist.rhcloud.com` no longer exists)
- ~~Replace react-notifications to fix `findDOMNode` deprecation warning~~ (DONE - replaced with MUI Snackbar/Alert)

---

Priority order when resources available:

1. React 19 (replace react-notifications first)
2. TypeScript (incremental migration)
