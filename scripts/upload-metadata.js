#!/usr/bin/env node

/**
 * Upload event metadata and media to Arweave via ArDrive Turbo
 *
 * Usage:
 *   node scripts/upload-metadata.js <metadata.json> [options]
 *
 * Options:
 *   --devnet     Use ArDrive Turbo dev services (for testing)
 *   --dry-run    Show upload cost estimate without uploading
 *
 * Environment:
 *   ARWEAVE_PRIVATE_KEY   Ethereum private key for payment (preferred)
 *   ARWEAVE_SEED_PHRASE   Seed phrase (12/24 words) - alternative to private key
 *   PRIVATE_KEY           Legacy: Ethereum private key for payment
 *
 * Example:
 *   ARWEAVE_PRIVATE_KEY=0x... node scripts/upload-metadata.js ./metadata/event/metadata.json
 *   ARWEAVE_SEED_PHRASE="word1 word2 ..." node scripts/upload-metadata.js ./metadata/event/metadata.json --devnet
 */

const fs = require('fs').promises;
const path = require('path');

// ArDrive Turbo development service URLs (for devnet mode)
const DEV_PAYMENT_SERVICE = 'https://payment.ardrive.dev';
const DEV_UPLOAD_SERVICE = 'https://upload.ardrive.dev';

// MIME type mapping for common file extensions
const MIME_TYPES = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.pdf': 'application/pdf',
  '.json': 'application/json',
};

function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return MIME_TYPES[ext] || 'application/octet-stream';
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatCredits(winc) {
  // 1 credit = 1,000,000,000,000 winc (10^12)
  const credits = Number(winc) / 1e12;
  return credits < 0.001 ? `${winc} winc` : `${credits.toFixed(6)} credits`;
}

/**
 * Get private key from environment variables
 * Supports: ARWEAVE_PRIVATE_KEY, ARWEAVE_SEED_PHRASE, or legacy PRIVATE_KEY
 */
async function getPrivateKey() {
  // Check for explicit Arweave private key first
  if (process.env.ARWEAVE_PRIVATE_KEY) {
    return process.env.ARWEAVE_PRIVATE_KEY;
  }

  // Check for seed phrase and derive private key
  if (process.env.ARWEAVE_SEED_PHRASE) {
    const { ethers } = await import('ethers');
    const wallet = ethers.Wallet.fromPhrase(process.env.ARWEAVE_SEED_PHRASE);
    console.log(`Derived wallet address from seed phrase: ${wallet.address}`);
    return wallet.privateKey;
  }

  // Fall back to legacy PRIVATE_KEY
  if (process.env.PRIVATE_KEY) {
    return process.env.PRIVATE_KEY;
  }

  return null;
}

async function getTurboUploader(isDevnet) {
  // Dynamic import for ESM modules from CommonJS
  const { TurboFactory, EthereumSigner } = await import('@ardrive/turbo-sdk');

  const privateKey = await getPrivateKey();
  if (!privateKey) {
    throw new Error(
      'Wallet credentials required. Set one of:\n' +
        '  ARWEAVE_PRIVATE_KEY  - Ethereum private key (0x...)\n' +
        '  ARWEAVE_SEED_PHRASE  - Seed phrase (12/24 words)\n' +
        '  PRIVATE_KEY          - Legacy: Ethereum private key'
    );
  }

  const signer = new EthereumSigner(privateKey);

  const options = {
    signer,
    token: 'ethereum',
  };

  if (isDevnet) {
    options.paymentServiceConfig = { url: DEV_PAYMENT_SERVICE };
    options.uploadServiceConfig = { url: DEV_UPLOAD_SERVICE };
  }

  return TurboFactory.authenticated(options);
}

async function uploadFile(turbo, filePath, isDryRun) {
  const stats = await fs.stat(filePath);
  const fileName = path.basename(filePath);
  const mimeType = getMimeType(filePath);

  if (isDryRun) {
    const [costInfo] = await turbo.getUploadCosts({ bytes: [stats.size] });
    console.log(`  ${fileName} (${formatBytes(stats.size)}) - estimated cost: ${formatCredits(costInfo.winc)}`);
    return null;
  }

  const tags = [
    { name: 'Content-Type', value: mimeType },
    { name: 'application-id', value: 'blockparty' },
  ];

  const fileData = await fs.readFile(filePath);
  const result = await turbo.uploadFile({
    fileStreamFactory: () => fileData,
    fileSizeFactory: () => fileData.length,
    dataItemOpts: { tags },
  });

  console.log(`  ${fileName} (${formatBytes(stats.size)}) => ar://${result.id}`);
  return `ar://${result.id}`;
}

async function uploadData(turbo, data, contentType, isDryRun) {
  const dataString = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
  const dataBuffer = Buffer.from(dataString, 'utf8');
  const size = dataBuffer.length;

  if (isDryRun) {
    const [costInfo] = await turbo.getUploadCosts({ bytes: [size] });
    console.log(`  metadata.json (${formatBytes(size)}) - estimated cost: ${formatCredits(costInfo.winc)}`);
    return null;
  }

  const tags = [
    { name: 'Content-Type', value: contentType },
    { name: 'application-id', value: 'blockparty' },
  ];

  const result = await turbo.uploadFile({
    fileStreamFactory: () => dataBuffer,
    fileSizeFactory: () => size,
    dataItemOpts: { tags },
  });

  console.log(`  metadata.json (${formatBytes(size)}) => ar://${result.id}`);
  return `ar://${result.id}`;
}

async function processImages(turbo, images, baseDir, isDryRun) {
  const uploadedImages = {};

  for (const [key, filePath] of Object.entries(images)) {
    if (typeof filePath !== 'string') {
      // Already an ar:// URI or complex object, skip
      uploadedImages[key] = filePath;
      continue;
    }

    if (filePath.startsWith('ar://') || filePath.startsWith('https://')) {
      // Already uploaded, skip
      uploadedImages[key] = filePath;
      continue;
    }

    const fullPath = path.resolve(baseDir, filePath);

    try {
      await fs.access(fullPath);
    } catch {
      console.error(`  Warning: File not found: ${filePath}`);
      uploadedImages[key] = filePath;
      continue;
    }

    const arUri = await uploadFile(turbo, fullPath, isDryRun);
    uploadedImages[key] = arUri || filePath;
  }

  return uploadedImages;
}

async function main() {
  const args = process.argv.slice(2);

  // Parse arguments
  const metadataPath = args.find(arg => !arg.startsWith('--'));
  const isDevnet = args.includes('--devnet');
  const isDryRun = args.includes('--dry-run');

  if (!metadataPath) {
    console.error('Usage: node scripts/upload-metadata.js <metadata.json> [--devnet] [--dry-run]');
    console.error('');
    console.error('Options:');
    console.error('  --devnet   Use ArDrive Turbo dev services (for testing)');
    console.error('  --dry-run  Show cost estimate without uploading');
    console.error('');
    console.error('Environment:');
    console.error('  ARWEAVE_PRIVATE_KEY   Ethereum private key for payment (preferred)');
    console.error('  ARWEAVE_SEED_PHRASE   Seed phrase (12/24 words) - alternative to private key');
    console.error('  PRIVATE_KEY           Legacy: Ethereum private key');
    process.exit(1);
  }

  console.log('');
  console.log('BlockParty Metadata Uploader (ArDrive Turbo)');
  console.log('============================================');
  console.log('');

  // Read metadata file
  let metadata;
  try {
    const content = await fs.readFile(metadataPath, 'utf-8');
    metadata = JSON.parse(content);
  } catch (error) {
    console.error(`Error reading metadata file: ${error.message}`);
    process.exit(1);
  }

  const baseDir = path.dirname(path.resolve(metadataPath));

  // Initialize Turbo
  console.log(`Network: ${isDevnet ? 'devnet (ArDrive dev services)' : 'production'}`);
  if (isDryRun) {
    console.log('Mode: DRY RUN (no uploads will be made)');
  }
  console.log('');

  let turbo;
  try {
    turbo = await getTurboUploader(isDevnet);
    const balance = await turbo.getBalance();
    console.log(`Balance: ${formatCredits(balance.winc)}`);
    console.log('');
  } catch (error) {
    console.error(`Error initializing ArDrive Turbo: ${error.message}`);
    process.exit(1);
  }

  // Upload media files
  if (metadata.images && Object.keys(metadata.images).length > 0) {
    console.log('Uploading media files...');
    metadata.images = await processImages(turbo, metadata.images, baseDir, isDryRun);
    console.log('');
  }

  // Upload metadata JSON
  console.log('Uploading metadata...');
  const metadataUri = await uploadData(turbo, metadata, 'application/json', isDryRun);
  console.log('');

  if (isDryRun) {
    console.log('Dry run complete. No files were uploaded.');
    console.log('Run without --dry-run to upload.');
  } else {
    const txId = metadataUri.replace('ar://', '');
    console.log('Upload complete!');
    console.log('');
    console.log(`Metadata URI: ${metadataUri}`);
    console.log(`Gateway URL: https://arweave.net/${txId}`);
    console.log('');
    console.log('Deploy with:');
    console.log(
      `  METADATA_URI=${metadataUri} forge script script/Deploy.s.sol:DeployConference --broadcast ...`
    );
  }
}

main().catch(error => {
  console.error('Error:', error.message);
  process.exit(1);
});
