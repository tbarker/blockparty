/**
 * Ensure Synpress wallet cache exists before running E2E tests.
 *
 * Synpress caches the MetaMask extension with pre-configured wallet state
 * to speed up test startup. This script checks if the cache exists and
 * builds it if missing.
 *
 * The cache is stored in src/__tests__/e2e-synpress/wallet-setup/ with a
 * hash-based directory name (e.g., basic.setup.ts-abc123/).
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const WALLET_SETUP_DIR = path.join(__dirname, '../src/__tests__/e2e-synpress/wallet-setup');

/**
 * Check if Synpress cache exists.
 * The cache is a directory in wallet-setup/ that contains the cached browser state.
 * Synpress creates directories with hash-based names like "532f685e346606c2a803".
 */
function cacheExists() {
  try {
    const entries = fs.readdirSync(WALLET_SETUP_DIR, { withFileTypes: true });
    // Look for directories that look like hash-based cache directories
    // They are hexadecimal strings (not .ts files or other source files)
    const cacheDirs = entries.filter(entry => {
      if (!entry.isDirectory()) return false;
      // Synpress creates directories with hex hash names (e.g., "532f685e346606c2a803")
      // These are 20 hex characters
      return /^[0-9a-f]{20}$/.test(entry.name);
    });
    if (cacheDirs.length > 0) {
      console.log(`Found Synpress cache: ${cacheDirs.map(d => d.name).join(', ')}`);
    }
    return cacheDirs.length > 0;
  } catch (_err) {
    return false;
  }
}

/**
 * Build the Synpress wallet cache using xvfb for headful browser.
 */
function buildCache() {
  console.log('Synpress wallet cache not found. Building cache...');
  console.log('This may take a minute on first run.\n');

  try {
    execSync('xvfb-run npx synpress src/__tests__/e2e-synpress/wallet-setup', {
      stdio: 'inherit',
      cwd: path.join(__dirname, '..'),
    });
    console.log('\nSynpress wallet cache built successfully.');
  } catch (err) {
    console.error('Failed to build Synpress cache:', err.message);
    process.exit(1);
  }
}

// Main
if (cacheExists()) {
  console.log('Synpress wallet cache found.');
} else {
  buildCache();
}
