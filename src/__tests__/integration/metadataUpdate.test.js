/**
 * Metadata Update Integration Tests
 *
 * These tests verify that admins can update event metadata:
 * - Owner can update metadata
 * - Granted admins can update metadata
 * - Non-admins cannot update metadata
 * - Metadata can be updated after registration
 *
 * Prerequisites:
 *   - Anvil running: npm run anvil
 *   - Contract artifacts built: npm run forge:build
 */

const {
  deployContract,
  register,
  grantAdmin,
  getAddress,
  getSigner,
  ensureAnvilRunning,
  stopAnvil,
  resetAnvil,
} = require('./anvilSetup');

describe('Metadata Update Integration Tests', () => {
  // Track if we started Anvil ourselves
  let weStartedAnvil = false;

  // Ensure Anvil is running before all tests (will auto-start in CI)
  beforeAll(async () => {
    weStartedAnvil = await ensureAnvilRunning();
  });

  // Clean up Anvil if we started it
  afterAll(() => {
    if (weStartedAnvil) {
      stopAnvil();
    }
  });

  // Reset Anvil before each test to ensure clean nonce state
  beforeEach(async () => {
    await resetAnvil();
  });

  describe('Owner Metadata Updates', () => {
    it('should allow owner to set metadata URI', async () => {
      const contract = await deployContract();

      const provider = contract.runner.provider;
      const ownerSigner = getSigner('deployer', provider);

      const tx = await contract.connect(ownerSigner).setMetadataUri('ar://ownerTestTxId');
      await tx.wait();

      const uri = await contract.metadataUri();
      expect(uri).toBe('ar://ownerTestTxId');
    });

    it('should allow owner to update metadata after registration', async () => {
      const contract = await deployContract({ metadataUri: 'ar://initial' });

      // Register a participant
      await register(contract, '@alice', 'user1');

      // Owner should still be able to update metadata
      const provider = contract.runner.provider;
      const ownerSigner = getSigner('deployer', provider);

      const tx = await contract.connect(ownerSigner).setMetadataUri('ar://updatedAfterReg');
      await tx.wait();

      const uri = await contract.metadataUri();
      expect(uri).toBe('ar://updatedAfterReg');
    });

    it('should emit MetadataUpdated event', async () => {
      const contract = await deployContract();

      const provider = contract.runner.provider;
      const ownerSigner = getSigner('deployer', provider);

      const tx = await contract.connect(ownerSigner).setMetadataUri('ar://eventTestTxId');
      const receipt = await tx.wait();

      // Find the MetadataUpdated event
      const event = receipt.logs.find(log => {
        try {
          const parsed = contract.interface.parseLog(log);
          return parsed && parsed.name === 'MetadataUpdated';
        } catch {
          return false;
        }
      });

      expect(event).toBeDefined();
      const parsedEvent = contract.interface.parseLog(event);
      expect(parsedEvent.args[0]).toBe('ar://eventTestTxId');
    });

    it('should allow multiple metadata updates', async () => {
      const contract = await deployContract();

      const provider = contract.runner.provider;
      const ownerSigner = getSigner('deployer', provider);

      // First update
      let tx = await contract.connect(ownerSigner).setMetadataUri('ar://version1');
      await tx.wait();
      expect(await contract.metadataUri()).toBe('ar://version1');

      // Second update
      tx = await contract.connect(ownerSigner).setMetadataUri('ar://version2');
      await tx.wait();
      expect(await contract.metadataUri()).toBe('ar://version2');

      // Third update
      tx = await contract.connect(ownerSigner).setMetadataUri('ar://version3');
      await tx.wait();
      expect(await contract.metadataUri()).toBe('ar://version3');
    });
  });

  describe('Admin Metadata Updates', () => {
    it('should allow granted admin to set metadata URI', async () => {
      const contract = await deployContract();

      // Grant admin role to admin1
      await grantAdmin(contract, getAddress('admin1'));

      // Admin updates metadata
      const provider = contract.runner.provider;
      const adminSigner = getSigner('admin1', provider);

      const tx = await contract.connect(adminSigner).setMetadataUri('ar://adminTestTxId');
      await tx.wait();

      const uri = await contract.metadataUri();
      expect(uri).toBe('ar://adminTestTxId');
    });

    it('should allow admin to update metadata after registration', async () => {
      const contract = await deployContract({ metadataUri: 'ar://initial' });

      // Grant admin role
      await grantAdmin(contract, getAddress('admin1'));

      // Register a participant
      await register(contract, '@alice', 'user1');

      // Admin should still be able to update metadata
      const provider = contract.runner.provider;
      const adminSigner = getSigner('admin1', provider);

      const tx = await contract.connect(adminSigner).setMetadataUri('ar://adminUpdatedAfterReg');
      await tx.wait();

      const uri = await contract.metadataUri();
      expect(uri).toBe('ar://adminUpdatedAfterReg');
    });

    it('should allow multiple admins to update metadata', async () => {
      const contract = await deployContract();

      // Grant admin role to multiple users
      await grantAdmin(contract, [getAddress('admin1'), getAddress('user1')]);

      const provider = contract.runner.provider;

      // First admin updates
      const admin1Signer = getSigner('admin1', provider);
      let tx = await contract.connect(admin1Signer).setMetadataUri('ar://admin1Update');
      await tx.wait();
      expect(await contract.metadataUri()).toBe('ar://admin1Update');

      // Second admin updates
      const user1Signer = getSigner('user1', provider);
      tx = await contract.connect(user1Signer).setMetadataUri('ar://user1Update');
      await tx.wait();
      expect(await contract.metadataUri()).toBe('ar://user1Update');
    });
  });

  describe('Non-Admin Metadata Updates', () => {
    it('should reject metadata update from non-admin', async () => {
      const contract = await deployContract();

      const provider = contract.runner.provider;
      const nonAdminSigner = getSigner('user1', provider);

      await expect(
        contract.connect(nonAdminSigner).setMetadataUri('ar://hackerTxId')
      ).rejects.toThrow();

      // Verify metadata was not changed
      const uri = await contract.metadataUri();
      expect(uri).toBe('');
    });

    it('should reject metadata update from revoked admin', async () => {
      const contract = await deployContract();

      // Grant then revoke admin role
      await grantAdmin(contract, getAddress('admin1'));

      const provider = contract.runner.provider;
      const ownerSigner = getSigner('deployer', provider);
      const revokeTx = await contract.connect(ownerSigner).revoke([getAddress('admin1')]);
      await revokeTx.wait();

      // Revoked admin tries to update
      const adminSigner = getSigner('admin1', provider);
      await expect(
        contract.connect(adminSigner).setMetadataUri('ar://revokedAdminTxId')
      ).rejects.toThrow();
    });
  });

  describe('Metadata URI Values', () => {
    it('should handle empty metadata URI', async () => {
      const contract = await deployContract({ metadataUri: 'ar://initial' });

      const provider = contract.runner.provider;
      const ownerSigner = getSigner('deployer', provider);

      // Set to empty string
      const tx = await contract.connect(ownerSigner).setMetadataUri('');
      await tx.wait();

      const uri = await contract.metadataUri();
      expect(uri).toBe('');
    });

    it('should handle long metadata URI', async () => {
      const contract = await deployContract();

      const provider = contract.runner.provider;
      const ownerSigner = getSigner('deployer', provider);

      // Long URI (typical Arweave transaction ID is 43 chars)
      const longUri = 'ar://' + 'a'.repeat(100);
      const tx = await contract.connect(ownerSigner).setMetadataUri(longUri);
      await tx.wait();

      const uri = await contract.metadataUri();
      expect(uri).toBe(longUri);
    });

    it('should handle different URI formats', async () => {
      const contract = await deployContract();

      const provider = contract.runner.provider;
      const ownerSigner = getSigner('deployer', provider);

      // Test ar:// format
      let tx = await contract.connect(ownerSigner).setMetadataUri('ar://abc123xyz');
      await tx.wait();
      expect(await contract.metadataUri()).toBe('ar://abc123xyz');

      // Test https:// format (for gateway URLs)
      tx = await contract.connect(ownerSigner).setMetadataUri('https://arweave.net/abc123xyz');
      await tx.wait();
      expect(await contract.metadataUri()).toBe('https://arweave.net/abc123xyz');

      // Test ipfs:// format
      tx = await contract.connect(ownerSigner).setMetadataUri('ipfs://QmTest123');
      await tx.wait();
      expect(await contract.metadataUri()).toBe('ipfs://QmTest123');
    });
  });
});
