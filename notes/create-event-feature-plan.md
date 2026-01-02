# Feature Plan: Create New Event via UX

## Overview

Enable users to create new event contracts directly from the UI with a "New Event" button. This leverages the existing ConferenceFactory contract and Arweave metadata upload capabilities.

## Current Infrastructure

### ConferenceFactory Contract

The factory contract (`contracts/upgradeable/ConferenceFactory.sol`) already provides:

```solidity
function createConference(
    string memory _name,
    uint256 _deposit,
    uint256 _limitOfParticipants,
    uint256 _coolingPeriod,
    string memory _metadataUri
) public returns (address)

function createConferenceDeterministic(
    string memory _name,
    uint256 _deposit,
    uint256 _limitOfParticipants,
    uint256 _coolingPeriod,
    string memory _metadataUri,
    bytes32 _salt
) public returns (address)
```

**Key Points:**

- Anyone can call `createConference()` - no access control
- Caller becomes the owner of the new conference
- Returns the address of the newly created conference proxy
- Emits `ConferenceCreated(address indexed conferenceProxy, address indexed owner, string name, ...)`

### Arweave Upload

The `arweaveUpload.js` module (just created) provides browser-based upload:

- `uploadEventMetadata(provider, metadata, imageFiles, onProgress)`
- Returns `ar://txId` for the uploaded metadata

## Proposed Changes

### Phase 1: Create Event Form Component

#### 1.1 NewEventDialog Component

**New file:** `src/components/NewEventDialog.js`

```javascript
// Form fields:
// - Event Name (string, required)
// - Deposit Amount (number in ETH, default 0.02)
// - Max Participants (number, default 20)
// - Cooling Period (select: 1 day, 1 week, 2 weeks, 1 month)
// - Date/Time (datetime-local)
// - End Date/Time (datetime-local)
// - Location Name
// - Location Address
// - Map URL
// - Description (textarea)
// - Banner Image (file upload)
// - Website URL
// - Twitter URL

// Flow:
// 1. User fills form
// 2. User clicks "Create Event"
// 3. Upload metadata to Arweave (if any fields filled)
// 4. Call factory.createConference() with params
// 5. Show success with link to new event
```

#### 1.2 Dialog State Flow

```
FORM_EDITING → UPLOADING_METADATA → CREATING_CONTRACT → SUCCESS/ERROR
```

### Phase 2: UI Integration

#### 2.1 Add "New Event" Button

**Modify:** `src/index.js`

Add a "New Event" button in the AppBar:

```javascript
<Button variant="outlined" color="inherit" onClick={() => setShowNewEventDialog(true)}>
  + New Event
</Button>
```

#### 2.2 Factory Contract Integration

Add factory contract connection in index.js:

```javascript
// Import factory ABI
import ConferenceFactoryArtifact from '../out/upgradeable/ConferenceFactory.sol/ConferenceFactory.json';

// Get factory address from config or env
const factoryAddress = network_obj.factory_address || process.env.FACTORY_ADDRESS;

// Create factory contract instance
const factory = new ethers.Contract(factoryAddress, ConferenceFactoryABI, provider);

// Create conference function
async function createConference(params) {
  const contractWithSigner = factory.connect(signer);
  const tx = await contractWithSigner.createConference(
    params.name,
    ethers.parseEther(params.deposit),
    params.limitOfParticipants,
    params.coolingPeriod,
    params.metadataUri
  );
  const receipt = await tx.wait();

  // Parse ConferenceCreated event to get new address
  const event = receipt.logs.find(log => ...);
  return newConferenceAddress;
}
```

### Phase 3: Configuration

#### 3.1 Update app_config.js

Add factory address for each network:

```javascript
module.exports = {
  mainnet: {
    factory_address: '0x...',
    contract_addresses: { ... }
  },
  sepolia: {
    factory_address: '0x...',
    contract_addresses: { ... }
  },
  development: {
    factory_address: process.env.FACTORY_ADDRESS || null,
    contract_addresses: { ... }
  }
};
```

#### 3.2 Deploy Script Updates

Update `script/Deploy.s.sol` to output factory address:

```solidity
// Already deployed: ConferenceFactory
// Need to ensure we capture and save the factory address
```

### Phase 4: Post-Creation Flow

After creating an event:

1. Show success message with new contract address
2. Option to "Go to Event" (redirects to `?contract=0x...`)
3. Option to "Create Another Event"
4. The creator is automatically the owner of the new event

### Phase 5: Testing

#### 5.1 Component Tests

**New file:** `src/__tests__/components/NewEventDialog.test.js`

- Test form validation
- Test submission flow
- Test error handling

#### 5.2 Integration Tests

**New file:** `src/__tests__/integration/createEvent.test.js`

- Test factory contract interaction
- Test event creation with metadata
- Test owner assignment

#### 5.3 E2E Tests

- Test full flow from button click to new event page

---

## Implementation Order

### Step 1: Factory Contract Setup (30 min)

1. Add factory ABI import
2. Add factory address to config
3. Add factory contract instance in index.js

### Step 2: NewEventDialog Component (2-3 hours)

1. Create form component with all fields
2. Add validation (required fields, numeric ranges)
3. Add metadata upload integration
4. Add contract creation call
5. Add success/error states

### Step 3: UI Integration (30 min)

1. Add "New Event" button to AppBar
2. Wire up dialog open/close
3. Handle navigation to new event

### Step 4: Testing (1-2 hours)

1. Add component tests
2. Add integration tests
3. Verify with local Anvil

### Step 5: Documentation (30 min)

1. Update README
2. Add inline comments

---

## Form Field Validation

| Field            | Required | Validation                   |
| ---------------- | -------- | ---------------------------- |
| Event Name       | Yes      | 1-100 chars                  |
| Deposit          | Yes      | > 0, max 10 ETH              |
| Max Participants | Yes      | 1-1000                       |
| Cooling Period   | Yes      | Selection from preset values |
| Start Date       | No       | Future date                  |
| End Date         | No       | After start date             |
| Location Name    | No       | Max 200 chars                |
| Location Address | No       | Max 500 chars                |
| Map URL          | No       | Valid URL format             |
| Description      | No       | Max 5000 chars               |
| Banner Image     | No       | Image file, max 5MB          |
| Website          | No       | Valid URL format             |
| Twitter          | No       | Valid URL format             |

---

## UI Mockup

```
+-------------------------------------------+
|            Create New Event               |
+-------------------------------------------+
| Event Name *                              |
| [________________________]                |
|                                           |
| Deposit Amount (ETH) *   Max Participants |
| [0.02_____________]      [20_____________]|
|                                           |
| Cooling Period *                          |
| [1 week_____________________▼]            |
|                                           |
| ─────────── Event Details ───────────     |
|                                           |
| Start Date/Time          End Date/Time    |
| [_________________]      [_______________]|
|                                           |
| Venue Name                                |
| [________________________]                |
|                                           |
| Address                                   |
| [________________________]                |
|                                           |
| Map URL                                   |
| [________________________]                |
|                                           |
| Description                               |
| [________________________]                |
| [________________________]                |
| [________________________]                |
|                                           |
| ─────────── Links ───────────             |
|                                           |
| Website            Twitter                |
| [____________]     [_____________]        |
|                                           |
| ─────────── Banner Image ───────────      |
|                                           |
| [Upload Image]  Max 5MB, JPG/PNG/GIF      |
|                                           |
| [=============================] Uploading |
|                                           |
+-------------------------------------------+
|              [Cancel]  [Create Event]     |
+-------------------------------------------+
```

---

## Error States

1. **Wallet Not Connected**
   - Show message: "Connect your wallet to create an event"
   - Disable form submission

2. **Factory Not Deployed**
   - Show message: "Event factory not available on this network"
   - Provide instructions for deploying factory

3. **Insufficient Balance**
   - Show estimated gas cost
   - Warn if balance is low

4. **Upload Failed**
   - Show error message
   - Allow retry or skip metadata

5. **Transaction Failed**
   - Show revert reason
   - Allow retry

---

## Security Considerations

1. **Gas Estimation**
   - Estimate gas before transaction
   - Warn user of cost

2. **Input Validation**
   - Sanitize all inputs
   - Validate on client AND let contract validate

3. **No Private Keys**
   - All transactions via MetaMask/wallet
   - No key handling in UI

---

## Future Enhancements

1. **Event Templates**
   - Pre-filled settings for common event types

2. **Draft Saving**
   - Save form progress to localStorage

3. **Event Preview**
   - Show preview of event page before creation

4. **Batch Creation**
   - Create multiple events at once

5. **Clone Event**
   - Copy settings from existing event
