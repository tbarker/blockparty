/**
 * OnchainTestKit Configuration for BlockParty E2E Tests
 *
 * Uses OnchainTestKit's fluent builder pattern with:
 * - Per-test Anvil instances via LocalNodeManager (enables parallelization)
 * - MetaMask or Coinbase Wallet automation (controlled via E2E_WALLET env var)
 *
 * NOTE: We use .withLocalNode() for per-test Anvil but NOT .withNetwork()
 * because OnchainTestKit's addNetwork has MetaMask 12.8.1 compatibility issues.
 * Network is added via .withCustomSetup() using our custom selectors.
 */

import { configure } from '@coinbase/onchaintestkit';
import * as fs from 'fs';
import * as path from 'path';

// Wallet type selection via environment variable
export type WalletType = 'metamask' | 'coinbase';
export const WALLET_TYPE: WalletType = (process.env.E2E_WALLET || 'metamask') as WalletType;

// Anvil's default mnemonic - generates the test accounts
export const SEED_PHRASE =
  process.env.E2E_TEST_SEED_PHRASE ||
  'test test test test test test test test test test test junk';

// Password for wallet setup (MetaMask or Coinbase Wallet)
export const PASSWORD = 'BlockPartyTest123!';

// Chain ID for local Anvil network
export const CHAIN_ID = 1337;

// Default Anvil URL and port (fallback for global setup mode)
export const ANVIL_URL = 'http://localhost:8545';
export const ANVIL_PORT = 8545;

/**
 * Load E2E state from global setup (contract addresses, etc.)
 */
interface E2EState {
  contractAddress: string;
  factoryAddress: string;
  chainId: number;
  anvilUrl: string;
}

const STATE_FILE = path.join(__dirname, '.e2e-state.json');

export function loadE2EState(): E2EState {
  try {
    const data = fs.readFileSync(STATE_FILE, 'utf-8');
    return JSON.parse(data);
  } catch {
    console.warn('Could not load E2E state file, using defaults');
    return {
      contractAddress: '',
      factoryAddress: '',
      chainId: CHAIN_ID,
      anvilUrl: ANVIL_URL,
    };
  }
}

/**
 * OnchainTestKit wallet configuration using fluent builder pattern.
 *
 * This configuration:
 * - Creates a per-test Anvil node via LocalNodeManager (enables parallel tests)
 * - Configures MetaMask or Coinbase Wallet based on E2E_WALLET env var
 * - Uses custom network setup that's compatible with wallet UI variations
 *
 * NOTE: We use .withLocalNode() for per-test Anvil but NOT .withNetwork()
 * because OnchainTestKit's addNetwork has wallet compatibility issues.
 * Network is added in fixtures.ts using custom selectors.
 */

// Base node configuration shared by both wallets
const nodeConfig = {
  chainId: CHAIN_ID,
  // Dynamic port allocation - each test gets its own Anvil instance
  // This enables parallel test execution without state conflicts
  minPort: 8546,
  maxPort: 9545,
};

// MetaMask configuration
const metamaskConfig = configure()
  .withLocalNode(nodeConfig)
  .withMetaMask()
  .withSeedPhrase({
    seedPhrase: SEED_PHRASE,
    password: PASSWORD,
  })
  .build();

// Coinbase Wallet configuration
const coinbaseConfig = configure()
  .withLocalNode(nodeConfig)
  .withCoinbase()
  .withSeedPhrase({
    seedPhrase: SEED_PHRASE,
    password: PASSWORD,
  })
  .build();

// Export the appropriate config based on wallet type
export const walletConfig = WALLET_TYPE === 'coinbase' ? coinbaseConfig : metamaskConfig;

// Export individual configs for reference
export { metamaskConfig, coinbaseConfig };

/**
 * Anvil pre-funded accounts (derived from seed phrase)
 * Each account has 10000 ETH on Anvil.
 */
export const ANVIL_ACCOUNTS = {
  deployer: {
    address: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
    privateKey: '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
  },
  user1: {
    address: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
    privateKey: '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d',
  },
  user2: {
    address: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
    privateKey: '0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a',
  },
  user3: {
    address: '0x90F79bf6EB2c4f870365E785982E1f101E93b906',
    privateKey: '0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6',
  },
  user4: {
    address: '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65',
    privateKey: '0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a',
  },
} as const;
