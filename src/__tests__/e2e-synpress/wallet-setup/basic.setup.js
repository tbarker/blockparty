/**
 * Basic MetaMask Wallet Setup for Synpress E2E Tests
 *
 * This configures MetaMask with Anvil test accounts for parallel test execution.
 * The seed phrase corresponds to Anvil's default mnemonic.
 *
 * Account allocation for 8-worker parallel execution:
 * - Each worker has its own MetaMask instance with the same set of accounts
 * - Tests use SUITE_ACCOUNTS to pick accounts based on test suite
 * - Since workers are independent (separate browser contexts), the same
 *   account names can be used across workers without conflict
 *
 * NOTE: Network configuration is NOT done here because MetaMask validates
 * the RPC URL by connecting to it, and Anvil isn't running during cache building.
 * The app will prompt to add the network when connecting.
 */

const { defineWalletSetup } = require('@synthetixio/synpress');
const { MetaMask } = require('@synthetixio/synpress/playwright');

// Anvil's default mnemonic - generates the test accounts
const SEED_PHRASE = 'test test test test test test test test test test test junk';

// Password for the MetaMask wallet
const PASSWORD = 'BlockPartyTest123!';

/**
 * Define the basic wallet setup for MetaMask
 * This will be cached by Synpress for fast test startup
 */
module.exports = defineWalletSetup(PASSWORD, async (context, walletPage) => {
  const metamask = new MetaMask(context, walletPage, PASSWORD);
  await metamask.importWallet(SEED_PHRASE);

  // Add accounts for test suites (Account 1 is created by importWallet)
  // Names kept simple without spaces for compatibility
  await metamask.addNewAccount('User2');
  await metamask.addNewAccount('Admin3');
  await metamask.addNewAccount('User4');
  await metamask.addNewAccount('Admin5');
  await metamask.addNewAccount('User6');
  await metamask.addNewAccount('Admin7');
  await metamask.addNewAccount('User8');
  await metamask.addNewAccount('Admin9');
  await metamask.addNewAccount('User10');
});

module.exports.PASSWORD = PASSWORD;
