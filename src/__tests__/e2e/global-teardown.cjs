/**
 * Global Teardown for E2E Tests
 *
 * Cleans up Anvil process if we started it.
 */

const path = require('path');
const fs = require('fs');

const STATE_FILE = path.join(__dirname, '.e2e-state.json');

/**
 * Load state from setup
 */
function loadState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
  } catch {
    return null;
  }
}

/**
 * Clean up state file
 */
function cleanupState() {
  try {
    fs.unlinkSync(STATE_FILE);
  } catch {
    // Ignore if file doesn't exist
  }
}

/**
 * Main teardown function
 */
async function globalTeardown() {
  console.log('[E2E Teardown] Starting global teardown...');

  const state = loadState();

  // Only kill Anvil if we started it
  if (state && !state.wasAnvilRunning && global.__ANVIL_PID__) {
    console.log(`[E2E Teardown] Stopping Anvil (PID: ${global.__ANVIL_PID__})...`);
    try {
      process.kill(global.__ANVIL_PID__, 'SIGTERM');
    } catch (error) {
      // Process may have already exited
      console.log('[E2E Teardown] Anvil process already stopped');
    }
  }

  // Clean up state file
  cleanupState();

  console.log('[E2E Teardown] Global teardown complete');
}

module.exports = globalTeardown;
