# Feature Plan: Admin Metadata Update via UX

## Overview

Enable group admins (not just the owner) to update event metadata through the UI by uploading new metadata to Arweave. This requires changes to the smart contract, the frontend UI, and new testing infrastructure.

## Current State Analysis

### Contract Layer

**Current `setMetadataUri` function:**

```solidity
function setMetadataUri(string calldata _metadataUri) external onlyOwner noOneRegistered {
    metadataUri = _metadataUri;
    emit MetadataUpdated(_metadataUri);
}
```

**Restrictions:**

1. `onlyOwner` - Only contract owner can call (admins cannot)
2. `noOneRegistered` - Cannot update after anyone registers

**Files:**

- `contracts/Conference.sol` (lines 222-227)
- `contracts/upgradeable/ConferenceUpgradeable.sol` (lines 355-362)

### Permission System

The `GroupAdmin` contract provides a two-tier system:

- **Owner**: Full control (payback, cancel, clear, grant/revoke admins, change settings)
- **Admins**: Can only mark attendance (`attend()`)

The `isAdmin()` function returns true for both owner AND explicitly granted admins.

### Arweave/Irys Integration

**Upload mechanism (`scripts/upload-metadata.js`):**

- Uses `@irys/upload` and `@irys/upload-ethereum` packages
- Requires private key for signing uploads
- Supports mainnet (permanent, costs ETH) and devnet (free, expires ~60 days)
- Uploads images first, replaces local paths with `ar://` URIs in metadata JSON

**Fetching (`src/util/arweaveMetadata.js`):**

- Converts `ar://txId` to gateway URL
- Fetches and caches metadata
- Transforms Arweave schema to UI format

### UI Components

**Admin detection (`src/components/FormInput.js`):**

```javascript
isAdmin() {
    return (
        (this.state.detail.admins && this.state.detail.admins.includes(this.state.address)) ||
        this.state.detail.owner == this.state.address
    );
}
```

**Current admin actions in UI:**

- Batch attend (admins)
- Grant admin, Payback, Cancel, Clear (owner only)

---

## Proposed Changes

### Phase 1: Smart Contract Changes

#### 1.1 Modify Access Control for `setMetadataUri`

**Change from `onlyOwner` to `onlyAdmin`:**

```solidity
// BEFORE
function setMetadataUri(string calldata _metadataUri) external onlyOwner noOneRegistered {

// AFTER
function setMetadataUri(string calldata _metadataUri) external onlyAdmin {
    metadataUri = _metadataUri;
    emit MetadataUpdated(_metadataUri);
}
```

**Rationale:**

- Remove `noOneRegistered` restriction - metadata updates should be allowed at any time (event details, venue changes, etc.)
- Change to `onlyAdmin` - trusted admins should be able to update metadata
- Keep the event emission for tracking changes

**Files to modify:**

- `contracts/Conference.sol`
- `contracts/upgradeable/ConferenceUpgradeable.sol`

#### 1.2 Add Metadata History (Optional Enhancement)

Consider adding a history of metadata URIs for auditability:

```solidity
string[] public metadataHistory;

function setMetadataUri(string calldata _metadataUri) external onlyAdmin {
    if (bytes(metadataUri).length > 0) {
        metadataHistory.push(metadataUri);
    }
    metadataUri = _metadataUri;
    emit MetadataUpdated(_metadataUri);
}

function getMetadataHistoryLength() external view returns (uint256) {
    return metadataHistory.length;
}
```

**Trade-off:** Increases gas costs but provides auditability. Consider if this is needed.

#### 1.3 Update Contract Tests

**File:** `test/Conference.t.sol`

Add tests for:

- Admin (non-owner) can call `setMetadataUri`
- Non-admin cannot call `setMetadataUri`
- `setMetadataUri` works after participants register
- `MetadataUpdated` event is emitted with correct URI
- Multiple metadata updates work correctly

```solidity
function test_AdminCanSetMetadataUri() public {
    address admin = makeAddr("admin");
    address[] memory admins = new address[](1);
    admins[0] = admin;
    conference.grant(admins);

    vm.prank(admin);
    conference.setMetadataUri("ar://newTxId");

    assertEq(conference.metadataUri(), "ar://newTxId");
}

function test_SetMetadataUriAfterRegistration() public {
    // Register a participant
    vm.deal(user1, 1 ether);
    vm.prank(user1);
    conference.register{value: 0.02 ether}("@user1");

    // Owner can still update metadata
    conference.setMetadataUri("ar://updatedTxId");
    assertEq(conference.metadataUri(), "ar://updatedTxId");
}

function test_NonAdminCannotSetMetadataUri() public {
    vm.prank(user1);
    vm.expectRevert();
    conference.setMetadataUri("ar://hackerTxId");
}
```

---

### Phase 2: Arweave Upload Integration in Browser

#### 2.1 Create Browser-Compatible Upload Module

**New file:** `src/util/arweaveUpload.js`

The current upload script runs in Node.js. We need a browser-compatible version.

```javascript
import { WebUploader } from '@irys/web-upload';
import { WebEthereum } from '@irys/web-upload-ethereum';

const IRYS_NETWORK = 'mainnet'; // or 'devnet' for testing

/**
 * Initialize Irys uploader with browser wallet (MetaMask)
 */
export async function getIrysUploader(provider) {
  const irys = await WebUploader(WebEthereum).withProvider(provider);
  return irys;
}

/**
 * Check upload cost for given data size
 */
export async function getUploadCost(irys, bytes) {
  const price = await irys.getPrice(bytes);
  return price;
}

/**
 * Fund the Irys node if needed
 */
export async function fundNode(irys, amount) {
  await irys.fund(amount);
}

/**
 * Upload a file to Arweave via Irys
 */
export async function uploadFile(irys, file) {
  const tags = [
    { name: 'Content-Type', value: file.type },
    { name: 'application-id', value: 'blockparty' },
  ];

  const buffer = await file.arrayBuffer();
  const receipt = await irys.upload(Buffer.from(buffer), { tags });
  return `ar://${receipt.id}`;
}

/**
 * Upload JSON metadata to Arweave via Irys
 */
export async function uploadMetadata(irys, metadata) {
  const tags = [
    { name: 'Content-Type', value: 'application/json' },
    { name: 'application-id', value: 'blockparty' },
  ];

  const data = JSON.stringify(metadata, null, 2);
  const receipt = await irys.upload(data, { tags });
  return `ar://${receipt.id}`;
}

/**
 * Full upload flow: images first, then metadata with ar:// URIs
 */
export async function uploadEventMetadata(irys, metadata, imageFiles) {
  const updatedMetadata = { ...metadata };

  // Upload images and replace paths with ar:// URIs
  if (imageFiles && updatedMetadata.images) {
    for (const [key, file] of Object.entries(imageFiles)) {
      if (file instanceof File) {
        const uri = await uploadFile(irys, file);
        updatedMetadata.images[key] = uri;
      }
    }
  }

  // Upload metadata JSON
  const metadataUri = await uploadMetadata(irys, updatedMetadata);
  return metadataUri;
}
```

#### 2.2 Add Required Dependencies

**Update `package.json`:**

```json
{
  "dependencies": {
    "@irys/web-upload": "^0.0.15",
    "@irys/web-upload-ethereum": "^0.0.16"
  }
}
```

Note: Check if these are the correct package names for browser usage. The current packages (`@irys/upload`, `@irys/upload-ethereum`) may work in browser with proper webpack config, or may need browser-specific versions.

#### 2.3 Webpack Configuration

May need to add polyfills for Node.js modules used by Irys:

```javascript
// webpack.config.js
resolve: {
    fallback: {
        "crypto": require.resolve("crypto-browserify"),
        "stream": require.resolve("stream-browserify"),
        "buffer": require.resolve("buffer/"),
        // ... other polyfills
    }
}
```

---

### Phase 3: UI Components

#### 3.1 Create Metadata Edit Form Component

**New file:** `src/components/MetadataEditor.js`

```javascript
import React, { Component } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Box,
  Typography,
  CircularProgress,
  Alert,
} from '@mui/material';

class MetadataEditor extends Component {
  state = {
    name: '',
    date: '',
    endDate: '',
    locationName: '',
    locationAddress: '',
    mapUrl: '',
    description: '',
    bannerFile: null,
    bannerPreview: null,
    uploading: false,
    uploadProgress: '',
    error: null,
  };

  componentDidMount() {
    // Pre-populate with existing metadata
    const { metadata } = this.props;
    if (metadata) {
      this.setState({
        name: metadata.name || '',
        date: metadata.date || '',
        endDate: metadata.endDate || '',
        locationName: metadata.location?.name || '',
        locationAddress: metadata.location?.address || '',
        mapUrl: metadata.location?.mapUrl || '',
        description: metadata.description || '',
        bannerPreview: metadata.images?.banner || null,
      });
    }
  }

  handleChange = field => event => {
    this.setState({ [field]: event.target.value });
  };

  handleFileChange = event => {
    const file = event.target.files[0];
    if (file) {
      this.setState({
        bannerFile: file,
        bannerPreview: URL.createObjectURL(file),
      });
    }
  };

  handleSubmit = async () => {
    this.setState({ uploading: true, error: null });

    try {
      const metadata = {
        name: this.state.name,
        date: this.state.date,
        endDate: this.state.endDate,
        location: {
          name: this.state.locationName,
          address: this.state.locationAddress,
          mapUrl: this.state.mapUrl,
        },
        description: this.state.description,
        images: {},
      };

      const imageFiles = {};
      if (this.state.bannerFile) {
        imageFiles.banner = this.state.bannerFile;
      } else if (this.state.bannerPreview) {
        // Keep existing banner URI
        metadata.images.banner = this.state.bannerPreview;
      }

      this.setState({ uploadProgress: 'Uploading to Arweave...' });
      const metadataUri = await this.props.onUpload(metadata, imageFiles);

      this.setState({ uploadProgress: 'Updating contract...' });
      await this.props.onUpdateContract(metadataUri);

      this.props.onClose();
    } catch (error) {
      this.setState({ error: error.message });
    } finally {
      this.setState({ uploading: false, uploadProgress: '' });
    }
  };

  render() {
    const { open, onClose } = this.props;
    const { uploading, uploadProgress, error } = this.state;

    return (
      <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
        <DialogTitle>Edit Event Metadata</DialogTitle>
        <DialogContent>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <TextField
            fullWidth
            label="Event Name"
            value={this.state.name}
            onChange={this.handleChange('name')}
            margin="normal"
          />

          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField
              fullWidth
              label="Start Date/Time"
              type="datetime-local"
              value={this.state.date?.slice(0, 16) || ''}
              onChange={this.handleChange('date')}
              margin="normal"
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              fullWidth
              label="End Date/Time"
              type="datetime-local"
              value={this.state.endDate?.slice(0, 16) || ''}
              onChange={this.handleChange('endDate')}
              margin="normal"
              InputLabelProps={{ shrink: true }}
            />
          </Box>

          <TextField
            fullWidth
            label="Venue Name"
            value={this.state.locationName}
            onChange={this.handleChange('locationName')}
            margin="normal"
          />

          <TextField
            fullWidth
            label="Address"
            value={this.state.locationAddress}
            onChange={this.handleChange('locationAddress')}
            margin="normal"
          />

          <TextField
            fullWidth
            label="Map URL"
            value={this.state.mapUrl}
            onChange={this.handleChange('mapUrl')}
            margin="normal"
          />

          <TextField
            fullWidth
            label="Description"
            value={this.state.description}
            onChange={this.handleChange('description')}
            margin="normal"
            multiline
            rows={4}
          />

          <Box sx={{ mt: 2 }}>
            <Typography variant="subtitle2">Banner Image</Typography>
            <input type="file" accept="image/*" onChange={this.handleFileChange} />
            {this.state.bannerPreview && (
              <Box sx={{ mt: 1 }}>
                <img
                  src={this.state.bannerPreview}
                  alt="Banner preview"
                  style={{ maxWidth: '100%', maxHeight: 200 }}
                />
              </Box>
            )}
          </Box>

          {uploading && (
            <Box sx={{ display: 'flex', alignItems: 'center', mt: 2 }}>
              <CircularProgress size={24} sx={{ mr: 1 }} />
              <Typography>{uploadProgress}</Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={uploading}>
            Cancel
          </Button>
          <Button onClick={this.handleSubmit} variant="contained" disabled={uploading}>
            Upload & Update
          </Button>
        </DialogActions>
      </Dialog>
    );
  }
}

export default MetadataEditor;
```

#### 3.2 Add Edit Button to Admin UI

**Modify:** `src/components/FormInput.js`

Add "Edit Metadata" button for admins:

```javascript
// In render(), add button for admins
{
  this.isAdmin() && !this.state.detail.ended && (
    <Button variant="outlined" onClick={() => this.setState({ showMetadataEditor: true })}>
      Edit Event Details
    </Button>
  );
}

// Add MetadataEditor dialog
<MetadataEditor
  open={this.state.showMetadataEditor}
  onClose={() => this.setState({ showMetadataEditor: false })}
  metadata={this.getCurrentMetadata()}
  onUpload={this.handleMetadataUpload}
  onUpdateContract={this.handleUpdateContract}
/>;
```

#### 3.3 Integration with Contract

**Modify:** `src/index.js`

Add function to call `setMetadataUri` on contract:

```javascript
async function updateMetadataUri(newUri) {
  const signer = await provider.getSigner();
  const contractWithSigner = contract.connect(signer);
  const tx = await contractWithSigner.setMetadataUri(newUri);
  await tx.wait();

  // Clear cache and refresh
  clearMetadataCache();
  await getDetail();
}

// Expose via event emitter or context
eventEmitter.on('updateMetadataUri', updateMetadataUri);
```

---

### Phase 4: Testing Strategy

#### 4.1 Smart Contract Tests (Foundry)

**File:** `test/Conference.t.sol`

```solidity
// Test admin can update metadata
function test_AdminCanSetMetadataUri() public { ... }

// Test after registration still works
function test_SetMetadataUriAfterRegistration() public { ... }

// Test non-admin rejected
function test_NonAdminCannotSetMetadataUri() public { ... }

// Test event emission
function test_SetMetadataUriEmitsEvent() public { ... }

// Test multiple updates
function test_MultipleMetadataUpdates() public { ... }
```

#### 4.2 Integration Tests (Jest + Anvil)

**New file:** `src/__tests__/integration/metadataUpdate.test.js`

```javascript
describe('Metadata Update Integration Tests', () => {
  it('should allow admin to update metadata URI', async () => {
    const contract = await deployContract();
    await grantAdmin(contract, getAddress('admin1'));

    // Admin updates metadata
    const provider = contract.runner.provider;
    const adminSigner = getSigner('admin1', provider);
    const tx = await contract.connect(adminSigner).setMetadataUri('ar://newTxId');
    await tx.wait();

    expect(await contract.metadataUri()).toBe('ar://newTxId');
  });

  it('should allow metadata update after registration', async () => {
    const contract = await deployContract({ metadataUri: 'ar://initial' });
    await register(contract, '@alice', 'user1');

    // Owner updates metadata
    const provider = contract.runner.provider;
    const ownerSigner = getSigner('deployer', provider);
    const tx = await contract.connect(ownerSigner).setMetadataUri('ar://updated');
    await tx.wait();

    expect(await contract.metadataUri()).toBe('ar://updated');
  });

  it('should reject non-admin metadata update', async () => {
    const contract = await deployContract();

    const provider = contract.runner.provider;
    const userSigner = getSigner('user1', provider);

    await expect(contract.connect(userSigner).setMetadataUri('ar://hacked')).rejects.toThrow();
  });
});
```

#### 4.3 UI Component Tests (Jest + React Testing Library)

**New file:** `src/__tests__/components/MetadataEditor.test.js`

```javascript
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import MetadataEditor from '../../components/MetadataEditor';

describe('MetadataEditor', () => {
  const mockMetadata = {
    name: 'Test Event',
    date: '2026-03-15T18:30:00Z',
    location: { name: 'Test Venue', address: '123 Test St' },
    description: 'Test description',
  };

  it('should render with existing metadata', () => {
    render(
      <MetadataEditor
        open={true}
        onClose={jest.fn()}
        metadata={mockMetadata}
        onUpload={jest.fn()}
        onUpdateContract={jest.fn()}
      />
    );

    expect(screen.getByLabelText('Event Name')).toHaveValue('Test Event');
    expect(screen.getByLabelText('Venue Name')).toHaveValue('Test Venue');
  });

  it('should call onUpload and onUpdateContract on submit', async () => {
    const onUpload = jest.fn().mockResolvedValue('ar://newTxId');
    const onUpdateContract = jest.fn().mockResolvedValue();

    render(
      <MetadataEditor
        open={true}
        onClose={jest.fn()}
        metadata={mockMetadata}
        onUpload={onUpload}
        onUpdateContract={onUpdateContract}
      />
    );

    fireEvent.click(screen.getByText('Upload & Update'));

    await waitFor(() => {
      expect(onUpload).toHaveBeenCalled();
      expect(onUpdateContract).toHaveBeenCalledWith('ar://newTxId');
    });
  });
});
```

#### 4.4 E2E Tests (Synpress)

**New file:** `src/__tests__/e2e-synpress/metadataUpdate.spec.ts`

```typescript
import { test, expect } from './fixtures';

test.describe('Metadata Update E2E', () => {
  test('admin can edit event metadata', async ({ page, metamask }) => {
    // Connect wallet as admin
    await page.goto('/');
    await metamask.connectToDapp();

    // Click edit metadata button
    await page.click('button:has-text("Edit Event Details")');

    // Fill form
    await page.fill('input[label="Event Name"]', 'Updated Event Name');
    await page.fill('textarea[label="Description"]', 'Updated description');

    // Submit (will require MetaMask approval for Irys funding + contract tx)
    await page.click('button:has-text("Upload & Update")');

    // Approve Irys funding transaction
    await metamask.confirmTransaction();

    // Approve contract update transaction
    await metamask.confirmTransaction();

    // Verify update
    await expect(page.locator('.event-name')).toHaveText('Updated Event Name');
  });
});
```

#### 4.5 Mock Arweave for Testing

For unit and integration tests, create a mock Arweave service:

**New file:** `src/__tests__/mocks/arweave.js`

```javascript
export const mockIrysUploader = {
  getPrice: jest.fn().mockResolvedValue(BigInt(1000000)),
  fund: jest.fn().mockResolvedValue({ id: 'mock-fund-tx' }),
  upload: jest.fn().mockImplementation(data => ({
    id: `mock-tx-${Date.now()}`,
  })),
};

export const getIrysUploader = jest.fn().mockResolvedValue(mockIrysUploader);
```

---

### Phase 5: Devnet Testing Workflow

#### 5.1 Local Development Setup

```bash
# Terminal 1: Run Anvil
npm run anvil

# Terminal 2: Deploy contract with initial metadata
METADATA_URI=ar://testTxId npm run deploy:local

# Terminal 3: Run UI
npm start
```

#### 5.2 Irys Devnet Testing

The Irys devnet is free and uploads expire after ~60 days. Perfect for testing.

```bash
# Set environment for devnet
export IRYS_NETWORK=devnet
export RPC_URL=http://127.0.0.1:8545

# In the UI, uploads will go to devnet
```

#### 5.3 CI Integration

```yaml
# .github/workflows/test.yml
integration-metadata:
  name: Metadata Update Tests
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: foundry-rs/foundry-toolchain@v1
    - run: npm ci
    - run: forge build
    - run: npm run test:integration -- --testPathPattern=metadataUpdate
      env:
        CI: true
```

---

## Implementation Order

### Step 1: Contract Changes (1-2 hours)

1. Modify `setMetadataUri` in `Conference.sol`
2. Modify `setMetadataUri` in `ConferenceUpgradeable.sol`
3. Add/update Foundry tests
4. Run `forge test` to verify

### Step 2: Integration Tests (1 hour)

1. Create `metadataUpdate.test.js`
2. Add tests for admin permissions
3. Run with `npm run test:integration`

### Step 3: Browser Upload Module (2-3 hours)

1. Research browser-compatible Irys packages
2. Create `src/util/arweaveUpload.js`
3. Update webpack config if needed
4. Test upload functionality manually

### Step 4: UI Components (3-4 hours)

1. Create `MetadataEditor.js` component
2. Add edit button to `FormInput.js`
3. Wire up contract interaction in `index.js`
4. Add component tests

### Step 5: E2E Tests (2-3 hours)

1. Add Synpress test for metadata update flow
2. Create mock Arweave for faster tests
3. Verify CI passes

### Step 6: Documentation (1 hour)

1. Update README with new feature
2. Document admin capabilities
3. Add troubleshooting for Irys funding

---

## Open Questions

1. **Should metadata history be stored on-chain?**
   - Pro: Auditability, can see previous versions
   - Con: Gas costs, storage costs
   - Recommendation: Start without history, add if needed

2. **Should we validate metadata schema on-chain?**
   - Not practical due to gas costs
   - Validate in UI before upload

3. **How to handle Irys funding in UI?**
   - Check balance, prompt user to fund if needed
   - Show estimated cost before upload
   - Consider subsidizing small uploads

4. **Should non-owner admins be able to update?**
   - Current plan: Yes, any admin can update
   - Alternative: Add a separate "metadata admin" role
   - Recommendation: Keep simple, trust admins

5. **What about the on-chain `name` field?**
   - Currently `changeName()` is owner-only and restricted to pre-registration
   - Should this also be updated when metadata changes?
   - Recommendation: Keep them separate - on-chain name is for identification, metadata name can be more descriptive

---

## Risk Assessment

| Risk                                          | Impact | Mitigation                                              |
| --------------------------------------------- | ------ | ------------------------------------------------------- |
| Malicious admin uploads inappropriate content | Medium | Owner can revoke admin, content is on permanent Arweave |
| Irys service unavailable                      | Low    | Show clear error, allow retry                           |
| User doesn't have ETH for Irys funding        | Medium | Show cost upfront, provide devnet option for testing    |
| MetaMask rejects transaction                  | Low    | Clear error messages, retry option                      |
| Arweave gateway slow/unavailable              | Low    | Use multiple gateways, show loading state               |

---

## Success Criteria

1. Admins can click "Edit Event Details" button
2. Form pre-populates with existing metadata
3. New images upload to Arweave successfully
4. Contract `setMetadataUri` transaction succeeds
5. UI refreshes to show updated metadata
6. All existing tests continue to pass
7. New tests cover admin metadata update flow
8. Works on both local Anvil and testnets
