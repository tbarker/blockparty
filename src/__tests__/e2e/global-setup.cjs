/**
 * Global Setup for E2E Tests
 *
 * Starts Anvil and deploys the Conference contract before tests run.
 * Contract address is stored for tests to use.
 */

const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const ANVIL_PORT = 8545;
const ANVIL_URL = `http://127.0.0.1:${ANVIL_PORT}`;
const STATE_FILE = path.join(__dirname, '.e2e-state.json');

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

  const anvil = spawn('anvil', ['--port', ANVIL_PORT.toString(), '--chain-id', '1337'], {
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: true,
  });

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
 * Deploy the Conference contract using Forge script
 */
async function deployContract() {
  console.log('[E2E Setup] Deploying Conference contract...');

  const projectRoot = path.join(__dirname, '../../..');

  // Use forge create for deployment with --broadcast to actually deploy
  const result = execSync(
    `forge create contracts/Conference.sol:Conference ` +
      `--rpc-url ${ANVIL_URL} ` +
      `--private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 ` +
      `--broadcast ` +
      `--constructor-args "E2E Test Event" 20000000000000000 20 604800 ""`,
    {
      cwd: projectRoot,
      encoding: 'utf-8',
    }
  );

  // Parse contract address from output
  const addressMatch = result.match(/Deployed to: (0x[a-fA-F0-9]{40})/);
  if (!addressMatch) {
    console.error('Forge output:', result);
    throw new Error('Failed to parse contract address from forge output');
  }

  const contractAddress = addressMatch[1];
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

  // Check if Anvil is already running (e.g., started manually for debugging)
  const alreadyRunning = await isAnvilRunning();

  if (!alreadyRunning) {
    await startAnvil();
  } else {
    console.log('[E2E Setup] Anvil already running, resetting state...');
    // Reset Anvil to clean state
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

  console.log('[E2E Setup] Global setup complete');
}

module.exports = globalSetup;
