# ArDrive Turbo Arweave Integration Notes

## Overview

BlockParty uses ArDrive Turbo to upload event metadata and media to Arweave for permanent, decentralized storage.

## Status: COMPLETE

Both CLI upload and UI fetch are fully implemented with ArDrive Turbo SDK.

**Note**: This integration uses ArDrive Turbo SDK for uploading to Arweave.

---

## Architecture

### Contract Layer

- `metadataUri` field added to `Conference.sol` and `ConferenceUpgradeable.sol`
- Stores Arweave URI (e.g., `ar://abc123xyz`)
- Set at deployment time or via `setMetadataUri()` (owner-only, before registration)

### CLI Script (`scripts/upload-metadata.js`)

- Uploads media files (images, etc.) to Arweave via ArDrive Turbo
- Replaces local file paths with `ar://` URIs in metadata
- Uploads final metadata JSON
- Outputs URI for use in contract deployment

### UI Layer

- Reads `metadataUri` from contract
- Fetches metadata from Arweave gateway (`https://arweave.net/{txId}`)
- Transforms Arweave metadata schema to UI-compatible format
- Caches fetched metadata in memory with retry backoff
- `Data.js` is no longer used - fully replaced by Arweave

---

## Usage

### Upload Metadata to Arweave

```bash
# Dry run (show costs without uploading)
ARWEAVE_PRIVATE_KEY=0x... npm run upload:metadata -- ./metadata/example/metadata.json --dry-run

# Upload to devnet (ArDrive dev services - for testing)
ARWEAVE_PRIVATE_KEY=0x... npm run upload:metadata -- ./metadata/example/metadata.json --devnet

# Upload to mainnet (costs real Turbo credits)
ARWEAVE_PRIVATE_KEY=0x... npm run upload:metadata -- ./metadata/example/metadata.json
```

### Environment Variables for CLI

| Variable | Description |
|----------|-------------|
| `ARWEAVE_PRIVATE_KEY` | Ethereum private key for payment (preferred) |
| `ARWEAVE_SEED_PHRASE` | BIP-39 seed phrase (12/24 words) - alternative |
| `PRIVATE_KEY` | Legacy: Ethereum private key |

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
   - `arweaveUriToGatewayUrl()` - Convert `ar://txId` to `https://arweave.net/txId`
   - `fetchArweaveMetadata()` - Fetch and cache JSON from gateway with retry backoff
   - `transformArweaveMetadata()` - Map new schema to UI-compatible format
   - `getArweaveMetadata()` - Combined fetch and transform

### Test Coverage

- Unit tests in `src/__tests__/util/arweaveMetadata.test.js`
- Integration tests in `src/__tests__/integration/arweaveUpload.test.js`
- E2E tests use freshly deployed contracts (no metadata by default)
- Component tests use mock data via `createMockDetail()`

---

## Cost Information

- ArDrive Turbo charges based on data size using "Turbo Credits"
- Credits can be purchased with ETH or credit card
- Typical event metadata (~1KB JSON + 100KB images) costs fractions of a cent
- Use `--dry-run` to check costs before uploading
- Devnet uses ArDrive's dev services (for testing, may have free credits available)

---

## Dependencies

```json
{
  "@ardrive/turbo-sdk": "^1.30.0"
}
```

---

## Webpack Bundling Notes

The ArDrive Turbo web SDK (`@ardrive/turbo-sdk/web`) requires special webpack configuration:

1. **NormalModuleReplacementPlugin**: Handles `node:` protocol imports used by the SDK:

   ```js
   new webpack.NormalModuleReplacementPlugin(/^node:/, resource => {
     resource.request = resource.request.replace(/^node:/, '');
   }),
   ```

2. **Process/browser alias**: Required for axios dependency:

   ```js
   alias: {
     'process/browser': require.resolve('process/browser.js'),
   }
   ```

3. **fullySpecified: false**: Allows imports without full file extensions.

4. **Module concatenation disabled**: Set `optimization.concatenateModules: false` for compatibility.

These settings are in `webpack.config.js` and enable browser-based Arweave uploads via
the UI in addition to the CLI tool.

---

## Network-Aware Upload Behavior

The UI (`src/util/arweaveUpload.js`) automatically selects production vs devnet based on
the connected chain:

| Chain ID | Network          | ArDrive Mode | Service URLs |
|----------|------------------|--------------|--------------|
| 1        | Ethereum Mainnet | Production   | Default ArDrive |
| 11155111 | Sepolia          | Devnet       | payment.ardrive.dev, upload.ardrive.dev |
| 1337     | Local (Anvil)    | Devnet       | payment.ardrive.dev, upload.ardrive.dev |
| 31337    | Hardhat          | Devnet       | payment.ardrive.dev, upload.ardrive.dev |

### Service URLs

- **Production Payment**: https://payment.ardrive.io (default)
- **Production Upload**: https://upload.ardrive.io (default)
- **Dev Payment**: https://payment.ardrive.dev
- **Dev Upload**: https://upload.ardrive.dev

### E2E Test Behavior

Arweave uploads are automatically **disabled** during E2E tests (when `window.__E2E_CONFIG__`
is present). This ensures E2E tests don't require Sepolia ETH or Turbo credits.

---

## ArDrive Turbo SDK Usage

### Browser (with MetaMask/ethers v6 provider)

```javascript
import { TurboFactory } from '@ardrive/turbo-sdk/web';

// Get authenticated uploader
const signer = await provider.getSigner();
const turbo = TurboFactory.authenticated({
  signer,
  token: 'ethereum',
  // For devnet:
  // paymentServiceConfig: { url: 'https://payment.ardrive.dev' },
  // uploadServiceConfig: { url: 'https://upload.ardrive.dev' },
});

// Check balance
const balance = await turbo.getBalance();
console.log(`Balance: ${balance.winc} winc`);

// Get upload cost
const [costInfo] = await turbo.getUploadCosts({ bytes: [fileSize] });
console.log(`Cost: ${costInfo.winc} winc`);

// Upload file
const result = await turbo.uploadFile({
  fileStreamFactory: () => fileData,
  fileSizeFactory: () => fileData.length,
  dataItemOpts: {
    tags: [
      { name: 'Content-Type', value: 'image/png' },
      { name: 'application-id', value: 'blockparty' },
    ],
  },
});
const arweaveUri = `ar://${result.id}`;
```

### Node.js (CLI with private key)

```javascript
const { TurboFactory, EthereumSigner } = require('@ardrive/turbo-sdk');

const signer = new EthereumSigner(privateKey);
const turbo = TurboFactory.authenticated({
  signer,
  token: 'ethereum',
});

// Upload data
const result = await turbo.uploadFile({
  fileStreamFactory: () => Buffer.from(jsonString, 'utf8'),
  fileSizeFactory: () => Buffer.byteLength(jsonString, 'utf8'),
  dataItemOpts: {
    tags: [{ name: 'Content-Type', value: 'application/json' }],
  },
});
```

---

## Gateway Compatibility

The standard Arweave gateway (`arweave.net`) serves all Arweave data, including data
uploaded via any bundler (ArDrive Turbo, etc.). All existing `ar://` URIs continue to work.

---

## Related Files

- `scripts/upload-metadata.js` - CLI upload script
- `metadata/example/` - Example metadata and banner
- `contracts/Conference.sol` - Contract with `metadataUri` field
- `src/util/arweaveUpload.js` - Browser upload utilities (Turbo SDK)
- `src/util/arweaveMetadata.js` - Arweave fetch utilities
- `src/index.js` - UI initialization with Arweave metadata fetch
- `src/__tests__/util/arweaveMetadata.test.js` - Unit tests for fetch utilities
- `src/__tests__/integration/arweaveUpload.test.js` - Integration tests for upload module

---

## Resources

- **ArDrive Turbo SDK**: https://github.com/ardriveapp/turbo-sdk
- **ArDrive Docs**: https://docs.ardrive.io/docs/turbo/turbo-sdk/
- **Arweave Cookbook (Turbo)**: https://cookbook.arweave.net/guides/posting-transactions/turbo.html

