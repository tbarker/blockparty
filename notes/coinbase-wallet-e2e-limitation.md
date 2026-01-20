# Coinbase Wallet E2E Test Limitation

## Status: Not Working (January 2026)

The Coinbase Wallet E2E tests are currently not functional due to an internal error in the Coinbase Wallet extension when importing a seed phrase in automated browser environments with local development networks.

## Issue

Even with the correct extension version (v3.117.1) that OnchainTestKit expects, the Coinbase Wallet extension displays an internal error:

**"We encountered an error. Please try again."**

This error occurs when:
1. The seed phrase is entered in the import wallet screen
2. The "Import wallet" button is clicked
3. The extension fails to process the import (before reaching the password step)

## Root Cause: Non-Whitelisted Network

**Key Discovery**: Coinbase Wallet has a list of [whitelisted networks](https://docs.cdp.coinbase.com/coinbase-wallet/introduction/whitelisted-networks). Chain ID 1337 (localhost/Anvil) is **NOT** in this list.

### Whitelisted Networks Include:
- **Mainnets**: Ethereum, Base, Polygon, Arbitrum, Optimism, etc.
- **Testnets**: Sepolia, Base Sepolia, Arbitrum Sepolia, Optimism Sepolia, etc.

### NOT Whitelisted:
- Chain ID 1337 (Hardhat/Anvil localhost)
- Chain ID 31337 (Hardhat default)
- Custom/local development networks

The extension may be failing during seed phrase import because it cannot validate the wallet against a recognized network. The OnchainTestKit CI works because they use a **fork of Base Sepolia** (a whitelisted testnet), not a pure local Anvil chain.

## Evidence

1. OnchainTestKit's [CI workflow](https://github.com/coinbase/onchaintestkit/blob/master/.github/workflows/e2e.yml) uses:
   - `E2E_TEST_FORK_URL` pointing to Base Sepolia (whitelisted)
   - Not a standalone localhost chain

2. The [build-onchain-apps](https://github.com/coinbase/build-onchain-apps) template uses:
   - `NEXT_PRIVATE_RPC_URL=https://sepolia.base.org` (whitelisted)

3. According to [RainbowKit issue #1524](https://github.com/rainbow-me/rainbowkit/issues/1524), `wallet_switchEthereumChain` is not supported for non-whitelisted chains.

## Potential Solution

To make Coinbase Wallet E2E tests work, you would need to:

1. **Fork a whitelisted network** instead of running pure local Anvil:
   ```typescript
   .withLocalNode({
     chainId: baseSepolia.id,  // Use Base Sepolia chain ID
     forkUrl: 'https://sepolia.base.org',  // Fork the actual testnet
     forkBlockNumber: BigInt('some_block_number'),
   })
   ```

2. **Use a real testnet RPC** (requires API key/access to Base Sepolia or similar)

This is a fundamental architectural difference from our current setup which uses a standalone local Anvil chain.

## Infrastructure in Place

The following code has been implemented and would work if we switched to forking a whitelisted network:

1. **`src/__tests__/e2e/config.ts`**: Dual wallet configuration with `WALLET_TYPE` env var
2. **`src/__tests__/e2e/fixtures.ts`**: Coinbase Wallet handlers and unified `wallet` fixture
3. **`scripts/prepare-coinbase.mjs`**: Script to download Coinbase Wallet v3.117.1 from archive
4. **`package.json`**: `test:e2e:coinbase` script

## Workaround

Use MetaMask for E2E testing (works reliably with local Anvil):
```bash
npm run test:e2e          # Uses MetaMask (default)
npm run test:e2e:metamask # Explicitly uses MetaMask
```

MetaMask does not have the same whitelisting restrictions and works fine with chain ID 1337.

## Resolution Path

1. **Fork a whitelisted testnet**: Modify the test configuration to fork Base Sepolia instead of running standalone Anvil. This requires:
   - Access to Base Sepolia RPC (public or via API key)
   - Updating the config to use the correct chain ID and fork URL

2. **Report to OnchainTestKit**: Document this limitation and request support for non-whitelisted networks

3. **Alternative: Use dappwright**: The [dappwright](https://github.com/TenKeyLabs/dappwright) library may have different handling

## Related Links

- OnchainTestKit: https://github.com/coinbase/onchaintestkit
- Coinbase Wallet Whitelisted Networks: https://docs.cdp.coinbase.com/coinbase-wallet/introduction/whitelisted-networks
- Coinbase Wallet Developer Settings: https://docs.cdp.coinbase.com/coinbase-wallet/introduction/developer-settings
- Coinbase Wallet Archive: https://github.com/TenKeyLabs/coinbase-wallet-archive
- RainbowKit Non-Whitelisted Issue: https://github.com/rainbow-me/rainbowkit/issues/1524

## Archive Source

The v3.117.1 extension is downloaded from:
```
https://github.com/TenKeyLabs/coinbase-wallet-archive/releases/download/3.117.1/coinbase-wallet-chrome-3.117.1.zip
```

## Key Takeaway

The fundamental issue is that **Coinbase Wallet has network whitelisting requirements** that our pure local Anvil setup (chain ID 1337) does not meet. MetaMask is more permissive and works with any chain ID, making it the better choice for local development E2E testing.
