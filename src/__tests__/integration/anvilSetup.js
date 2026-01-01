/**
 * Anvil (Foundry) integration test setup
 * Provides real blockchain interaction for integration tests using ethers.js
 *
 * Usage:
 *   1. Start Anvil in a separate terminal: npm run anvil
 *   2. Run integration tests: npm run test:integration
 */

const { ethers } = require('ethers');
const path = require('path');
const fs = require('fs');

// Anvil default accounts (well-known test keys)
const ANVIL_ACCOUNTS = {
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
  admin1: {
    address: '0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc',
    privateKey: '0x8b3a350cf5c34c9194ca85829a2df0ec3153be0318b5e2d3348e872092edffba',
  },
};

// Contract artifacts path (Forge output)
const artifactsPath = path.join(__dirname, '../../../out/Conference.sol/Conference.json');

// Default deposit amount (0.02 ETH)
const DEFAULT_DEPOSIT = ethers.parseEther('0.02');

// Test configuration
// Note: Use 127.0.0.1 instead of localhost to avoid IPv6 resolution issues
const TEST_CONFIG = {
  rpcUrl: 'http://127.0.0.1:8545',
  chainId: 31337, // Anvil default chain ID
  defaultEventName: 'Integration Test Event',
  defaultDeposit: DEFAULT_DEPOSIT,
  defaultLimit: 20,
  defaultCoolingPeriod: 60 * 60 * 24 * 7, // 1 week in seconds
};

let artifacts;

// Shared provider instance - recreated on anvil reset
let sharedProvider = null;

/**
 * Create a fresh provider (needed after snapshot reverts to avoid nonce issues)
 * Uses a singleton pattern to ensure all operations use the same provider
 * Disables caching to ensure fresh nonce reads from blockchain
 */
function createProvider() {
  if (!sharedProvider) {
    sharedProvider = new ethers.JsonRpcProvider(TEST_CONFIG.rpcUrl, undefined, {
      cacheTimeout: -1, // Disable caching
      pollingInterval: 100,
    });
  }
  return sharedProvider;
}

/**
 * Reset the shared provider (call after anvil_reset)
 */
function resetProvider() {
  sharedProvider = null;
}

/**
 * Load contract artifacts
 */
function loadArtifacts() {
  if (!artifacts) {
    if (!fs.existsSync(artifactsPath)) {
      throw new Error(
        `Contract artifacts not found at ${artifactsPath}.\n` + 'Run: npm run forge:build'
      );
    }
    artifacts = JSON.parse(fs.readFileSync(artifactsPath, 'utf8'));
  }
  return artifacts;
}

/**
 * Check if Anvil is running
 */
async function isAnvilRunning() {
  try {
    const provider = createProvider();
    const network = await provider.getNetwork();
    return Number(network.chainId) === TEST_CONFIG.chainId;
  } catch {
    return false;
  }
}

/**
 * Deploy a fresh Conference contract for testing
 */
async function deployContract(options = {}) {
  const provider = createProvider();
  const arts = loadArtifacts();

  const {
    name = TEST_CONFIG.defaultEventName,
    deposit = TEST_CONFIG.defaultDeposit,
    limitOfParticipants = TEST_CONFIG.defaultLimit,
    coolingPeriod = TEST_CONFIG.defaultCoolingPeriod,
  } = options;

  const deployer = new ethers.Wallet(ANVIL_ACCOUNTS.deployer.privateKey, provider);

  const factory = new ethers.ContractFactory(arts.abi, arts.bytecode.object, deployer);

  const contract = await factory.deploy(name, deposit, limitOfParticipants, coolingPeriod);

  await contract.waitForDeployment();

  return contract;
}

/**
 * Get a signer for a specific test account
 * Creates a fresh Wallet each time - we'll use explicit nonce management
 */
function getSigner(accountKey, provider = null) {
  const account = ANVIL_ACCOUNTS[accountKey];
  if (!account) {
    throw new Error(
      `Unknown account: ${accountKey}. Available: ${Object.keys(ANVIL_ACCOUNTS).join(', ')}`
    );
  }

  const prov = provider || createProvider();
  return new ethers.Wallet(account.privateKey, prov);
}

/**
 * Get account address by key
 */
function getAddress(accountKey) {
  const account = ANVIL_ACCOUNTS[accountKey];
  if (!account) {
    throw new Error(`Unknown account: ${accountKey}`);
  }
  return account.address;
}

/**
 * Helper to get current nonce for an account
 * Uses 'pending' block tag to get the count including pending transactions
 */
async function getNonce(provider, accountKey) {
  const address = getAddress(accountKey);
  return provider.getTransactionCount(address, 'pending');
}

/**
 * Helper to register a participant
 */
async function register(contract, twitterHandle, signerKey = 'user1', depositOverride = null) {
  const provider = contract.runner.provider;
  const signer = getSigner(signerKey, provider);
  const deposit = depositOverride || (await contract.deposit());
  const nonce = await getNonce(provider, signerKey);

  const tx = await contract.connect(signer).register(twitterHandle, { value: deposit, nonce });
  await tx.wait();

  return tx;
}

/**
 * Helper to mark participant as attended (admin/owner only)
 */
async function attend(contract, addresses, signerKey = 'deployer') {
  const provider = contract.runner.provider;
  const signer = getSigner(signerKey, provider);
  const addressArray = Array.isArray(addresses) ? addresses : [addresses];
  const nonce = await getNonce(provider, signerKey);

  const tx = await contract.connect(signer).attend(addressArray, { nonce });
  await tx.wait();

  return tx;
}

/**
 * Helper to trigger payback (owner only)
 */
async function payback(contract, signerKey = 'deployer') {
  const provider = contract.runner.provider;
  const signer = getSigner(signerKey, provider);
  const nonce = await getNonce(provider, signerKey);

  const tx = await contract.connect(signer).payback({ nonce });
  await tx.wait();

  return tx;
}

/**
 * Helper to cancel event (owner only)
 */
async function cancel(contract, signerKey = 'deployer') {
  const provider = contract.runner.provider;
  const signer = getSigner(signerKey, provider);
  const nonce = await getNonce(provider, signerKey);

  const tx = await contract.connect(signer).cancel({ nonce });
  await tx.wait();

  return tx;
}

/**
 * Helper to withdraw funds
 */
async function withdraw(contract, signerKey) {
  const provider = contract.runner.provider;
  const signer = getSigner(signerKey, provider);
  const nonce = await getNonce(provider, signerKey);

  const tx = await contract.connect(signer).withdraw({ nonce });
  await tx.wait();

  return tx;
}

/**
 * Helper to grant admin role
 * Note: grant() expects an array of addresses
 */
async function grantAdmin(contract, adminAddresses, signerKey = 'deployer') {
  const provider = contract.runner.provider;
  const signer = getSigner(signerKey, provider);
  const nonce = await getNonce(provider, signerKey);

  // Ensure we pass an array
  const addressArray = Array.isArray(adminAddresses) ? adminAddresses : [adminAddresses];

  const tx = await contract.connect(signer).grant(addressArray, { nonce });
  await tx.wait();

  return tx;
}

/**
 * Get contract state as a plain object
 */
async function getContractState(contract) {
  const [
    name,
    deposit,
    limitOfParticipants,
    registered,
    attended,
    ended,
    cancelled,
    payoutAmount,
    totalBalance,
  ] = await Promise.all([
    contract.name(),
    contract.deposit(),
    contract.limitOfParticipants(),
    contract.registered(),
    contract.attended(),
    contract.ended(),
    contract.cancelled(),
    contract.payoutAmount(),
    contract.totalBalance(),
  ]);

  return {
    name,
    deposit,
    limitOfParticipants: Number(limitOfParticipants),
    registered: Number(registered),
    attended: Number(attended),
    ended,
    cancelled,
    payoutAmount,
    totalBalance,
  };
}

/**
 * Get participant info
 */
async function getParticipant(contract, address) {
  const participant = await contract.participants(address);

  return {
    participantName: participant[0],
    addr: participant[1],
    attended: participant[2],
    paid: participant[3],
  };
}

/**
 * Advance blockchain time (Anvil-specific)
 */
async function advanceTime(contract, seconds) {
  const provider = contract.runner.provider;

  // Use Anvil's evm_increaseTime and evm_mine
  await provider.send('evm_increaseTime', [seconds]);
  await provider.send('evm_mine', []);
}

/**
 * Get current block timestamp
 */
async function getBlockTimestamp(contract) {
  const provider = contract.runner.provider;
  const block = await provider.getBlock('latest');
  return block.timestamp;
}

/**
 * Reset Anvil to clean state
 */
async function resetAnvil() {
  // First reset the blockchain state
  const provider = new ethers.JsonRpcProvider(TEST_CONFIG.rpcUrl);
  await provider.send('anvil_reset', []);
  // Reset the shared provider to avoid stale nonce caching
  resetProvider();
}

/**
 * Get balance for an account
 */
async function getBalance(contract, accountKey) {
  const provider = contract.runner.provider;
  const address = getAddress(accountKey);
  return provider.getBalance(address);
}

module.exports = {
  // Configuration
  ANVIL_ACCOUNTS,
  TEST_CONFIG,
  DEFAULT_DEPOSIT,

  // Setup
  createProvider,
  loadArtifacts,
  deployContract,
  getSigner,
  getAddress,
  isAnvilRunning,
  resetAnvil,

  // Contract interactions
  register,
  attend,
  payback,
  cancel,
  withdraw,
  grantAdmin,

  // State queries
  getContractState,
  getParticipant,
  getBalance,

  // Time manipulation
  advanceTime,
  getBlockTimestamp,
};
