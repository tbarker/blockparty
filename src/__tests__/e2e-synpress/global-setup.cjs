/**
 * Global Setup for E2E Tests
 *
 * Starts Anvil and deploys contracts before tests run:
 * - Conference contract (for existing event tests)
 * - ConferenceFactory contract (for create event tests)
 *
 * Contract addresses are stored for tests to use.
 *
 * Uses ethers.js directly instead of forge CLI to avoid PATH issues in CI.
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const ANVIL_PORT = 8545;
// URL for both Node.js and browser to connect to Anvil
// Using 127.0.0.1 to avoid DNS resolution issues in containers
const ANVIL_URL = `http://127.0.0.1:${ANVIL_PORT}`;
const STATE_FILE = path.join(__dirname, '.e2e-state.json');

// Anvil's first pre-funded account (deployer)
const DEPLOYER_PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';

/**
 * Check if Anvil is already running
 */
async function isAnvilRunning() {
  try {
    const response = await fetch(ANVIL_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_chainId',
        params: [],
        id: 1,
      }),
    });
    const result = await response.json();
    return result.result === '0x539'; // 1337
  } catch {
    return false;
  }
}

/**
 * Start Anvil in the background
 */
async function startAnvil() {
  console.log('[E2E Setup] Starting Anvil...');

  // Use --host 0.0.0.0 to bind to all interfaces, ensuring browser can access it
  const anvil = spawn(
    'anvil',
    ['--host', '0.0.0.0', '--port', ANVIL_PORT.toString(), '--chain-id', '1337'],
    {
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: true,
    }
  );

  // Store PID for cleanup
  global.__ANVIL_PID__ = anvil.pid;

  // Wait for Anvil to be ready
  let attempts = 0;
  while (attempts < 30) {
    if (await isAnvilRunning()) {
      console.log('[E2E Setup] Anvil is ready');
      return anvil;
    }
    await new Promise(resolve => setTimeout(resolve, 500));
    attempts++;
  }

  throw new Error('Anvil failed to start within 15 seconds');
}

/**
 * Deploy the Conference contract using ethers.js
 * This avoids dependency on forge CLI being in PATH
 */
async function deployConferenceContract(ethers, provider, wallet) {
  console.log('[E2E Setup] Deploying Conference contract...');

  // Load the compiled contract artifact from forge output
  const projectRoot = path.join(__dirname, '../../..');
  const artifactPath = path.join(projectRoot, 'out/Conference.sol/Conference.json');

  if (!fs.existsSync(artifactPath)) {
    throw new Error(
      `Contract artifact not found at ${artifactPath}. ` +
        'Make sure to run "forge build" before running E2E tests.'
    );
  }

  const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf-8'));
  const abi = artifact.abi;
  const bytecode = artifact.bytecode.object;

  // Deploy contract with constructor args:
  // name: "E2E Test Event"
  // deposit: 0.02 ETH (20000000000000000 wei)
  // limitOfParticipants: 20
  // coolingPeriod: 604800 (1 week in seconds)
  // metadataUri: "" (empty for E2E tests)
  const factory = new ethers.ContractFactory(abi, bytecode, wallet);
  const contract = await factory.deploy(
    'E2E Test Event',
    ethers.parseEther('0.02'),
    20,
    604800,
    ''
  );

  await contract.waitForDeployment();
  const contractAddress = await contract.getAddress();

  console.log(`[E2E Setup] Conference deployed at: ${contractAddress}`);

  // Verify the contract was actually deployed by checking its code
  const code = await provider.getCode(contractAddress);
  if (code === '0x' || code === '0x0' || !code) {
    throw new Error(
      `Contract deployment verification failed! No code at ${contractAddress}. ` +
        'The deployment transaction may have succeeded but the contract was not created.'
    );
  }
  console.log(`[E2E Setup] Conference verified (code length: ${code.length} chars)`);

  // Verify the contract is callable by reading its name
  const deployedContract = new ethers.Contract(contractAddress, abi, provider);
  const name = await deployedContract.name();
  if (name !== 'E2E Test Event') {
    throw new Error(
      `Contract functional verification failed! Expected name "E2E Test Event" but got "${name}"`
    );
  }
  console.log(`[E2E Setup] Conference functional test passed (name: ${name})`);

  return contractAddress;
}

/**
 * Deploy the ConferenceFactory contract using ethers.js
 */
async function deployFactoryContract(ethers, provider, wallet) {
  console.log('[E2E Setup] Deploying ConferenceFactory contract...');

  const projectRoot = path.join(__dirname, '../../..');
  const artifactPath = path.join(projectRoot, 'out/ConferenceFactory.sol/ConferenceFactory.json');

  if (!fs.existsSync(artifactPath)) {
    throw new Error(
      `Factory artifact not found at ${artifactPath}. ` +
        'Make sure to run "forge build" before running E2E tests.'
    );
  }

  const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf-8'));
  const abi = artifact.abi;
  const bytecode = artifact.bytecode.object;

  // Deploy factory with deployer as initial owner
  const deployerAddress = await wallet.getAddress();
  const factory = new ethers.ContractFactory(abi, bytecode, wallet);
  const contract = await factory.deploy(deployerAddress);

  await contract.waitForDeployment();
  const factoryAddress = await contract.getAddress();

  console.log(`[E2E Setup] ConferenceFactory deployed at: ${factoryAddress}`);

  // Verify the contract was deployed
  const code = await provider.getCode(factoryAddress);
  if (code === '0x' || code === '0x0' || !code) {
    throw new Error(`Factory deployment verification failed! No code at ${factoryAddress}.`);
  }
  console.log(`[E2E Setup] Factory verified (code length: ${code.length} chars)`);

  // Verify the factory is callable
  const deployedFactory = new ethers.Contract(factoryAddress, abi, provider);
  const conferenceCount = await deployedFactory.conferenceCount();
  console.log(`[E2E Setup] Factory functional test passed (conferenceCount: ${conferenceCount})`);

  return factoryAddress;
}

/**
 * Deploy all contracts needed for E2E tests
 */
async function deployContracts() {
  // Dynamic import for ethers (ESM module)
  const { ethers } = await import('ethers');

  // Connect to Anvil with disabled cache to avoid nonce issues after reset
  const provider = new ethers.JsonRpcProvider(ANVIL_URL, undefined, {
    cacheTimeout: -1, // Disable caching to always get fresh nonces
  });
  const wallet = new ethers.Wallet(DEPLOYER_PRIVATE_KEY, provider);

  // Deploy both contracts
  const contractAddress = await deployConferenceContract(ethers, provider, wallet);
  const factoryAddress = await deployFactoryContract(ethers, provider, wallet);

  return { contractAddress, factoryAddress };
}

/**
 * Save state for tests to use
 */
function saveState(state) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  console.log('[E2E Setup] State saved:', state);
}

/**
 * Main setup function
 */
async function globalSetup() {
  console.log('[E2E Setup] Starting global setup...');

  try {
    // Check if Anvil is already running (e.g., started manually for debugging)
    const alreadyRunning = await isAnvilRunning();
    console.log('[E2E Setup] Anvil already running:', alreadyRunning);

    if (!alreadyRunning) {
      await startAnvil();
    } else {
      console.log('[E2E Setup] Anvil already running, resetting state...');
      // Reset Anvil to clean state
      try {
        await fetch(ANVIL_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'anvil_reset',
            params: [],
            id: 1,
          }),
        });
        console.log('[E2E Setup] Anvil state reset successful');
      } catch (resetError) {
        console.warn('[E2E Setup] Anvil reset failed (continuing):', resetError.message);
      }
    }

    // Deploy contracts
    const { contractAddress, factoryAddress } = await deployContracts();

    // Save state for tests
    // Note: anvilPid is stored so global-teardown (which runs in a separate process) can kill it
    saveState({
      anvilUrl: ANVIL_URL,
      contractAddress,
      factoryAddress,
      chainId: 1337,
      wasAnvilRunning: alreadyRunning,
      anvilPid: global.__ANVIL_PID__ || null,
    });

    // Verify state file was created
    if (!fs.existsSync(STATE_FILE)) {
      throw new Error('State file was not created!');
    }

    // Final verification that Anvil is still running and accessible
    const finalCheck = await isAnvilRunning();
    if (!finalCheck) {
      throw new Error('Anvil is not running after setup! Tests will fail.');
    }

    console.log('[E2E Setup] Global setup complete');
    console.log('[E2E Setup]   Conference at:', contractAddress);
    console.log('[E2E Setup]   Factory at:', factoryAddress);
  } catch (error) {
    console.error('[E2E Setup] FATAL ERROR:', error);
    console.error('[E2E Setup] Stack trace:', error.stack);
    throw error;
  }
}

module.exports = globalSetup;
