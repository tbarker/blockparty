#!/usr/bin/env node

/**
 * Upload event metadata and media to Arweave via Irys
 *
 * Usage:
 *   node scripts/upload-metadata.js <metadata.json> [options]
 *
 * Options:
 *   --devnet     Use Irys devnet (Sepolia testnet, free but expires after ~60 days)
 *   --dry-run    Show upload cost estimate without uploading
 *
 * Environment:
 *   PRIVATE_KEY  Ethereum private key for payment
 *   RPC_URL      RPC endpoint (required for devnet)
 *
 * Example:
 *   PRIVATE_KEY=0x... node scripts/upload-metadata.js ./metadata/event/metadata.json
 *   PRIVATE_KEY=0x... RPC_URL=https://rpc.sepolia.org node scripts/upload-metadata.js ./metadata/event/metadata.json --devnet
 */

const fs = require('fs').promises;
const path = require('path');

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

async function getIrysUploader(isDevnet) {
  // Dynamic import for ESM modules from CommonJS
  const { Uploader } = await import('@irys/upload');
  const { Ethereum } = await import('@irys/upload-ethereum');

  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    throw new Error('PRIVATE_KEY environment variable is required');
  }

  let uploaderBuilder = Uploader(Ethereum).withWallet(privateKey);

  if (isDevnet) {
    const rpcUrl = process.env.RPC_URL;
    if (!rpcUrl) {
      throw new Error('RPC_URL environment variable is required for devnet');
    }
    uploaderBuilder = uploaderBuilder.withRpc(rpcUrl).devnet();
  }

  return await uploaderBuilder;
}

async function uploadFile(irys, filePath, isDryRun) {
  const stats = await fs.stat(filePath);
  const fileName = path.basename(filePath);
  const mimeType = getMimeType(filePath);

  if (isDryRun) {
    const price = await irys.getPrice(stats.size);
    const priceInEth = irys.utils.fromAtomic(price);
    console.log(`  ${fileName} (${formatBytes(stats.size)}) - estimated cost: ${priceInEth} ETH`);
    return null;
  }

  const tags = [
    { name: 'Content-Type', value: mimeType },
    { name: 'application-id', value: 'blockparty' },
  ];

  const receipt = await irys.uploadFile(filePath, { tags });
  console.log(`  ${fileName} (${formatBytes(stats.size)}) => ar://${receipt.id}`);
  return `ar://${receipt.id}`;
}

async function uploadData(irys, data, contentType, isDryRun) {
  const dataString = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
  const size = Buffer.byteLength(dataString, 'utf8');

  if (isDryRun) {
    const price = await irys.getPrice(size);
    const priceInEth = irys.utils.fromAtomic(price);
    console.log(`  metadata.json (${formatBytes(size)}) - estimated cost: ${priceInEth} ETH`);
    return null;
  }

  const tags = [
    { name: 'Content-Type', value: contentType },
    { name: 'application-id', value: 'blockparty' },
  ];

  const receipt = await irys.upload(dataString, { tags });
  console.log(`  metadata.json (${formatBytes(size)}) => ar://${receipt.id}`);
  return `ar://${receipt.id}`;
}

async function processImages(irys, images, baseDir, isDryRun) {
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

    const arUri = await uploadFile(irys, fullPath, isDryRun);
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
    console.error('  --devnet   Use Irys devnet (Sepolia, free but expires after ~60 days)');
    console.error('  --dry-run  Show cost estimate without uploading');
    console.error('');
    console.error('Environment:');
    console.error('  PRIVATE_KEY  Ethereum private key for payment');
    console.error('  RPC_URL      RPC endpoint (required for devnet)');
    process.exit(1);
  }

  console.log('');
  console.log('BlockParty Metadata Uploader');
  console.log('============================');
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

  // Initialize Irys
  console.log(`Network: ${isDevnet ? 'devnet (Sepolia)' : 'mainnet'}`);
  if (isDryRun) {
    console.log('Mode: DRY RUN (no uploads will be made)');
  }
  console.log('');

  let irys;
  try {
    irys = await getIrysUploader(isDevnet);
    console.log(`Wallet: ${irys.address}`);
    const balance = await irys.getBalance();
    console.log(`Balance: ${irys.utils.fromAtomic(balance)} ETH`);
    console.log('');
  } catch (error) {
    console.error(`Error initializing Irys: ${error.message}`);
    process.exit(1);
  }

  // Upload media files
  if (metadata.images && Object.keys(metadata.images).length > 0) {
    console.log('Uploading media files...');
    metadata.images = await processImages(irys, metadata.images, baseDir, isDryRun);
    console.log('');
  }

  // Upload metadata JSON
  console.log('Uploading metadata...');
  const metadataUri = await uploadData(irys, metadata, 'application/json', isDryRun);
  console.log('');

  if (isDryRun) {
    console.log('Dry run complete. No files were uploaded.');
    console.log('Run without --dry-run to upload.');
  } else {
    const txId = metadataUri.replace('ar://', '');
    console.log('Upload complete!');
    console.log('');
    console.log(`Metadata URI: ${metadataUri}`);
    console.log(`Gateway URL: https://gateway.irys.xyz/${txId}`);
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
