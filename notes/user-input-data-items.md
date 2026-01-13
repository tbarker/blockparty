# User Input Data Items

This table documents all data items that are entered or edited by users in the BlockParty application.

## Event Creation

| Field | Description | Expected Values | Validation |
|-------|-------------|-----------------|------------|
| `name` | The public name of the event displayed to participants | Non-empty string, max 100 characters | Required |
| `deposit` | Amount of ETH each participant must stake to register | Decimal number between 0.001 and 10 ETH | Required, numeric |
| `limitOfParticipants` | Maximum number of people who can register | Integer between 1 and 1000 | Required, integer |
| `coolingPeriod` | Time after event ends before owner can claim unclaimed deposits | Preset options: 86400 (1 day), 259200 (3 days), 604800 (1 week), 1209600 (2 weeks), 2592000 (1 month) seconds | Required, select from presets |

## Event Metadata (Arweave)

| Field | Description | Expected Values | Validation |
|-------|-------------|-----------------|------------|
| `date` | Event start date and time | ISO 8601 datetime (via datetime-local input) | Optional |
| `endDate` | Event end date and time | ISO 8601 datetime (via datetime-local input) | Optional |
| `locationName` | Name of the venue | Free text string (e.g., "Conference Center A") | Optional |
| `locationAddress` | Physical address of the venue | Free text string (e.g., "123 Main St, City") | Optional |
| `mapUrl` | URL to map/directions for the venue | Valid URL (Google Maps, etc.) | Optional, URL format |
| `description` | Detailed description of the event | Free text, supports markdown | Optional |
| `websiteUrl` | Link to event website or landing page | Valid URL | Optional, URL format |
| `twitterUrl` | Link to event's Twitter/X account | Valid URL | Optional, URL format |
| `bannerFile` | Banner image for the event | Image file (uploaded via file picker), displayed as preview before upload | Optional, image file |

## Registration

| Field | Description | Expected Values | Validation |
|-------|-------------|-----------------|------------|
| `participantName` | Participant's identifier (typically Twitter handle) | Non-empty string (e.g., "@username") | Required |
| `address` | Wallet address to register from | Valid Ethereum address from connected wallet | Required, auto-populated from wallet |

## Attendance Management (Admin Only)

| Field | Description | Expected Values | Validation |
|-------|-------------|-----------------|------------|
| `attendees` | Addresses of participants to mark as attended | Array of valid Ethereum addresses (selected via checkboxes) | At least one address required |

## Search/Filter

| Field | Description | Expected Values | Validation |
|-------|-------------|-----------------|------------|
| `keyword` | Search term to filter participant list | String, minimum 3 characters to trigger search | Min 3 chars |

## Admin Management (Owner Only)

| Field | Description | Expected Values | Validation |
|-------|-------------|-----------------|------------|
| `newAdmins` | Addresses to grant admin privileges | Array of valid Ethereum addresses | Valid addresses |
| `oldAdmins` | Addresses to revoke admin privileges | Array of valid Ethereum addresses | Valid addresses |

## Configuration (Developer/Debug)

| Field | Description | Expected Values | Validation |
|-------|-------------|-----------------|------------|
| `turbo_devnet` | Toggle for Arweave devnet mode | "true" or "false" (localStorage) | Boolean string |

## Notes

- **On-chain fields** (name, deposit, limitOfParticipants, coolingPeriod) are immutable after event creation, except `name` which can be changed by the owner
- **Metadata fields** can be updated by uploading new metadata to Arweave and calling `setMetadataUri`
- **Deposit** is sent as `msg.value` with the registration transaction
- **Banner images** are uploaded to Arweave via ArDrive Turbo and referenced by `ar://` URI
- **Address fields** are typically selected from connected wallet accounts rather than typed manually
