/**
 * Arweave Metadata Fetching Utilities
 *
 * Fetches event metadata from Arweave via the standard Arweave gateway.
 * Handles ar:// URI conversion and caching.
 */

const ARWEAVE_GATEWAY = 'https://arweave.net';

// Simple in-memory cache for metadata
const metadataCache = new Map();

// Track failed fetches to enable retry with backoff
const failedFetches = new Map(); // uri -> { attempts: number, lastAttempt: number }
const MAX_RETRY_ATTEMPTS = 5;
const INITIAL_RETRY_DELAY_MS = 2000; // 2 seconds

/**
 * Convert an ar:// URI to a gateway URL
 * @param {string} arweaveUri - URI in format "ar://transactionId" or just "transactionId"
 * @returns {string} Full gateway URL
 */
export function arweaveUriToGatewayUrl(arweaveUri) {
  if (!arweaveUri) return null;

  // Handle ar:// prefix
  let txId = arweaveUri;
  if (arweaveUri.startsWith('ar://')) {
    txId = arweaveUri.slice(5);
  }

  // Handle full gateway URLs (already converted)
  if (arweaveUri.startsWith('https://')) {
    return arweaveUri;
  }

  return `${ARWEAVE_GATEWAY}/${txId}`;
}

/**
 * Check if we should retry a failed fetch based on backoff timing
 * @param {string} metadataUri - The URI that previously failed
 * @returns {boolean} Whether we should retry now
 */
function shouldRetryFetch(metadataUri) {
  const failedInfo = failedFetches.get(metadataUri);
  if (!failedInfo) return true;

  if (failedInfo.attempts >= MAX_RETRY_ATTEMPTS) {
    return false; // Give up after max attempts
  }

  // Exponential backoff: 2s, 4s, 8s, 16s, 32s
  const backoffMs = INITIAL_RETRY_DELAY_MS * Math.pow(2, failedInfo.attempts - 1);
  const timeSinceLastAttempt = Date.now() - failedInfo.lastAttempt;

  return timeSinceLastAttempt >= backoffMs;
}

/**
 * Record a failed fetch attempt
 * @param {string} metadataUri - The URI that failed
 */
function recordFailedFetch(metadataUri) {
  const existing = failedFetches.get(metadataUri);
  failedFetches.set(metadataUri, {
    attempts: (existing?.attempts || 0) + 1,
    lastAttempt: Date.now(),
  });
}

/**
 * Clear failed fetch tracking for a URI (call after successful fetch)
 * @param {string} metadataUri - The URI to clear
 */
function clearFailedFetch(metadataUri) {
  failedFetches.delete(metadataUri);
}

/**
 * Fetch metadata from Arweave
 * @param {string} metadataUri - The ar:// URI or transaction ID
 * @returns {Promise<Object|null>} The parsed metadata or null on error
 */
export async function fetchArweaveMetadata(metadataUri) {
  if (!metadataUri) return null;

  // Check cache first
  if (metadataCache.has(metadataUri)) {
    return metadataCache.get(metadataUri);
  }

  // Check if we should skip due to recent failures (backoff)
  if (!shouldRetryFetch(metadataUri)) {
    const failedInfo = failedFetches.get(metadataUri);
    console.log(
      `Skipping Arweave fetch for ${metadataUri} (attempt ${failedInfo?.attempts}/${MAX_RETRY_ATTEMPTS}, waiting for backoff)`
    );
    return null;
  }

  const gatewayUrl = arweaveUriToGatewayUrl(metadataUri);
  if (!gatewayUrl) return null;

  try {
    console.log(`Fetching Arweave metadata from: ${gatewayUrl}`);
    const response = await fetch(gatewayUrl);
    if (!response.ok) {
      console.warn(`Failed to fetch metadata from ${gatewayUrl}: ${response.status}`);
      recordFailedFetch(metadataUri);
      return null;
    }

    const metadata = await response.json();

    // Cache the result and clear any failed fetch tracking
    metadataCache.set(metadataUri, metadata);
    clearFailedFetch(metadataUri);
    console.log(`Successfully fetched Arweave metadata for ${metadataUri}`);

    return metadata;
  } catch (error) {
    console.warn(`Error fetching metadata from Arweave:`, error);
    recordFailedFetch(metadataUri);
    return null;
  }
}

/**
 * Transform Arweave metadata to the format expected by the UI
 * Maps from the new Arweave schema to the legacy Data.js format
 *
 * @param {Object} arweaveMetadata - Metadata fetched from Arweave
 * @returns {Object} Metadata in UI-compatible format
 */
export function transformArweaveMetadata(arweaveMetadata) {
  if (!arweaveMetadata) return null;

  return {
    // Map from new schema to legacy format
    date: arweaveMetadata.date || arweaveMetadata.endDate || null,
    map_url: arweaveMetadata.location?.mapUrl || null,
    location_text:
      arweaveMetadata.location?.address ||
      arweaveMetadata.location?.name ||
      arweaveMetadata.location?.text ||
      null,
    description_text: arweaveMetadata.description || null,

    // Keep new fields available too
    images: arweaveMetadata.images
      ? Object.fromEntries(
          Object.entries(arweaveMetadata.images).map(([key, uri]) => [
            key,
            arweaveUriToGatewayUrl(uri),
          ])
        )
      : null,
    links: arweaveMetadata.links || null,
  };
}

/**
 * Fetch and transform metadata from Arweave
 * Returns null if fetch fails or URI is empty
 *
 * @param {string} metadataUri - The ar:// URI from the contract
 * @returns {Promise<Object|null>} Transformed metadata or null
 */
export async function getArweaveMetadata(metadataUri) {
  const rawMetadata = await fetchArweaveMetadata(metadataUri);
  return transformArweaveMetadata(rawMetadata);
}

/**
 * Clear the metadata cache and failed fetch tracking (useful for testing and refresh)
 */
export function clearMetadataCache() {
  metadataCache.clear();
  failedFetches.clear();
}

/**
 * Reset retry state for a specific URI (allows immediate retry)
 * @param {string} metadataUri - The URI to reset
 */
export function resetRetryState(metadataUri) {
  if (metadataUri) {
    failedFetches.delete(metadataUri);
  }
}
