#!/usr/bin/env node
/**
 * Patch Synpress MetaMask extension loading
 *
 * This script applies necessary patches to Synpress to fix:
 * 1. MetaMask extension loading (add --load-extension arg)
 * 2. Custom Chromium executable path support (for older Chrome versions)
 *
 * Run this after `npm install` or `npm ci` to ensure patches are applied.
 * Add to package.json scripts: "postinstall": "node scripts/patch-synpress.js"
 */

const fs = require('fs');
const path = require('path');

const SYNPRESS_PLAYWRIGHT_PATH = path.join(
  __dirname,
  '..',
  'node_modules',
  '@synthetixio',
  'synpress-metamask',
  'dist',
  'playwright',
  'index.js'
);

function patchSynpress() {
  console.log('Patching Synpress for MetaMask extension loading...');

  if (!fs.existsSync(SYNPRESS_PLAYWRIGHT_PATH)) {
    console.log('Synpress not installed yet, skipping patch.');
    return;
  }

  let content = fs.readFileSync(SYNPRESS_PLAYWRIGHT_PATH, 'utf8');
  let modified = false;

  // Patch 1: Add --load-extension argument
  // The original only has --disable-extensions-except but Chrome also needs --load-extension
  const extensionPatternBefore =
    'const browserArgs = [`--disable-extensions-except=${metamaskPath}`];';
  const extensionPatternAfter =
    'const browserArgs = [`--disable-extensions-except=${metamaskPath}`, `--load-extension=${metamaskPath}`];';

  if (content.includes(extensionPatternBefore)) {
    content = content.replace(extensionPatternBefore, extensionPatternAfter);
    console.log('  Applied: --load-extension argument patch');
    modified = true;
  } else if (content.includes(extensionPatternAfter)) {
    console.log('  Skipped: --load-extension already patched');
  } else {
    console.log('  Warning: Could not find extension loading pattern to patch');
  }

  // Patch 2: Add executablePath support for custom Chromium
  // This allows using SYNPRESS_CHROMIUM_PATH env var to specify older Chrome
  const contextPatternBefore =
    'const context = await chromium.launchPersistentContext(_contextPath, {';
  const contextPatternAfter =
    'const context = await chromium.launchPersistentContext(_contextPath, { executablePath: process.env.SYNPRESS_CHROMIUM_PATH || undefined,';

  if (content.includes(contextPatternBefore) && !content.includes('SYNPRESS_CHROMIUM_PATH')) {
    content = content.replace(contextPatternBefore, contextPatternAfter);
    console.log('  Applied: executablePath support patch');
    modified = true;
  } else if (content.includes('SYNPRESS_CHROMIUM_PATH')) {
    console.log('  Skipped: executablePath already patched');
  } else {
    console.log('  Warning: Could not find context launch pattern to patch');
  }

  if (modified) {
    fs.writeFileSync(SYNPRESS_PLAYWRIGHT_PATH, content);
    console.log('Synpress patches applied successfully!');
  } else {
    console.log('No patches needed.');
  }
}

// Run the patch
try {
  patchSynpress();
} catch (error) {
  console.error('Error patching Synpress:', error.message);
  // Don't fail the build if patching fails
  process.exit(0);
}
