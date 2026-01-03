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
  "@irys/upload-ethereum": "^0.0.16",
  "@irys/web-upload": "^0.0.15",
  "@irys/web-upload-ethereum": "^0.0.16",
  "@irys/web-upload-ethereum-ethers-v6": "^0.0.4"
}
```

---

## Webpack Bundling Notes

The Irys web SDK (`@irys/web-upload` and `@irys/web-upload-ethereum`) has complex ESM/CJS
dependencies that require special webpack configuration:

1. **Module concatenation disabled**: Set `optimization.concatenateModules: false` to avoid
   bundling issues with the `ProvidePlugin` and axios.

2. **Process/browser alias**: The axios dependency in Irys imports `process/browser` without
   the `.js` extension. Added an alias to resolve this ESM strict resolution issue:

   ```js
   alias: {
     'process/browser': require.resolve('process/browser.js'),
   }
   ```

3. **fullySpecified: false**: Allows imports without full file extensions, needed for
   some ESM modules in the dependency tree.

These settings are in `webpack.config.js` and enable browser-based Arweave uploads via
the UI in addition to the CLI tool.

---

## Network-Aware Upload Behavior

The UI (`src/util/arweaveUpload.js`) automatically selects the appropriate Irys network
based on the connected chain:

| Chain ID | Network          | Irys Mode | RPC Used     |
| -------- | ---------------- | --------- | ------------ |
| 1        | Ethereum Mainnet | Mainnet   | Wallet's RPC |
| 11155111 | Sepolia          | Devnet    | Sepolia RPC  |
| 1337     | Local (Anvil)    | Devnet    | Sepolia RPC  |
| 31337    | Hardhat          | Devnet    | Sepolia RPC  |

### Environment Variables

- `SEPOLIA_RPC_URL`: Custom Sepolia RPC URL for devnet mode (default: `https://rpc.sepolia.org`)

### E2E Test Behavior

Arweave uploads are automatically **disabled** during E2E tests (when `window.__E2E_CONFIG__`
is present). This ensures E2E tests don't require Sepolia ETH and complete quickly.

### Ethers v6 Compatibility

The app uses ethers v6 (`BrowserProvider`), but the base Irys SDK expects ethers v5 (`Web3Provider`).
This is handled by using `@irys/web-upload-ethereum-ethers-v6` with `EthersV6Adapter`:

```js
import { EthersV6Adapter } from '@irys/web-upload-ethereum-ethers-v6';

const irysUploader = await WebUploader(WebEthereum)
  .withAdapter(EthersV6Adapter(provider))
  .withRpc(sepoliaRpcUrl) // Required for devnet
  .devnet(); // Use devnet bundler
```

---

## Related Files

- `scripts/upload-metadata.js` - CLI upload script
- `metadata/example/` - Example metadata and banner
- `contracts/Conference.sol` - Contract with `metadataUri` field
- `src/util/arweaveMetadata.js` - Arweave fetch utilities
- `src/index.js` - UI initialization with Arweave metadata fetch
- `src/__tests__/util/arweaveMetadata.test.js` - Unit tests for fetch utilities
