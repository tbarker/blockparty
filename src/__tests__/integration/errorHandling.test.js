/**
 * Error Handling Integration Tests
 *
 * These tests verify that the contract correctly reverts with appropriate
 * error messages for invalid operations:
 * - Invalid deposit amounts
 * - Double registration
 * - Unauthorized access
 * - Invalid state transitions
 *
 * Prerequisites:
 *   - Anvil running: npm run anvil
 *   - Contract artifacts built: npm run forge:build
 */

const { ethers } = require('ethers');
const {
  deployContract,
  register,
  attend,
  payback,
  cancel,
  withdraw,
  getAddress,
  getSigner,
  ensureAnvilRunning,
  stopAnvil,
  resetAnvil,
  advanceTime,
  getContractState,
  DEFAULT_DEPOSIT,
} = require('./anvilSetup');

describe('Error Handling Integration Tests', () => {
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

  describe('Registration Errors', () => {
    it('should reject registration with incorrect deposit amount (too low)', async () => {
      const contract = await deployContract();
      const provider = contract.runner.provider;
      const user1Signer = getSigner('user1', provider);
      const wrongDeposit = ethers.parseEther('0.01'); // Half of required

      await expect(
        contract.connect(user1Signer).register('@alice', { value: wrongDeposit })
      ).rejects.toThrow();
    });

    it('should reject registration with incorrect deposit amount (too high)', async () => {
      const contract = await deployContract();
      const provider = contract.runner.provider;
      const user1Signer = getSigner('user1', provider);
      const wrongDeposit = ethers.parseEther('0.05'); // More than required

      await expect(
        contract.connect(user1Signer).register('@alice', { value: wrongDeposit })
      ).rejects.toThrow();
    });

    it('should reject registration with zero deposit', async () => {
      const contract = await deployContract();
      const provider = contract.runner.provider;
      const user1Signer = getSigner('user1', provider);

      await expect(
        contract.connect(user1Signer).register('@alice', { value: 0 })
      ).rejects.toThrow();
    });

    it('should reject double registration from same address', async () => {
      const contract = await deployContract();
      await register(contract, '@alice', 'user1');

      // Try to register again
      await expect(register(contract, '@alice_again', 'user1')).rejects.toThrow();
    });

    it('should reject registration after event ends', async () => {
      const contract = await deployContract();
      await register(contract, '@alice', 'user1');
      await attend(contract, getAddress('user1'));
      await payback(contract);

      await expect(register(contract, '@bob', 'user2')).rejects.toThrow();
    });

    it('should reject registration after event is cancelled', async () => {
      const contract = await deployContract();
      await cancel(contract);

      await expect(register(contract, '@alice', 'user1')).rejects.toThrow();
    });

    it('should reject registration when limit reached', async () => {
      const contract = await deployContract({ limitOfParticipants: 2 });

      await register(contract, '@alice', 'user1');
      await register(contract, '@bob', 'user2');

      await expect(register(contract, '@charlie', 'user3')).rejects.toThrow();
    });
  });

  describe('Attendance Errors', () => {
    it('should reject attendance marking for unregistered address', async () => {
      const contract = await deployContract();
      await register(contract, '@alice', 'user1');

      // Try to mark unregistered user2
      await expect(attend(contract, getAddress('user2'))).rejects.toThrow();
    });

    it('should reject double attendance marking', async () => {
      const contract = await deployContract();
      await register(contract, '@alice', 'user1');
      await attend(contract, getAddress('user1'));

      await expect(attend(contract, getAddress('user1'))).rejects.toThrow();
    });

    it('should reject attendance marking by non-admin', async () => {
      const contract = await deployContract();
      await register(contract, '@alice', 'user1');

      const provider = contract.runner.provider;
      const nonAdminSigner = getSigner('user2', provider);
      await expect(
        contract.connect(nonAdminSigner).attend([getAddress('user1')])
      ).rejects.toThrow();
    });

    it('should reject attendance marking after event ends', async () => {
      const contract = await deployContract();
      await register(contract, '@alice', 'user1');
      await register(contract, '@bob', 'user2');
      await attend(contract, getAddress('user1'));
      await payback(contract);

      // Try to mark user2 after event ended
      await expect(attend(contract, getAddress('user2'))).rejects.toThrow();
    });
  });

  describe('Withdrawal Errors', () => {
    it('should reject withdrawal before event ends', async () => {
      const contract = await deployContract();
      await register(contract, '@alice', 'user1');
      await attend(contract, getAddress('user1'));

      // Event not ended yet
      await expect(withdraw(contract, 'user1')).rejects.toThrow();
    });

    it('should reject withdrawal for non-attendee after payback', async () => {
      const contract = await deployContract();
      await register(contract, '@alice', 'user1');
      await register(contract, '@bob', 'user2');
      await attend(contract, getAddress('user1')); // Only user1 attends
      await payback(contract);

      // user2 didn't attend, can't withdraw
      await expect(withdraw(contract, 'user2')).rejects.toThrow();
    });

    it('should reject withdrawal for non-participant', async () => {
      const contract = await deployContract();
      await register(contract, '@alice', 'user1');
      await attend(contract, getAddress('user1'));
      await payback(contract);

      // user2 never registered
      await expect(withdraw(contract, 'user2')).rejects.toThrow();
    });

    it('should reject double withdrawal', async () => {
      const contract = await deployContract();
      await register(contract, '@alice', 'user1');
      await attend(contract, getAddress('user1'));
      await payback(contract);
      await withdraw(contract, 'user1');

      // Try to withdraw again
      await expect(withdraw(contract, 'user1')).rejects.toThrow();
    });
  });

  describe('Owner-Only Action Errors', () => {
    it('should reject payback by non-owner', async () => {
      const contract = await deployContract();
      await register(contract, '@alice', 'user1');
      await attend(contract, getAddress('user1'));

      const provider = contract.runner.provider;
      const nonOwnerSigner = getSigner('user1', provider);
      await expect(contract.connect(nonOwnerSigner).payback()).rejects.toThrow();
    });

    it('should reject cancel by non-owner', async () => {
      const contract = await deployContract();
      await register(contract, '@alice', 'user1');

      const provider = contract.runner.provider;
      const nonOwnerSigner = getSigner('user1', provider);
      await expect(contract.connect(nonOwnerSigner).cancel()).rejects.toThrow();
    });

    it('should reject clear by non-owner', async () => {
      const contract = await deployContract({ coolingPeriod: 1 });
      await register(contract, '@alice', 'user1');
      await attend(contract, getAddress('user1'));
      await payback(contract);
      await advanceTime(contract, 100);

      const provider = contract.runner.provider;
      const nonOwnerSigner = getSigner('user1', provider);
      await expect(contract.connect(nonOwnerSigner).clear()).rejects.toThrow();
    });

    it('should reject setLimitOfParticipants by non-owner', async () => {
      const contract = await deployContract();
      const provider = contract.runner.provider;
      const nonOwnerSigner = getSigner('user1', provider);
      await expect(contract.connect(nonOwnerSigner).setLimitOfParticipants(100)).rejects.toThrow();
    });

    it('should reject changeName by non-owner', async () => {
      const contract = await deployContract();
      const provider = contract.runner.provider;
      const nonOwnerSigner = getSigner('user1', provider);
      await expect(contract.connect(nonOwnerSigner).changeName('Hacked!')).rejects.toThrow();
    });

    it('should reject grant admin by non-owner', async () => {
      const contract = await deployContract();
      const provider = contract.runner.provider;
      const nonOwnerSigner = getSigner('user1', provider);
      // grant() expects an array of addresses
      await expect(contract.connect(nonOwnerSigner).grant([getAddress('user2')])).rejects.toThrow();
    });

    it('should reject revoke admin by non-owner', async () => {
      const contract = await deployContract();

      // First grant admin (grant expects an array)
      const provider = contract.runner.provider;
      const ownerSigner = getSigner('deployer', provider);
      const tx = await contract.connect(ownerSigner).grant([getAddress('admin1')]);
      await tx.wait();

      // Non-owner tries to revoke
      const nonOwnerSigner = getSigner('user1', provider);
      await expect(contract.connect(nonOwnerSigner).revoke(getAddress('admin1'))).rejects.toThrow();
    });
  });

  describe('State Transition Errors', () => {
    it('should reject payback when event already ended', async () => {
      const contract = await deployContract();
      await register(contract, '@alice', 'user1');
      await attend(contract, getAddress('user1'));
      await payback(contract);

      await expect(payback(contract)).rejects.toThrow();
    });

    it('should reject cancel when event already ended', async () => {
      const contract = await deployContract();
      await register(contract, '@alice', 'user1');
      await attend(contract, getAddress('user1'));
      await payback(contract);

      await expect(cancel(contract)).rejects.toThrow();
    });

    it('should reject attend when event ended', async () => {
      const contract = await deployContract();
      await register(contract, '@alice', 'user1');
      await register(contract, '@bob', 'user2');
      await attend(contract, getAddress('user1'));
      await payback(contract);

      await expect(attend(contract, getAddress('user2'))).rejects.toThrow();
    });

    it('should reject clear before event ends', async () => {
      const contract = await deployContract();
      await register(contract, '@alice', 'user1');

      const provider = contract.runner.provider;
      const ownerSigner = getSigner('deployer', provider);
      await expect(contract.connect(ownerSigner).clear()).rejects.toThrow();
    });

    it('should reject clear before cooling period passes', async () => {
      const contract = await deployContract({ coolingPeriod: 3600 }); // 1 hour
      await register(contract, '@alice', 'user1');
      await attend(contract, getAddress('user1'));
      await payback(contract);

      // Don't advance time
      const provider = contract.runner.provider;
      const ownerSigner = getSigner('deployer', provider);
      await expect(contract.connect(ownerSigner).clear()).rejects.toThrow();
    });
  });

  describe('Edge Case Errors', () => {
    it('should handle empty address array for attend gracefully', async () => {
      const contract = await deployContract();
      await register(contract, '@alice', 'user1');

      const provider = contract.runner.provider;
      const ownerSigner = getSigner('deployer', provider);

      // Empty array should succeed but not change anything
      const tx = await contract.connect(ownerSigner).attend([]);
      await tx.wait();

      const state = await getContractState(contract);
      expect(state.attended).toBe(0);
    });

    it('should accept registration with empty name', async () => {
      const contract = await deployContract();

      // The contract doesn't explicitly validate empty names
      await register(contract, '', 'user1');

      const participant = await contract.participants(getAddress('user1'));
      expect(participant[0]).toBe(''); // Empty name is stored
    });
  });
});
