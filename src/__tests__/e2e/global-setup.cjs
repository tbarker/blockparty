/**
 * Global Setup for E2E Tests
 *
 * Starts Anvil and deploys the Conference contract before tests run.
 * Contract address is stored for tests to use.
 *
 * Uses ethers.js directly instead of forge CLI to avoid PATH issues in CI.
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const ANVIL_PORT = 8545;
// Use 127.0.0.1 instead of localhost to avoid IPv6 issues
// Node.js fetch may resolve localhost to ::1 (IPv6) but Anvil listens on 0.0.0.0 (IPv4)
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
async function deployContract() {
  console.log('[E2E Setup] Deploying Conference contract...');

  // Dynamic import for ethers (ESM module)
  const { ethers } = await import('ethers');

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

  // Connect to Anvil
  const provider = new ethers.JsonRpcProvider(ANVIL_URL);
  const wallet = new ethers.Wallet(DEPLOYER_PRIVATE_KEY, provider);

  // Deploy contract with constructor args:
  // name: "E2E Test Event"
  // deposit: 0.02 ETH (20000000000000000 wei)
  // limitOfParticipants: 20
  // coolingPeriod: 604800 (1 week in seconds)
  // encryption: "" (empty string)
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

  console.log(`[E2E Setup] Contract deployed at: ${contractAddress}`);

  return contractAddress;
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

    // Deploy contract
    const contractAddress = await deployContract();

    // Save state for tests
    saveState({
      anvilUrl: ANVIL_URL,
      contractAddress,
      chainId: 1337,
      wasAnvilRunning: alreadyRunning,
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

    console.log('[E2E Setup] Global setup complete - contract at', contractAddress);
  } catch (error) {
    console.error('[E2E Setup] FATAL ERROR:', error);
    console.error('[E2E Setup] Stack trace:', error.stack);
    throw error;
  }
}

module.exports = globalSetup;
