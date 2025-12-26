/**
 * Admin Workflow Integration Tests
 *
 * These tests verify admin-specific functionality:
 * - Event configuration
 * - Granting/revoking admin roles
 * - Marking attendance
 * - Triggering payback
 * - Canceling events
 * - Clearing unclaimed funds after cooling period
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
  grantAdmin,
  getContractState,
  getParticipant,
  getAddress,
  getSigner,
  isAnvilRunning,
  resetAnvil,
  advanceTime,
  DEFAULT_DEPOSIT,
} = require('./anvilSetup');

describe('Admin Workflow Integration Tests', () => {
  beforeAll(async () => {
    const running = await isAnvilRunning();
    if (!running) {
      throw new Error(
        'Anvil is not running. Start it with: npm run anvil\n' +
          'Then run tests with: npm run test:integration'
      );
    }
  });

  // Reset Anvil before each test to ensure clean nonce state
  beforeEach(async () => {
    await resetAnvil();
  });

  describe('Event Configuration', () => {
    it('should deploy with custom parameters', async () => {
      const customDeposit = ethers.parseEther('0.05');
      const customLimit = 50;
      const customName = 'Custom Event';
      const customCooling = 60 * 60 * 24; // 1 day

      const contract = await deployContract({
        name: customName,
        deposit: customDeposit,
        limitOfParticipants: customLimit,
        coolingPeriod: customCooling,
      });

      const state = await getContractState(contract);
      expect(state.name).toBe(customName);
      expect(state.deposit).toBe(customDeposit);
      expect(state.limitOfParticipants).toBe(customLimit);

      const coolingPeriod = await contract.coolingPeriod();
      expect(Number(coolingPeriod)).toBe(customCooling);
    });

    it('should allow owner to change event name before registration', async () => {
      const contract = await deployContract();
      const provider = contract.runner.provider;
      const ownerSigner = getSigner('deployer', provider);
      const newName = 'Renamed Event';

      await contract.connect(ownerSigner).changeName(newName);

      const state = await getContractState(contract);
      expect(state.name).toBe(newName);
    });

    it('should not allow name change after registration', async () => {
      const contract = await deployContract();
      await register(contract, '@alice', 'user1');

      const provider = contract.runner.provider;
      const ownerSigner = getSigner('deployer', provider);
      await expect(contract.connect(ownerSigner).changeName('New Name')).rejects.toThrow();
    });

    it('should allow owner to change participant limit', async () => {
      const contract = await deployContract();
      const provider = contract.runner.provider;
      const ownerSigner = getSigner('deployer', provider);

      await contract.connect(ownerSigner).setLimitOfParticipants(100);

      const state = await getContractState(contract);
      expect(state.limitOfParticipants).toBe(100);
    });
  });

  describe('Admin Role Management', () => {
    it('should allow owner to grant admin role', async () => {
      const contract = await deployContract();
      const adminAddress = getAddress('admin1');

      await grantAdmin(contract, adminAddress);

      const isAdmin = await contract.isAdmin(adminAddress);
      expect(isAdmin).toBe(true);
    });

    it('should allow admin to mark attendance', async () => {
      const contract = await deployContract();
      const adminAddress = getAddress('admin1');

      // Grant admin role
      await grantAdmin(contract, adminAddress);

      // Register a user
      await register(contract, '@alice', 'user1');

      // Admin marks attendance
      const provider = contract.runner.provider;
      const adminSigner = getSigner('admin1', provider);
      const tx = await contract.connect(adminSigner).attend([getAddress('user1')]);
      await tx.wait();

      // Verify attendance
      const participant = await getParticipant(contract, getAddress('user1'));
      expect(participant.attended).toBe(true);
    });

    it('should allow owner to revoke admin role', async () => {
      const contract = await deployContract();
      const adminAddress = getAddress('admin1');
      const provider = contract.runner.provider;
      const ownerSigner = getSigner('deployer', provider);

      // Grant then revoke (revoke expects an array)
      await grantAdmin(contract, adminAddress);
      const tx = await contract.connect(ownerSigner).revoke([adminAddress]);
      await tx.wait();

      const isAdmin = await contract.isAdmin(adminAddress);
      expect(isAdmin).toBe(false);
    });

    it('should not allow non-admin to mark attendance', async () => {
      const contract = await deployContract();
      await register(contract, '@alice', 'user1');

      // user2 (not an admin) tries to mark attendance
      const provider = contract.runner.provider;
      const nonAdminSigner = getSigner('user2', provider);
      await expect(
        contract.connect(nonAdminSigner).attend([getAddress('user1')])
      ).rejects.toThrow();
    });

    it('should list all admins', async () => {
      const contract = await deployContract();
      const admin1 = getAddress('admin1');
      const user1 = getAddress('user1');

      await grantAdmin(contract, admin1);
      await grantAdmin(contract, user1);

      const admins = await contract.getAdmins();

      // getAdmins() only returns explicitly granted admins, not the owner
      // Owner has admin rights via onlyAdmin modifier but isn't in the admins array
      expect(admins).toContain(admin1);
      expect(admins).toContain(user1);
      expect(admins.length).toBe(2);
    });
  });

  describe('Attendance Management', () => {
    it('should mark multiple attendees at once', async () => {
      const contract = await deployContract();

      // Register 3 users
      await register(contract, '@alice', 'user1');
      await register(contract, '@bob', 'user2');
      await register(contract, '@charlie', 'user3');

      // Mark all as attended in one transaction
      await attend(contract, [getAddress('user1'), getAddress('user2'), getAddress('user3')]);

      // Verify all attended
      const state = await getContractState(contract);
      expect(state.attended).toBe(3);

      for (const user of ['user1', 'user2', 'user3']) {
        const p = await getParticipant(contract, getAddress(user));
        expect(p.attended).toBe(true);
      }
    });

    it('should not allow marking unregistered address as attended', async () => {
      const contract = await deployContract();
      await register(contract, '@alice', 'user1');

      // Try to mark unregistered user2
      await expect(attend(contract, getAddress('user2'))).rejects.toThrow();
    });

    it('should not allow marking attendance twice', async () => {
      const contract = await deployContract();
      await register(contract, '@alice', 'user1');
      await attend(contract, getAddress('user1'));

      // Try to mark again
      await expect(attend(contract, getAddress('user1'))).rejects.toThrow();
    });
  });

  describe('Payback Flow', () => {
    it('should end event and set payout amount', async () => {
      const contract = await deployContract();
      await register(contract, '@alice', 'user1');
      await register(contract, '@bob', 'user2');
      await attend(contract, getAddress('user1'));

      await payback(contract);

      const state = await getContractState(contract);
      expect(state.ended).toBe(true);
      expect(state.cancelled).toBe(false);

      // Payout = total balance / attended = (2 * 0.02 ETH) / 1 = 0.04 ETH
      const expectedPayout = DEFAULT_DEPOSIT * 2n;
      expect(state.payoutAmount).toBe(expectedPayout);
    });

    it('should not allow payback by non-owner', async () => {
      const contract = await deployContract();
      await register(contract, '@alice', 'user1');
      await attend(contract, getAddress('user1'));

      const provider = contract.runner.provider;
      const nonOwnerSigner = getSigner('user1', provider);
      await expect(contract.connect(nonOwnerSigner).payback()).rejects.toThrow();
    });

    it('should not allow payback twice', async () => {
      const contract = await deployContract();
      await register(contract, '@alice', 'user1');
      await attend(contract, getAddress('user1'));
      await payback(contract);

      await expect(payback(contract)).rejects.toThrow();
    });

    it('should not allow registration after payback', async () => {
      const contract = await deployContract();
      await register(contract, '@alice', 'user1');
      await attend(contract, getAddress('user1'));
      await payback(contract);

      await expect(register(contract, '@bob', 'user2')).rejects.toThrow();
    });
  });

  describe('Cancel Flow', () => {
    it('should cancel event and refund full deposit', async () => {
      const contract = await deployContract();
      await register(contract, '@alice', 'user1');
      await register(contract, '@bob', 'user2');

      await cancel(contract);

      const state = await getContractState(contract);
      expect(state.cancelled).toBe(true);
      expect(state.ended).toBe(true);
      expect(state.payoutAmount).toBe(DEFAULT_DEPOSIT);
    });

    it('should not allow cancel by non-owner', async () => {
      const contract = await deployContract();
      await register(contract, '@alice', 'user1');

      const provider = contract.runner.provider;
      const nonOwnerSigner = getSigner('user1', provider);
      await expect(contract.connect(nonOwnerSigner).cancel()).rejects.toThrow();
    });

    it('should not allow cancel after payback', async () => {
      const contract = await deployContract();
      await register(contract, '@alice', 'user1');
      await attend(contract, getAddress('user1'));
      await payback(contract);

      await expect(cancel(contract)).rejects.toThrow();
    });
  });

  describe('Clear Unclaimed Funds', () => {
    it('should allow owner to clear funds after cooling period', async () => {
      // Deploy with short cooling period (10 seconds)
      const contract = await deployContract({ coolingPeriod: 10 });

      await register(contract, '@alice', 'user1');
      await register(contract, '@bob', 'user2');
      await attend(contract, getAddress('user1'));
      await payback(contract);

      // user1 withdraws, user2 doesn't (forfeits their portion)
      await withdraw(contract, 'user1');

      // Advance time past cooling period
      await advanceTime(contract, 15);

      // Owner clears remaining funds
      const provider = contract.runner.provider;
      const ownerSigner = getSigner('deployer', provider);

      const tx = await contract.connect(ownerSigner).clear();
      await tx.wait();

      // Verify contract is empty
      const state = await getContractState(contract);
      expect(state.totalBalance).toBe(0n);
    });

    it('should not allow clear before cooling period', async () => {
      const contract = await deployContract({ coolingPeriod: 3600 }); // 1 hour
      await register(contract, '@alice', 'user1');
      await attend(contract, getAddress('user1'));
      await payback(contract);
      await withdraw(contract, 'user1');

      // Don't advance time
      const provider = contract.runner.provider;
      const ownerSigner = getSigner('deployer', provider);
      await expect(contract.connect(ownerSigner).clear()).rejects.toThrow();
    });

    it('should not allow clear before event ends', async () => {
      const contract = await deployContract();
      await register(contract, '@alice', 'user1');

      const provider = contract.runner.provider;
      const ownerSigner = getSigner('deployer', provider);
      await expect(contract.connect(ownerSigner).clear()).rejects.toThrow();
    });

    it('should not allow clear by non-owner', async () => {
      const contract = await deployContract({ coolingPeriod: 10 });
      await register(contract, '@alice', 'user1');
      await attend(contract, getAddress('user1'));
      await payback(contract);
      await advanceTime(contract, 15);

      const provider = contract.runner.provider;
      const nonOwnerSigner = getSigner('user1', provider);
      await expect(contract.connect(nonOwnerSigner).clear()).rejects.toThrow();
    });
  });
});
