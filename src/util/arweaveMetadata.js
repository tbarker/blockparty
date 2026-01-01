/**
 * Arweave Metadata Fetching Utilities
 *
 * Fetches event metadata from Arweave via Irys gateway.
 * Handles ar:// URI conversion and caching.
 */

const IRYS_GATEWAY = 'https://gateway.irys.xyz';

// Simple in-memory cache for metadata
const metadataCache = new Map();

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

  return `${IRYS_GATEWAY}/${txId}`;
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

  const gatewayUrl = arweaveUriToGatewayUrl(metadataUri);
  if (!gatewayUrl) return null;

  try {
    const response = await fetch(gatewayUrl);
    if (!response.ok) {
      console.warn(`Failed to fetch metadata from ${gatewayUrl}: ${response.status}`);
      return null;
    }

    const metadata = await response.json();

    // Cache the result
    metadataCache.set(metadataUri, metadata);

    return metadata;
  } catch (error) {
    console.warn(`Error fetching metadata from Arweave:`, error);
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
 * Clear the metadata cache (useful for testing)
 */
export function clearMetadataCache() {
  metadataCache.clear();
}
