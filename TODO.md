# BlockParty - Deferred Upgrades

This document tracks upgrades deferred to maintain stability.

## Completed

### Solidity 0.8.20 Upgrade

- ✅ Migrated contracts from 0.4.24 to 0.8.20
- ✅ Updated syntax (`address payable`, `block.timestamp`, custom errors)
- ✅ All 49 smart contract tests passing

### React 18 + MUI v7 Upgrade

- ✅ React 16 → 18 (React 19 blocked by react-notifications)
- ✅ Material-UI v0.20 → @mui/material v7
- ✅ All 43 UI tests passing

### Build Tooling

- ✅ Node.js 22 LTS support
- ✅ Webpack 5 with modern config
- ✅ ESLint 9 flat config
- ✅ VS Code Dev Container
- ✅ GitHub Actions CI

## Deferred

### React 19 Migration

**Blocked by:** react-notifications uses deprecated `ReactDOM.findDOMNode()`

**To unblock:** Replace react-notifications with notistack or react-toastify

### Ethers.js Migration

**Current:** web3.js v1.x (removed, needs re-adding or migration)
**Target:** ethers.js v6.x or viem

**Why deferred:** Would require rewriting all contract interactions

### Hardhat Migration

**Current:** Truffle (deprecated but functional)
**Target:** Hardhat

**Why deferred:** Truffle still works; migration is significant effort

### TypeScript Migration

**Why deferred:** Large effort, can be done incrementally

### Vite Migration

**Current:** Webpack 5
**Why deferred:** Webpack works fine; lower priority

## Future Improvements

### Testing

- ✅ Build verification tests (`npm run test:build`) - catches webpack/import issues
- Expand beyond smoke tests
- Add E2E tests with Playwright
- Target >80% coverage

#### Contract Integration Tests (Level 4)

Infrastructure exists in `src/__tests__/integration/ganacheSetup.js`. Expand to include:

1. **Full User Journey Tests**
   - Start Ganache and deploy contracts
   - Test register → attend → withdraw flow
   - Verify state changes on-chain
   - Test edge cases (event full, already registered, etc.)

2. **Admin Workflow Tests**
   - Create event with custom parameters
   - Mark attendance for multiple participants
   - Trigger payback
   - Test cancel flow

3. **ENS Integration Tests**
   - Deploy ENS contracts locally
   - Register names
   - Verify reverse resolution works in UI

4. **Error Handling Tests**
   - Insufficient funds
   - Network disconnection
   - Contract revert scenarios

**Implementation Notes:**

- Use `ganacheSetup.js` helpers for contract deployment
- Consider running in CI with GitHub Actions
- May need Playwright for full E2E with browser wallet mocking

### Code Quality

- Pre-commit hooks with Husky
- Stricter ESLint rules

### Bug Fixes

- ✅ Removed defunct CoinMarketCap API call (`coinmarketcap-nexuist.rhcloud.com` no longer exists)
- Replace react-notifications to fix `findDOMNode` deprecation warning (also unblocks React 19)

---

Priority order when resources available:

1. React 19 (replace react-notifications first)
2. Ethers.js or viem (modern Web3 library)
3. Hardhat (better tooling than Truffle)
4. TypeScript (incremental migration)
