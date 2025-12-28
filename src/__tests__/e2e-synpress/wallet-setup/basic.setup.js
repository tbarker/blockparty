/**
 * Basic MetaMask Wallet Setup for Synpress E2E Tests
 *
 * This configures MetaMask with the first Anvil test account.
 * The seed phrase corresponds to Anvil's default mnemonic.
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

  // Add a second account for multi-user tests
  // This creates "Account 2" which is needed for attendance/withdrawal tests
  await metamask.addNewAccount('Account 2');
});

module.exports.PASSWORD = PASSWORD;
