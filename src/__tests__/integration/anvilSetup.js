/**
 * Anvil (Foundry) integration test setup
 * Provides real blockchain interaction for integration tests using ethers.js
 *
 * Note: Anvil must be running externally before tests:
 *   anvil --chain-id 1337
 * Or use npm script:
 *   npm run anvil
 */

const { ethers } = require('ethers');
const path = require('path');
const fs = require('fs');

let provider;
let accounts;
let conferenceContract;

// Contract artifacts path (Forge output)
const artifactsPath = path.join(__dirname, '../../../out/Conference.sol/Conference.json');

/**
 * Connect to Anvil and deploy contracts
 */
async function setupAnvil() {
  // Connect to Anvil
  provider = new ethers.JsonRpcProvider('http://localhost:8545');

  try {
    await provider.getNetwork();
    console.log('Connected to Anvil on port 8545');
  } catch (error) {
    throw new Error('Cannot connect to Anvil. Start it with: anvil --chain-id 1337');
  }

  // Get accounts (Anvil provides 10 funded accounts by default)
  const signers = await Promise.all(Array.from({ length: 10 }, (_, i) => provider.getSigner(i)));
  accounts = await Promise.all(signers.map(s => s.getAddress()));

  // Deploy Conference contract if artifacts exist
  if (fs.existsSync(artifactsPath)) {
    const artifacts = JSON.parse(fs.readFileSync(artifactsPath, 'utf8'));
    const deployer = await provider.getSigner(0);

    const factory = new ethers.ContractFactory(artifacts.abi, artifacts.bytecode.object, deployer);

    conferenceContract = await factory.deploy(
      'Test Event', // name
      0, // deposit (0 = default 0.02 ETH)
      20, // limitOfParticipants
      0, // coolingPeriod (0 = default 1 week)
      '' // encryption
    );
    await conferenceContract.waitForDeployment();

    const address = await conferenceContract.getAddress();
    console.log('Conference contract deployed at:', address);
  }

  return {
    provider,
    accounts,
    conferenceContract,
  };
}

/**
 * Cleanup (no-op for Anvil - it runs externally)
 */
async function teardownAnvil() {
  console.log('Anvil teardown complete (Anvil continues running externally)');
}

/**
 * Get deployed contract instance
 */
function getContract() {
  return conferenceContract;
}

/**
 * Get ethers provider
 */
function getProvider() {
  return provider;
}

/**
 * Get test accounts
 */
function getAccounts() {
  return accounts;
}

/**
 * Get signer for an account index
 */
async function getSigner(index = 0) {
  return provider.getSigner(index);
}

/**
 * Register a participant
 */
async function registerParticipant(twitterHandle, fromIndex, depositAmount) {
  if (!conferenceContract) {
    throw new Error('Contract not deployed. Run setupAnvil first.');
  }

  const signer = await provider.getSigner(fromIndex);
  const contractWithSigner = conferenceContract.connect(signer);

  const deposit = depositAmount || (await conferenceContract.deposit());

  return contractWithSigner.register(twitterHandle, { value: deposit });
}

/**
 * Mark participant as attended
 */
async function attendParticipant(participantAddress, fromOwnerIndex = 0) {
  if (!conferenceContract) {
    throw new Error('Contract not deployed. Run setupAnvil first.');
  }

  const signer = await provider.getSigner(fromOwnerIndex);
  const contractWithSigner = conferenceContract.connect(signer);

  return contractWithSigner.attend([participantAddress]);
}

/**
 * Get contract details
 */
async function getContractDetails() {
  if (!conferenceContract) {
    throw new Error('Contract not deployed. Run setupAnvil first.');
  }

  const [name, deposit, registered, attended, ended, limitOfParticipants] = await Promise.all([
    conferenceContract.name(),
    conferenceContract.deposit(),
    conferenceContract.registered(),
    conferenceContract.attended(),
    conferenceContract.ended(),
    conferenceContract.limitOfParticipants(),
  ]);

  return {
    name,
    deposit,
    registered: Number(registered),
    attended: Number(attended),
    ended,
    limitOfParticipants: Number(limitOfParticipants),
  };
}

module.exports = {
  setupAnvil,
  teardownAnvil,
  getContract,
  getProvider,
  getAccounts,
  getSigner,
  registerParticipant,
  attendParticipant,
  getContractDetails,
};
