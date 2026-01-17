#!/usr/bin/env node
/**
 * Prepare MetaMask Extension for OnchainTestKit E2E Tests
 *
 * Downloads and extracts the MetaMask Chrome extension to the expected cache location.
 * This must be run before running E2E tests with OnchainTestKit.
 */

import { createRequire } from 'module';
import chalk from 'chalk';
import fs from 'fs-extra';
import path from 'path';

// Use createRequire to import the CommonJS module from OnchainTestKit
const require = createRequire(import.meta.url);
const pkgPath = path.join(process.cwd(), 'node_modules', '@coinbase', 'onchaintestkit', 'dist', 'src', 'wallets', 'MetaMask', 'utils', 'downloadMetamask.js');
const { downloadMetaMask } = require(pkgPath);

const CACHE_DIR = path.join(process.cwd(), 'e2e', '.cache', 'metamask-extension');

async function main() {
  console.log(chalk.blue('\n[OnchainTestKit] Preparing MetaMask extension...\n'));

  try {
    // Check if already cached at the expected location
    const existingDirs = await fs.readdir(CACHE_DIR).catch(() => []);
    const existingVersion = existingDirs.find((d) => d.startsWith('metamask-'));

    if (existingVersion) {
      const markerPath = path.join(CACHE_DIR, existingVersion, '.extraction_complete');
      if (await fs.pathExists(markerPath)) {
        console.log(chalk.green(`[OnchainTestKit] MetaMask already cached at ${CACHE_DIR}/${existingVersion}`));
        console.log(chalk.blue('[OnchainTestKit] To force re-download, delete the cache directory and run again.\n'));
        return;
      }
    }

    // Download and extract MetaMask
    console.log(chalk.yellow('[OnchainTestKit] Downloading MetaMask extension from GitHub...'));
    const extractedPath = await downloadMetaMask();

    // OnchainTestKit downloads to /tmp but looks for extension in e2e/.cache
    // Copy to the expected location
    const versionDir = path.basename(extractedPath); // e.g., "metamask-12.8.1"
    const targetPath = path.join(CACHE_DIR, versionDir);

    if (extractedPath !== targetPath) {
      console.log(chalk.yellow(`[OnchainTestKit] Copying to expected location: ${targetPath}`));
      await fs.ensureDir(CACHE_DIR);
      await fs.copy(extractedPath, targetPath, { overwrite: true });
    }

    // Create completion marker
    const markerPath = path.join(targetPath, '.extraction_complete');
    await fs.writeFile(markerPath, new Date().toISOString());

    console.log(chalk.green(`\n[OnchainTestKit] MetaMask extension ready at: ${targetPath}`));
    console.log(chalk.blue('[OnchainTestKit] You can now run: npm run test:e2e:onchainkit\n'));
  } catch (error) {
    console.error(chalk.red('\n[OnchainTestKit] Failed to prepare MetaMask:'), error.message);
    process.exit(1);
  }
}

main();
