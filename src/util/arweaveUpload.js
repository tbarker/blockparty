/**
 * Browser-compatible Arweave upload module via ArDrive Turbo
 *
 * This module provides functionality to upload event metadata and images
 * to Arweave using ArDrive Turbo from a browser environment with MetaMask/wallet connection.
 *
 * Network behavior:
 * - Mainnet (chainId 1): Uses ArDrive Turbo production services (costs real credits)
 * - Sepolia (chainId 11155111): Uses ArDrive Turbo dev services
 * - Local/dev (chainId 1337): Uses ArDrive Turbo dev services
 *
 * NOTE: The actual Turbo upload functionality requires the @ardrive/turbo-sdk package
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

// Standard Arweave gateway for viewing uploads
const ARWEAVE_GATEWAY = 'https://arweave.net';

// ArDrive Turbo development service URLs (for devnet mode)
const DEV_PAYMENT_SERVICE = 'https://payment.ardrive.dev';
const DEV_UPLOAD_SERVICE = 'https://upload.ardrive.dev';

/**
 * Determine if we should use devnet based on network ID
 * @param {string} networkId - The connected network's chain ID
 * @returns {boolean} Whether to use devnet
 */
const shouldUseDevnet = networkId => {
  // Check localStorage first (explicit user setting takes precedence)
  if (typeof window !== 'undefined' && window.localStorage) {
    const stored = window.localStorage.getItem('turbo_devnet');
    // Check for actual string value (not null/undefined)
    if (stored === 'true') {
      return true;
    }
    if (stored === 'false') {
      return false;
    }
    // If stored is null/undefined, continue to network detection
  }

  // Ensure networkId is a string for comparison
  const netIdStr = String(networkId);

  // Network-based detection
  switch (netIdStr) {
    case '1':
      // Ethereum mainnet - use production
      return false;
    case '11155111':
      // Sepolia testnet - use devnet
      return true;
    case '1337':
    case '31337':
      // Local development - use devnet
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
 * Check if Turbo upload functionality is available
 * @param {string} _networkId - The connected network's chain ID (optional, reserved for future use)
 * @returns {Promise<boolean>}
 */
export async function isUploadAvailable(_networkId) {
  try {
    // Try to load the SDK
    await import('@ardrive/turbo-sdk/web');
    return true;
  } catch {
    return false;
  }
}

/**
 * Dynamically import ArDrive Turbo SDK and arbundles
 * @returns {Promise<{TurboFactory: Object, InjectedEthereumSigner: Object}>}
 * @throws {Error} If SDK cannot be loaded
 */
async function loadTurboSDK() {
  try {
    const [turboModule, arbundlesModule] = await Promise.all([
      import('@ardrive/turbo-sdk/web'),
      import('@dha-team/arbundles'),
    ]);

    return {
      TurboFactory: turboModule.TurboFactory,
      InjectedEthereumSigner: arbundlesModule.InjectedEthereumSigner,
    };
  } catch (error) {
    console.error('Failed to load ArDrive Turbo SDK:', error);
    throw new Error(
      'Arweave upload is not available in this browser session. ' +
        'Please use the command-line tool: npm run upload:metadata'
    );
  }
}

/**
 * Create a provider wrapper compatible with InjectedEthereumSigner
 * Handles ethers v6 signer to work with arbundles which expects v5 patterns
 * @param {Object} ethersSigner - ethers v6 signer from provider.getSigner()
 * @param {string} address - wallet address
 * @returns {Object} Provider wrapper for InjectedEthereumSigner
 */
function createProviderWrapper(ethersSigner, address) {
  return {
    getSigner: () => ({
      signMessage: async message => {
        console.log('[Arweave] signMessage called, message type:', typeof message);

        // Convert Uint8Array to hex string for personal_sign
        // InjectedEthereumSigner may pass string or Uint8Array
        let messageToSign;
        if (typeof message === 'string') {
          messageToSign = message;
        } else {
          // Convert Uint8Array to hex string prefixed with 0x
          messageToSign =
            '0x' +
            Array.from(message)
              .map(b => b.toString(16).padStart(2, '0'))
              .join('');
        }

        console.log('[Arweave] Requesting signature via personal_sign...');

        // Use direct ethereum RPC for compatibility
        const signature = await window.ethereum.request({
          method: 'personal_sign',
          params: [messageToSign, address],
        });

        console.log('[Arweave] Signature received');
        return signature;
      },
    }),
  };
}

/**
 * Initialize Turbo uploader with browser wallet (MetaMask/ethers provider)
 * @param {Object} provider - ethers.js v6 BrowserProvider
 * @param {string} networkId - The connected network's chain ID
 * @returns {Object} Turbo uploader instance
 */
export async function getTurboUploader(provider, networkId) {
  console.log('[Arweave] Loading SDK...');
  const { TurboFactory, InjectedEthereumSigner } = await loadTurboSDK();
  console.log('[Arweave] SDK loaded successfully');

  console.log('[Arweave] Initializing Turbo uploader...');

  // Get wallet address from ethers provider
  const ethersSigner = await provider.getSigner();
  const address = await ethersSigner.getAddress();
  console.log(`[Arweave] Using wallet address: ${address}`);

  // Create provider wrapper that works with InjectedEthereumSigner
  console.log('[Arweave] Creating provider wrapper...');
  const providerWrapper = createProviderWrapper(ethersSigner, address);
  console.log('[Arweave] Provider wrapper created');

  // Create signer using the documented pattern from ArDrive docs
  console.log('[Arweave] Creating InjectedEthereumSigner...');
  let signer;
  try {
    signer = new InjectedEthereumSigner(providerWrapper);
    console.log('[Arweave] InjectedEthereumSigner created');
  } catch (signerError) {
    console.error('[Arweave] Failed to create InjectedEthereumSigner:', signerError);
    throw signerError;
  }

  // Configure devnet/mainnet mode based on network
  const useDevnet = shouldUseDevnet(networkId);

  const options = {
    signer,
    token: 'ethereum',
  };

  if (useDevnet) {
    options.paymentServiceConfig = { url: DEV_PAYMENT_SERVICE };
    options.uploadServiceConfig = { url: DEV_UPLOAD_SERVICE };
    console.log(
      `[Arweave] Using ArDrive Turbo devnet (payment: ${DEV_PAYMENT_SERVICE}, upload: ${DEV_UPLOAD_SERVICE})`
    );
  } else {
    console.log('[Arweave] Using ArDrive Turbo production');
  }

  console.log('[Arweave] Creating authenticated Turbo client...');
  let turbo;
  try {
    turbo = TurboFactory.authenticated(options);
    console.log('[Arweave] Turbo client created successfully');
  } catch (turboError) {
    console.error('[Arweave] Failed to create Turbo client:', turboError);
    throw turboError;
  }

  return turbo;
}


/**
 * Get the estimated cost for uploading data
 * @param {Object} turbo - Turbo uploader instance
 * @param {number} bytes - Size of data in bytes
 * @returns {Object} Cost in credits
 */
export async function getPrice(turbo, bytes) {
  const [costInfo] = await turbo.getUploadCosts({ bytes: [bytes] });
  const { winc } = costInfo;

  // winc = winston credits (smallest Turbo credit unit)
  // 1 credit = 1,000,000,000,000 winc (10^12)
  const credits = Number(winc) / 1e12;

  return {
    atomic: BigInt(winc),
    winc: winc,
    credits: credits,
    formatted: credits < 0.001 ? `${winc} winc` : `${credits.toFixed(6)} credits`,
  };
}

/**
 * Upload a file (image) to Arweave via ArDrive Turbo
 * @param {Object} turbo - Turbo uploader instance
 * @param {File} file - File object to upload
 * @param {Function} onProgress - Optional progress callback
 * @returns {string} Arweave URI (ar://txId)
 */
export async function uploadFile(turbo, file, onProgress) {
  const tags = [
    { name: 'Content-Type', value: file.type || 'application/octet-stream' },
    { name: 'application-id', value: 'blockparty' },
    { name: 'filename', value: file.name },
  ];

  console.log(`[Arweave Upload] Starting file upload: ${file.name} (${file.size} bytes, type: ${file.type})`);

  try {
    // Use file's native stream for better browser compatibility
    const result = await turbo.uploadFile({
      fileStreamFactory: () => file.stream(),
      fileSizeFactory: () => file.size,
      dataItemOpts: { tags },
    });

    const uri = `ar://${result.id}`;
    console.log(`[Arweave Upload] File upload successful: ${uri}`);

    if (onProgress) {
      onProgress({ type: 'file', name: file.name, uri });
    }

    return uri;
  } catch (error) {
    console.error(`[Arweave Upload] File upload failed for ${file.name}:`, error);
    console.error('[Arweave Upload] Error details:', {
      name: error.name,
      message: error.message,
      response: error.response,
      status: error.status,
    });
    throw error;
  }
}

/**
 * Upload JSON metadata to Arweave via ArDrive Turbo
 * @param {Object} turbo - Turbo uploader instance
 * @param {Object} metadata - Metadata object to upload
 * @param {Function} onProgress - Optional progress callback
 * @returns {string} Arweave URI (ar://txId)
 */
export async function uploadMetadataJson(turbo, metadata, onProgress) {
  const tags = [
    { name: 'Content-Type', value: 'application/json' },
    { name: 'application-id', value: 'blockparty' },
  ];

  const dataString = JSON.stringify(metadata, null, 2);
  const dataBuffer = new TextEncoder().encode(dataString);

  console.log(`[Arweave Upload] Starting metadata upload, size: ${dataBuffer.length} bytes`);

  try {
    // Use uploadFile with stream factory (same pattern as CLI script)
    const result = await turbo.uploadFile({
      fileStreamFactory: () =>
        new ReadableStream({
          start(controller) {
            controller.enqueue(dataBuffer);
            controller.close();
          },
        }),
      fileSizeFactory: () => dataBuffer.length,
      dataItemOpts: { tags },
    });

    const uri = `ar://${result.id}`;
    console.log(`[Arweave Upload] Metadata upload successful: ${uri}`);

    if (onProgress) {
      onProgress({ type: 'metadata', uri });
    }

    return uri;
  } catch (error) {
    console.error('[Arweave Upload] Metadata upload failed:', error);
    console.error('[Arweave Upload] Error details:', {
      name: error.name,
      message: error.message,
      response: error.response,
      status: error.status,
    });
    throw error;
  }
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
  const turbo = await getTurboUploader(provider, networkId);
  const totalSize = calculateTotalSize(metadata, imageFiles);
  const price = await getPrice(turbo, totalSize);

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
  console.log('[Arweave] uploadEventMetadata called with', Object.keys(imageFiles).length, 'image files');

  const turbo = await getTurboUploader(provider, networkId);
  console.log('[Arweave] Got Turbo uploader, starting uploads...');

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
  console.log(`[Arweave] Total upload steps: ${totalSteps} (${imageCount} images + 1 metadata)`);

  // Upload each image file
  for (const [key, file] of Object.entries(imageFiles)) {
    if (file instanceof File) {
      currentStep++;
      console.log(`[Arweave] Step ${currentStep}/${totalSteps}: Uploading image "${key}" (${file.name}, ${file.size} bytes)`);
      if (onProgress) {
        onProgress({
          step: currentStep,
          total: totalSteps,
          message: `Uploading ${file.name}...`,
        });
      }

      try {
        const uri = await uploadFile(turbo, file);
        console.log(`[Arweave] Image upload success: ${uri}`);
        updatedMetadata.images[key] = uri;
      } catch (uploadError) {
        console.error(`[Arweave] Image upload failed:`, uploadError);
        throw uploadError;
      }
    }
  }

  // Upload metadata JSON
  currentStep++;
  console.log(`[Arweave] Step ${currentStep}/${totalSteps}: Uploading metadata JSON`);
  if (onProgress) {
    onProgress({
      step: currentStep,
      total: totalSteps,
      message: 'Uploading metadata...',
    });
  }

  try {
    const metadataUri = await uploadMetadataJson(turbo, updatedMetadata);
    console.log(`[Arweave] Metadata upload success: ${metadataUri}`);

    if (onProgress) {
      onProgress({
        step: totalSteps,
        total: totalSteps,
        message: 'Upload complete!',
        uri: metadataUri,
      });
    }

    return metadataUri;
  } catch (metadataError) {
    console.error(`[Arweave] Metadata upload failed:`, metadataError);
    throw metadataError;
  }
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
  return `${ARWEAVE_GATEWAY}/${txId}`;
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
      window.localStorage.setItem('turbo_devnet', 'true');
    } else {
      window.localStorage.removeItem('turbo_devnet');
    }
  }
}

/**
 * Wait for Arweave data to be available on gateway
 * @param {string} metadataUri - The ar:// URI to check
 * @param {Object} options - Options object
 * @param {number} options.maxAttempts - Maximum number of attempts (default: 30)
 * @param {number} options.intervalMs - Interval between attempts in ms (default: 2000)
 * @param {Function} options.onProgress - Progress callback
 * @param {string} options.networkId - Network ID to determine if devnet (optional)
 * @returns {Promise<boolean>} True if data is available, false if timed out
 */
export async function waitForArweaveConfirmation(metadataUri, options = {}) {
  const { maxAttempts = 30, intervalMs = 2000, onProgress, networkId } = options;

  if (!metadataUri) return true;

  // In devnet mode, skip gateway confirmation since devnet uploads
  // won't appear on the public arweave.net gateway
  if (networkId && shouldUseDevnet(networkId)) {
    console.log('[Arweave] Skipping gateway confirmation (devnet mode)');
    return true;
  }

  const gatewayUrl = arweaveUriToGatewayUrl(metadataUri);

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await fetch(gatewayUrl, { method: 'HEAD' });
      if (response.ok) {
        return true;
      }
    } catch {
      // Network error, continue trying
    }

    if (onProgress) {
      onProgress({ attempt, maxAttempts, uri: metadataUri });
    }

    if (attempt < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, intervalMs));
    }
  }

  return false;
}

export default {
  isUploadAvailable,
  getTurboUploader,
  getPrice,
  uploadFile,
  uploadMetadataJson,
  calculateTotalSize,
  getUploadCost,
  uploadEventMetadata,
  arweaveUriToGatewayUrl,
  setDevnetMode,
  shouldUseDevnet,
  waitForArweaveConfirmation,
};
