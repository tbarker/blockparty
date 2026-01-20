#!/usr/bin/env node
/**
 * Prepare Coinbase Wallet Extension for OnchainTestKit E2E Tests
 *
 * Downloads and extracts the Coinbase Wallet Chrome extension to the expected cache location.
 * This must be run before running E2E tests with OnchainTestKit when using Coinbase Wallet.
 */

import chalk from 'chalk';
import fs from 'fs-extra';
import path from 'path';
import extract from 'extract-zip';

// Constants for Coinbase Wallet
// Using the archived version from TenKeyLabs/coinbase-wallet-archive
// This ensures we get the exact version that OnchainTestKit expects
const COINBASE_VERSION = '3.117.1';
const DOWNLOAD_URL = `https://github.com/TenKeyLabs/coinbase-wallet-archive/releases/download/${COINBASE_VERSION}/coinbase-wallet-chrome-${COINBASE_VERSION}.zip`;
const CACHE_DIR = path.join(process.cwd(), 'e2e', '.cache', 'coinbase-extension');

/**
 * Download with retry logic for CI environments
 */
async function downloadWithRetry(url, maxRetries = 3) {
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(chalk.yellow(`Download attempt ${attempt} of ${maxRetries}...`));
      const response = await fetch(url, {
        redirect: 'follow',
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return response;
    } catch (error) {
      lastError = error;
      console.error(chalk.red(`Attempt ${attempt} failed: ${error.message}`));

      if (attempt < maxRetries) {
        const waitTime = Math.min(1000 * 2 ** (attempt - 1), 10000);
        console.log(chalk.yellow(`Waiting ${waitTime}ms before retry...`));
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
  }

  throw new Error(`Failed after ${maxRetries} attempts: ${lastError.message}`);
}

async function main() {
  console.log(chalk.blue(`\n[OnchainTestKit] Preparing Coinbase Wallet extension v${COINBASE_VERSION}...\n`));

  try {
    // Ensure the cache directory exists
    await fs.ensureDir(CACHE_DIR);

    const extractionPath = path.join(CACHE_DIR, `coinbase-${COINBASE_VERSION}`);
    const markerPath = path.join(extractionPath, '.extraction_complete');

    // Check if already cached
    if (await fs.pathExists(markerPath)) {
      console.log(chalk.green(`[OnchainTestKit] Coinbase Wallet already cached at ${extractionPath}`));
      console.log(chalk.blue('[OnchainTestKit] To force re-download, delete the cache directory and run again.\n'));
      return;
    }

    // Download the ZIP file from the archive
    const zipPath = path.join(CACHE_DIR, `coinbase-${COINBASE_VERSION}.zip`);
    let cached = false;

    if (await fs.pathExists(zipPath)) {
      const stats = await fs.stat(zipPath);
      if (stats.size > 0) {
        console.log(chalk.yellow(`[OnchainTestKit] Using cached download at ${zipPath}`));
        cached = true;
      }
    }

    if (!cached) {
      console.log(chalk.yellow('[OnchainTestKit] Downloading Coinbase Wallet extension from GitHub archive...'));
      console.log(chalk.gray(`[OnchainTestKit] URL: ${DOWNLOAD_URL}`));
      const response = await downloadWithRetry(DOWNLOAD_URL, 3);
      const buffer = await response.arrayBuffer();
      await fs.writeFile(zipPath, Buffer.from(buffer));
      console.log(chalk.green('[OnchainTestKit] Download complete'));

      // Verify the download
      const downloadedStats = await fs.stat(zipPath);
      if (downloadedStats.size === 0) {
        await fs.remove(zipPath);
        throw new Error('Downloaded file is empty.');
      }
      console.log(`[OnchainTestKit] Downloaded ${(downloadedStats.size / 1024 / 1024).toFixed(2)} MB`);
    }

    // Clean any existing extraction directory
    if (await fs.pathExists(extractionPath)) {
      console.log(chalk.yellow(`[OnchainTestKit] Cleaning existing directory: ${extractionPath}`));
      await fs.emptyDir(extractionPath);
    }

    // Extract the ZIP file directly
    console.log(chalk.yellow(`[OnchainTestKit] Extracting to: ${extractionPath}`));
    await extract(zipPath, { dir: extractionPath });

    // Verify extraction succeeded
    const manifestPath = path.join(extractionPath, 'manifest.json');
    if (!(await fs.pathExists(manifestPath))) {
      throw new Error(`Extraction failed: manifest.json not found at ${manifestPath}`);
    }

    // Create completion marker
    await fs.writeFile(markerPath, new Date().toISOString());

    console.log(chalk.green(`\n[OnchainTestKit] Coinbase Wallet extension ready at: ${extractionPath}`));
    console.log(chalk.blue('[OnchainTestKit] You can now run: npm run test:e2e:coinbase\n'));
  } catch (error) {
    console.error(chalk.red('\n[OnchainTestKit] Failed to prepare Coinbase Wallet:'), error.message);
    process.exit(1);
  }
}

main();
