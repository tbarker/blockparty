/**
 * Browser-compatible Arweave upload module via Irys
 *
 * This module provides functionality to upload event metadata and images
 * to Arweave using Irys from a browser environment with MetaMask/wallet connection.
 *
 * Network behavior:
 * - Mainnet (chainId 1): Uses Irys mainnet (costs real ETH)
 * - Sepolia (chainId 11155111): Uses Irys devnet with Sepolia RPC
 * - Local/dev (chainId 1337): Uses Irys devnet with Sepolia RPC (skipped in E2E tests)
 *
 * NOTE: The actual Irys upload functionality requires the @irys/web-upload packages
 * which may have bundling issues with webpack. If uploads fail, users can use the
 * command-line upload script (scripts/upload-metadata.js) as an alternative.
 *
 * Usage:
 *   import { uploadEventMetadata, getUploadCost, isUploadAvailable } from './arweaveUpload';
 *
 *   // Check if upload is available
 *   if (await isUploadAvailable(networkId)) {
 *     const metadataUri = await uploadEventMetadata(provider, networkId, metadata, imageFiles, onProgress);
 *   }
 */

// Irys gateway for viewing uploads
const IRYS_GATEWAY = 'https://gateway.irys.xyz';

// Default Sepolia RPC URL (used for devnet mode)
const DEFAULT_SEPOLIA_RPC = 'https://rpc.sepolia.org';

// Get Sepolia RPC URL from environment or use default
const getSepoliaRpcUrl = () => {
  return process.env.SEPOLIA_RPC_URL || DEFAULT_SEPOLIA_RPC;
};

/**
 * Determine if we should use Irys devnet based on network ID
 * @param {string} networkId - The connected network's chain ID
 * @returns {boolean} Whether to use devnet
 */
const shouldUseDevnet = networkId => {
  // Check localStorage first (explicit user setting takes precedence)
  if (typeof window !== 'undefined' && window.localStorage) {
    const stored = window.localStorage.getItem('irys_devnet');
    if (stored !== null) {
      return stored === 'true';
    }
  }

  // Network-based detection
  switch (networkId) {
    case '1':
      // Ethereum mainnet - use Irys mainnet
      return false;
    case '11155111':
      // Sepolia testnet - use Irys devnet
      return true;
    case '1337':
    case '31337':
      // Local development - use Irys devnet
      return true;
    default:
      // Unknown network - check if localhost
      if (typeof window !== 'undefined') {
        const hostname = window.location.hostname;
        const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';
        if (isLocalhost) {
          return true;
        }
      }
      return false;
  }
};

/**
 * Check if we're in E2E test mode
 * @returns {boolean}
 */
const isE2ETest = () => {
  return typeof window !== 'undefined' && window.__E2E_CONFIG__ !== undefined;
};

/**
 * Check if Irys upload functionality is available
 * @param {string} networkId - The connected network's chain ID (optional)
 * @returns {Promise<boolean>}
 */
export async function isUploadAvailable(networkId) {
  // Skip uploads during E2E tests
  if (isE2ETest()) {
    return false;
  }

  try {
    // Try to load the SDK
    await import('@irys/web-upload');
    await import('@irys/web-upload-ethereum');
    await import('@irys/web-upload-ethereum-ethers-v6');
    return true;
  } catch {
    return false;
  }
}

/**
 * Dynamically import Irys SDK
 * @returns {Promise<{WebUploader: Function, WebEthereum: Object, EthersV6Adapter: Function}>}
 * @throws {Error} If SDK cannot be loaded
 */
async function loadIrysSDK() {
  try {
    const [webUploadModule, webEthereumModule, ethersV6Module] = await Promise.all([
      import('@irys/web-upload'),
      import('@irys/web-upload-ethereum'),
      import('@irys/web-upload-ethereum-ethers-v6'),
    ]);

    return {
      WebUploader: webUploadModule.WebUploader,
      WebEthereum: webEthereumModule.WebEthereum,
      EthersV6Adapter: ethersV6Module.EthersV6Adapter,
    };
  } catch (error) {
    console.error('Failed to load Irys SDK:', error);
    throw new Error(
      'Arweave upload is not available in this browser session. ' +
        'Please use the command-line tool: npm run upload:metadata'
    );
  }
}

/**
 * Initialize Irys uploader with browser wallet (MetaMask/ethers provider)
 * @param {Object} provider - ethers.js v6 BrowserProvider
 * @param {string} networkId - The connected network's chain ID
 * @returns {Object} Irys uploader instance
 */
export async function getIrysUploader(provider, networkId) {
  // Skip uploads during E2E tests
  if (isE2ETest()) {
    throw new Error('Arweave uploads are disabled during E2E tests');
  }

  const { WebUploader, WebEthereum, EthersV6Adapter } = await loadIrysSDK();

  // Use EthersV6Adapter for ethers v6 compatibility
  let builder = WebUploader(WebEthereum).withAdapter(EthersV6Adapter(provider));

  // Configure devnet mode based on network
  if (shouldUseDevnet(networkId)) {
    const sepoliaRpc = getSepoliaRpcUrl();
    console.log(`Using Irys devnet with Sepolia RPC: ${sepoliaRpc}`);
    builder = builder.withRpc(sepoliaRpc).devnet();
  }

  const irys = await builder;
  return irys;
}

/**
 * Get the estimated cost for uploading data
 * @param {Object} irys - Irys uploader instance
 * @param {number} bytes - Size of data in bytes
 * @returns {Object} Cost in atomic units and formatted ETH string
 */
export async function getPrice(irys, bytes) {
  const price = await irys.getPrice(bytes);
  const priceInEth = irys.utils.fromAtomic(price);
  return {
    atomic: price,
    eth: priceInEth,
    formatted: `${parseFloat(priceInEth).toFixed(6)} ETH`,
  };
}

/**
 * Check if the wallet has sufficient balance for upload
 * @param {Object} irys - Irys uploader instance
 * @param {number} requiredBytes - Size of data to upload
 * @returns {Object} Balance info and whether it's sufficient
 */
export async function checkBalance(irys, requiredBytes) {
  const balance = await irys.getBalance();
  const price = await irys.getPrice(requiredBytes);
  const balanceInEth = irys.utils.fromAtomic(balance);
  const priceInEth = irys.utils.fromAtomic(price);

  return {
    balance: balance,
    balanceEth: balanceInEth,
    required: price,
    requiredEth: priceInEth,
    sufficient: balance >= price,
    shortfall: balance < price ? price - balance : 0n,
  };
}

/**
 * Fund the Irys node with ETH
 * @param {Object} irys - Irys uploader instance
 * @param {BigInt|string} amount - Amount in atomic units or ETH string
 * @returns {Object} Funding transaction receipt
 */
export async function fundNode(irys, amount) {
  const receipt = await irys.fund(amount);
  return receipt;
}

/**
 * Upload a file (image) to Arweave via Irys
 * @param {Object} irys - Irys uploader instance
 * @param {File} file - File object to upload
 * @param {Function} onProgress - Optional progress callback
 * @returns {string} Arweave URI (ar://txId)
 */
export async function uploadFile(irys, file, onProgress) {
  const tags = [
    { name: 'Content-Type', value: file.type || 'application/octet-stream' },
    { name: 'application-id', value: 'blockparty' },
    { name: 'filename', value: file.name },
  ];

  // Read file as ArrayBuffer
  const buffer = await file.arrayBuffer();
  const data = new Uint8Array(buffer);

  // Upload with progress if available
  const receipt = await irys.upload(data, { tags });

  if (onProgress) {
    onProgress({ type: 'file', name: file.name, uri: `ar://${receipt.id}` });
  }

  return `ar://${receipt.id}`;
}

/**
 * Upload JSON metadata to Arweave via Irys
 * @param {Object} irys - Irys uploader instance
 * @param {Object} metadata - Metadata object to upload
 * @param {Function} onProgress - Optional progress callback
 * @returns {string} Arweave URI (ar://txId)
 */
export async function uploadMetadataJson(irys, metadata, onProgress) {
  const tags = [
    { name: 'Content-Type', value: 'application/json' },
    { name: 'application-id', value: 'blockparty' },
  ];

  const data = JSON.stringify(metadata, null, 2);

  const receipt = await irys.upload(data, { tags });

  if (onProgress) {
    onProgress({ type: 'metadata', uri: `ar://${receipt.id}` });
  }

  return `ar://${receipt.id}`;
}

/**
 * Calculate total upload size for metadata and images
 * @param {Object} metadata - Metadata object
 * @param {Object} imageFiles - Map of image key to File objects
 * @returns {number} Total size in bytes
 */
export function calculateTotalSize(metadata, imageFiles = {}) {
  let totalSize = 0;

  // Metadata JSON size
  const metadataString = JSON.stringify(metadata, null, 2);
  totalSize += new TextEncoder().encode(metadataString).length;

  // Image files size
  for (const file of Object.values(imageFiles)) {
    if (file instanceof File) {
      totalSize += file.size;
    }
  }

  return totalSize;
}

/**
 * Get estimated upload cost for metadata and images
 * @param {Object} provider - ethers.js provider
 * @param {string} networkId - The connected network's chain ID
 * @param {Object} metadata - Metadata object
 * @param {Object} imageFiles - Map of image key to File objects
 * @returns {Object} Cost estimation
 */
export async function getUploadCost(provider, networkId, metadata, imageFiles = {}) {
  const irys = await getIrysUploader(provider, networkId);
  const totalSize = calculateTotalSize(metadata, imageFiles);
  const price = await getPrice(irys, totalSize);

  return {
    size: totalSize,
    sizeFormatted: formatBytes(totalSize),
    ...price,
  };
}

/**
 * Full upload flow: upload images first, then metadata with ar:// URIs
 * @param {Object} provider - ethers.js provider
 * @param {string} networkId - The connected network's chain ID
 * @param {Object} metadata - Metadata object (will be cloned, not mutated)
 * @param {Object} imageFiles - Map of image key to File objects (e.g., { banner: File })
 * @param {Function} onProgress - Progress callback ({ step, total, message })
 * @returns {string} Arweave URI for the metadata (ar://txId)
 */
export async function uploadEventMetadata(
  provider,
  networkId,
  metadata,
  imageFiles = {},
  onProgress
) {
  const irys = await getIrysUploader(provider, networkId);

  // Clone metadata to avoid mutating the original
  const updatedMetadata = JSON.parse(JSON.stringify(metadata));

  // Ensure images object exists
  if (!updatedMetadata.images) {
    updatedMetadata.images = {};
  }

  // Count total steps for progress
  const imageCount = Object.keys(imageFiles).filter(k => imageFiles[k] instanceof File).length;
  const totalSteps = imageCount + 1; // images + metadata
  let currentStep = 0;

  // Upload each image file
  for (const [key, file] of Object.entries(imageFiles)) {
    if (file instanceof File) {
      currentStep++;
      if (onProgress) {
        onProgress({
          step: currentStep,
          total: totalSteps,
          message: `Uploading ${file.name}...`,
        });
      }

      const uri = await uploadFile(irys, file);
      updatedMetadata.images[key] = uri;
    }
  }

  // Upload metadata JSON
  currentStep++;
  if (onProgress) {
    onProgress({
      step: currentStep,
      total: totalSteps,
      message: 'Uploading metadata...',
    });
  }

  const metadataUri = await uploadMetadataJson(irys, updatedMetadata);

  if (onProgress) {
    onProgress({
      step: totalSteps,
      total: totalSteps,
      message: 'Upload complete!',
      uri: metadataUri,
    });
  }

  return metadataUri;
}

/**
 * Convert ar:// URI to gateway URL
 * @param {string} arweaveUri - Arweave URI (ar://txId or just txId)
 * @returns {string} Gateway URL
 */
export function arweaveUriToGatewayUrl(arweaveUri) {
  if (!arweaveUri) return null;

  if (arweaveUri.startsWith('https://')) {
    return arweaveUri;
  }

  const txId = arweaveUri.replace('ar://', '');
  return `${IRYS_GATEWAY}/${txId}`;
}

/**
 * Format bytes to human-readable string
 * @param {number} bytes - Size in bytes
 * @returns {string} Formatted size string
 */
function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Enable or disable devnet mode
 * @param {boolean} enabled - Whether to use devnet
 */
export function setDevnetMode(enabled) {
  if (typeof window !== 'undefined' && window.localStorage) {
    if (enabled) {
      window.localStorage.setItem('irys_devnet', 'true');
    } else {
      window.localStorage.removeItem('irys_devnet');
    }
  }
}

export default {
  isUploadAvailable,
  getIrysUploader,
  getPrice,
  checkBalance,
  fundNode,
  uploadFile,
  uploadMetadataJson,
  calculateTotalSize,
  getUploadCost,
  uploadEventMetadata,
  arweaveUriToGatewayUrl,
  setDevnetMode,
  shouldUseDevnet,
};
