# Irys Arweave Integration Notes

## Overview

BlockParty uses Irys to upload event metadata and media to Arweave for permanent, decentralized storage.

## Status: COMPLETE

Both CLI upload and UI fetch are implemented.

---

## Architecture

### Contract Layer

- `metadataUri` field added to `Conference.sol` and `ConferenceUpgradeable.sol`
- Stores Arweave URI (e.g., `ar://abc123xyz`)
- Set at deployment time or via `setMetadataUri()` (owner-only, before registration)

### CLI Script (`scripts/upload-metadata.js`)

- Uploads media files (images, etc.) to Arweave
- Replaces local file paths with `ar://` URIs in metadata
- Uploads final metadata JSON
- Outputs URI for use in contract deployment

### UI Layer (COMPLETE)

- Reads `metadataUri` from contract
- Fetches metadata from Arweave gateway (`https://gateway.irys.xyz/{txId}`)
- Transforms Arweave metadata schema to UI-compatible format
- Caches fetched metadata in memory
- `Data.js` is no longer used - fully replaced by Arweave

---

## Usage

### Upload Metadata to Arweave

```bash
# Dry run (show costs without uploading)
PRIVATE_KEY=0x... npm run upload:metadata:dry-run -- ./metadata/example/metadata.json

# Upload to devnet (Sepolia testnet - free, expires after ~60 days)
PRIVATE_KEY=0x... RPC_URL=https://rpc.sepolia.org npm run upload:metadata:devnet -- ./metadata/example/metadata.json

# Upload to mainnet (costs real ETH)
PRIVATE_KEY=0x... npm run upload:metadata -- ./metadata/example/metadata.json
```

### Deploy Contract with Metadata

```bash
METADATA_URI=ar://abc123xyz forge script script/Deploy.s.sol:DeployConference --broadcast ...
```

---

## Metadata Schema

```json
{
  "name": "Event Name",
  "date": "2026-03-15T18:30:00Z",
  "endDate": "2026-03-15T21:00:00Z",
  "location": {
    "name": "Venue Name",
    "address": "123 Main St",
    "mapUrl": "https://maps.google.com/..."
  },
  "description": "Event description...",
  "images": {
    "banner": "ar://abc123...",
    "venue": "ar://def456..."
  },
  "links": {
    "website": "https://...",
    "twitter": "https://..."
  }
}
```

---

## UI Implementation Details

The UI fetches metadata from Arweave:

1. `src/index.js` reads `metadataUri` from contract: `contract.metadataUri()`
2. `src/util/arweaveMetadata.js` handles fetching and transformation:
   - `arweaveUriToGatewayUrl()` - Convert `ar://txId` to `https://gateway.irys.xyz/txId`
   - `fetchArweaveMetadata()` - Fetch and cache JSON from gateway
   - `transformArweaveMetadata()` - Map new schema to UI-compatible format
   - `getArweaveMetadata()` - Combined fetch and transform

### Test Coverage

- Unit tests in `src/__tests__/util/arweaveMetadata.test.js`
- E2E tests use freshly deployed contracts (no metadata by default)
- Component tests use mock data via `createMockDetail()`

---

## Cost Information

- Irys charges based on data size
- Typical event metadata (~1KB JSON + 100KB images) costs fractions of a cent
- Use `--dry-run` to check costs before uploading
- Devnet is free (uses Sepolia testnet tokens, data expires after ~60 days)

---

## Dependencies

```json
{
  "@irys/upload": "^0.0.15",
  "@irys/upload-ethereum": "^0.0.16"
}
```

---

## Related Files

- `scripts/upload-metadata.js` - CLI upload script
- `metadata/example/` - Example metadata and banner
- `contracts/Conference.sol` - Contract with `metadataUri` field
- `src/util/arweaveMetadata.js` - Arweave fetch utilities
- `src/index.js` - UI initialization with Arweave metadata fetch
- `src/__tests__/util/arweaveMetadata.test.js` - Unit tests for fetch utilities
