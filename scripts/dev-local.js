#!/usr/bin/env node

/**
 * Local development startup script
 *
 * This script orchestrates the full local development environment:
 * 1. Starts Anvil (local Ethereum node) with chain ID 1337
 * 2. Waits for Anvil to be ready
 * 3. Deploys the ConferenceFactory and an initial Conference contract
 * 4. Starts the webpack dev server with the deployed contract addresses
 *
 * Usage:
 *   npm run dev:local
 *   node scripts/dev-local.js
 *
 * The script automatically cleans up (kills Anvil) when you press Ctrl+C.
 */

const { spawn, execSync } = require('child_process');
const http = require('http');

// Configuration
const ANVIL_PORT = 8545;
const ANVIL_CHAIN_ID = 1337;
const DEV_SERVER_PORT = 3000;
const ANVIL_URL = `http://localhost:${ANVIL_PORT}`;

// Anvil's default first account (pre-funded with 10,000 ETH)
const ANVIL_SENDER = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';
const ANVIL_PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';

// Track child processes for cleanup
let anvilProcess = null;
let devServerProcess = null;

/**
 * Log a message with a prefix
 */
function log(message, prefix = 'dev-local') {
  const timestamp = new Date().toLocaleTimeString();
  console.log(`[${timestamp}] [${prefix}] ${message}`);
}

/**
 * Check if Anvil is ready by making an RPC call
 */
function checkAnvilReady() {
  return new Promise(resolve => {
    const postData = JSON.stringify({
      jsonrpc: '2.0',
      method: 'eth_chainId',
      params: [],
      id: 1,
    });

    const req = http.request(
      ANVIL_URL,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData),
        },
        timeout: 1000,
      },
      res => {
        let data = '';
        res.on('data', chunk => (data += chunk));
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            resolve(json.result !== undefined);
          } catch {
            resolve(false);
          }
        });
      }
    );

    req.on('error', () => resolve(false));
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });

    req.write(postData);
    req.end();
  });
}

/**
 * Wait for Anvil to be ready with timeout
 */
async function waitForAnvil(maxAttempts = 30, intervalMs = 500) {
  log('Waiting for Anvil to be ready...');

  for (let i = 0; i < maxAttempts; i++) {
    if (await checkAnvilReady()) {
      log('Anvil is ready!');
      return true;
    }
    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }

  throw new Error(`Anvil did not become ready after ${(maxAttempts * intervalMs) / 1000} seconds`);
}

/**
 * Start Anvil local Ethereum node
 */
function startAnvil() {
  return new Promise((resolve, reject) => {
    log(`Starting Anvil on port ${ANVIL_PORT} with chain ID ${ANVIL_CHAIN_ID}...`);

    anvilProcess = spawn(
      'anvil',
      ['--chain-id', String(ANVIL_CHAIN_ID), '--port', String(ANVIL_PORT), '--host', '0.0.0.0'],
      {
        stdio: ['ignore', 'pipe', 'pipe'],
      }
    );

    let started = false;

    anvilProcess.stdout.on('data', data => {
      const output = data.toString();
      // Log Anvil output with prefix
      output
        .trim()
        .split('\n')
        .forEach(line => {
          if (line.trim()) {
            console.log(`[anvil] ${line}`);
          }
        });

      // Check if Anvil has started
      if (!started && output.includes('Listening on')) {
        started = true;
        resolve();
      }
    });

    anvilProcess.stderr.on('data', data => {
      const output = data.toString();
      output
        .trim()
        .split('\n')
        .forEach(line => {
          if (line.trim()) {
            console.error(`[anvil] ${line}`);
          }
        });
    });

    anvilProcess.on('error', err => {
      if (err.code === 'ENOENT') {
        reject(
          new Error(
            'Anvil not found. Please install Foundry: https://book.getfoundry.sh/getting-started/installation'
          )
        );
      } else {
        reject(err);
      }
    });

    anvilProcess.on('close', code => {
      if (!started) {
        reject(new Error(`Anvil exited with code ${code} before becoming ready`));
      }
    });

    // Fallback: also try polling in case we miss the log message
    setTimeout(async () => {
      if (!started) {
        try {
          await waitForAnvil(20, 500);
          started = true;
          resolve();
        } catch (err) {
          reject(err);
        }
      }
    }, 1000);
  });
}

/**
 * Deploy contracts using forge script
 * Returns { factoryAddress, conferenceAddress }
 */
function deployContracts() {
  return new Promise((resolve, reject) => {
    log('Deploying contracts...');

    try {
      // Run forge script and capture output
      const result = execSync(
        `forge script script/Deploy.s.sol:DeployConferenceFactoryLocal --broadcast --rpc-url ${ANVIL_URL} --sender ${ANVIL_SENDER} --private-key ${ANVIL_PRIVATE_KEY}`,
        {
          encoding: 'utf-8',
          stdio: ['pipe', 'pipe', 'pipe'],
        }
      );

      // Parse the output to find addresses
      const lines = result.split('\n');
      let factoryAddress = null;
      let conferenceAddress = null;

      for (const line of lines) {
        if (line.includes('ConferenceFactory deployed at:')) {
          factoryAddress = line.split(':').pop().trim();
        }
        if (line.includes('Initial Conference (proxy) deployed at:')) {
          conferenceAddress = line.split(':').pop().trim();
        }
      }

      if (!factoryAddress || !conferenceAddress) {
        // Try alternative parsing - look for hex addresses after known text
        const factoryMatch = result.match(/ConferenceFactory deployed at:\s*(0x[a-fA-F0-9]{40})/);
        const conferenceMatch = result.match(
          /Initial Conference.*?deployed at:\s*(0x[a-fA-F0-9]{40})/
        );

        factoryAddress = factoryMatch ? factoryMatch[1] : null;
        conferenceAddress = conferenceMatch ? conferenceMatch[1] : null;
      }

      if (!factoryAddress || !conferenceAddress) {
        console.log('Forge output:', result);
        reject(new Error('Could not parse contract addresses from forge output'));
        return;
      }

      log(`Factory deployed at: ${factoryAddress}`);
      log(`Conference deployed at: ${conferenceAddress}`);

      resolve({ factoryAddress, conferenceAddress });
    } catch (error) {
      console.error('Forge output:', error.stdout || error.message);
      console.error('Forge stderr:', error.stderr || '');
      reject(new Error(`Failed to deploy contracts: ${error.message}`));
    }
  });
}

/**
 * Start the webpack dev server
 */
function startDevServer(contractAddress, factoryAddress) {
  return new Promise((resolve, reject) => {
    log(`Starting dev server on port ${DEV_SERVER_PORT}...`);

    const env = {
      ...process.env,
      CONTRACT_ADDRESS: contractAddress,
      FACTORY_ADDRESS: factoryAddress,
    };

    devServerProcess = spawn(
      'npx',
      ['webpack', 'serve', '--mode', 'development', '--port', String(DEV_SERVER_PORT)],
      {
        env,
        stdio: ['ignore', 'pipe', 'pipe'],
      }
    );

    let started = false;

    devServerProcess.stdout.on('data', data => {
      const output = data.toString();
      output
        .trim()
        .split('\n')
        .forEach(line => {
          if (line.trim()) {
            console.log(`[webpack] ${line}`);
          }
        });

      // Check if server has started
      if (!started && (output.includes('compiled') || output.includes('Loopback:'))) {
        started = true;
        resolve();
      }
    });

    devServerProcess.stderr.on('data', data => {
      const output = data.toString();
      output
        .trim()
        .split('\n')
        .forEach(line => {
          if (line.trim()) {
            // Webpack outputs a lot to stderr that isn't actually errors
            console.log(`[webpack] ${line}`);
          }
        });

      // Also check stderr for server ready messages
      if (!started && (output.includes('compiled') || output.includes('Loopback:'))) {
        started = true;
        resolve();
      }
    });

    devServerProcess.on('error', reject);

    devServerProcess.on('close', code => {
      if (!started) {
        reject(new Error(`Dev server exited with code ${code} before becoming ready`));
      }
    });

    // Fallback timeout - assume it's ready after 15 seconds
    setTimeout(() => {
      if (!started) {
        started = true;
        resolve();
      }
    }, 15000);
  });
}

/**
 * Cleanup function to kill child processes
 */
function cleanup() {
  log('Shutting down...');

  if (devServerProcess) {
    log('Stopping dev server...');
    devServerProcess.kill('SIGTERM');
    devServerProcess = null;
  }

  if (anvilProcess) {
    log('Stopping Anvil...');
    anvilProcess.kill('SIGTERM');
    anvilProcess = null;
  }
}

/**
 * Main function
 */
async function main() {
  console.log('');
  console.log('========================================');
  console.log('  BlockParty Local Development Server  ');
  console.log('========================================');
  console.log('');

  // Set up cleanup handlers
  process.on('SIGINT', () => {
    cleanup();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    cleanup();
    process.exit(0);
  });

  process.on('exit', cleanup);

  try {
    // Step 1: Start Anvil
    await startAnvil();
    console.log('');

    // Step 2: Deploy contracts
    const { factoryAddress, conferenceAddress } = await deployContracts();
    console.log('');

    // Step 3: Start dev server
    await startDevServer(conferenceAddress, factoryAddress);
    console.log('');

    // Print success message
    console.log('========================================');
    console.log('  Local development environment ready! ');
    console.log('========================================');
    console.log('');
    console.log(`  App:        http://localhost:${DEV_SERVER_PORT}`);
    console.log(
      `  App (with contract): http://localhost:${DEV_SERVER_PORT}?contract=${conferenceAddress}`
    );
    console.log(`  Anvil RPC:  ${ANVIL_URL}`);
    console.log('');
    console.log('  Contract Addresses:');
    console.log(`    Factory:    ${factoryAddress}`);
    console.log(`    Conference: ${conferenceAddress}`);
    console.log('');
    console.log('  MetaMask Setup:');
    console.log('    Network Name: Localhost 8545');
    console.log(`    RPC URL:      ${ANVIL_URL}`);
    console.log(`    Chain ID:     ${ANVIL_CHAIN_ID}`);
    console.log('    Currency:     ETH');
    console.log('');
    console.log('  Test Account (pre-funded with 10,000 ETH):');
    console.log(`    Address:     ${ANVIL_SENDER}`);
    console.log(`    Private Key: ${ANVIL_PRIVATE_KEY}`);
    console.log('');
    console.log('  Arweave devnet mode is auto-enabled for localhost.');
    console.log('');
    console.log('  Press Ctrl+C to stop all services.');
    console.log('');
  } catch (error) {
    console.error('');
    console.error(`Error: ${error.message}`);
    console.error('');
    cleanup();
    process.exit(1);
  }
}

main();
