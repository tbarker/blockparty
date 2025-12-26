/**
 * User Journey Integration Tests
 *
 * These tests verify the complete user flows against a real Anvil blockchain:
 * - Register for an event
 * - Attend the event
 * - Withdraw deposit after payback
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
  withdraw,
  cancel,
  getContractState,
  getParticipant,
  getAddress,
  getSigner,
  getBalance,
  isAnvilRunning,
  resetAnvil,
  DEFAULT_DEPOSIT,
  createProvider,
} = require('./anvilSetup');

describe('User Journey Integration Tests', () => {
  // Check if Anvil is running before all tests
  beforeAll(async () => {
    const running = await isAnvilRunning();
    if (!running) {
      throw new Error(
        'Anvil is not running. Start it with: npm run anvil\n' +
          'Then run tests with: npm run test:integration'
      );
    }
  });

  describe('Registration Flow', () => {
    let contract;

    beforeEach(async () => {
      // Reset Anvil to clean state before each test to avoid nonce issues
      await resetAnvil();
      contract = await deployContract();
    });

    it('should allow a user to register for an event', async () => {
      // Register user1
      await register(contract, '@alice', 'user1');

      // Verify registration
      const state = await getContractState(contract);
      expect(state.registered).toBe(1);

      // Verify participant data
      const participant = await getParticipant(contract, getAddress('user1'));
      expect(participant.participantName).toBe('@alice');
      expect(participant.addr).toBe(getAddress('user1'));
      expect(participant.attended).toBe(false);
      expect(participant.paid).toBe(false);
    });

    it('should allow multiple users to register', async () => {
      await register(contract, '@alice', 'user1');
      await register(contract, '@bob', 'user2');
      await register(contract, '@charlie', 'user3');

      const state = await getContractState(contract);
      expect(state.registered).toBe(3);

      // Verify contract balance equals 3 deposits
      const expectedBalance = DEFAULT_DEPOSIT * 3n;
      expect(state.totalBalance).toBe(expectedBalance);
    });

    it('should track isRegistered correctly', async () => {
      // Before registration
      const beforeRegistered = await contract.isRegistered(getAddress('user1'));
      expect(beforeRegistered).toBe(false);

      // After registration
      await register(contract, '@alice', 'user1');
      const afterRegistered = await contract.isRegistered(getAddress('user1'));
      expect(afterRegistered).toBe(true);

      // Unregistered user
      const otherRegistered = await contract.isRegistered(getAddress('user2'));
      expect(otherRegistered).toBe(false);
    });
  });

  describe('Complete User Journey: Register → Attend → Withdraw', () => {
    let contract;

    beforeEach(async () => {
      // Reset Anvil to clean state before each test to avoid nonce issues
      await resetAnvil();
      contract = await deployContract();
    });

    it('should complete full journey for a single attendee', async () => {
      const user1Address = getAddress('user1');

      // Step 1: Register
      await register(contract, '@alice', 'user1');

      // Step 2: Owner marks attendance
      await attend(contract, user1Address);

      // Verify attendance
      const participant = await getParticipant(contract, user1Address);
      expect(participant.attended).toBe(true);

      // Step 3: Owner triggers payback
      await payback(contract);

      // Verify event ended
      const stateAfterPayback = await getContractState(contract);
      expect(stateAfterPayback.ended).toBe(true);
      expect(stateAfterPayback.attended).toBe(1);

      // Payout should be full deposit (only attendee)
      expect(stateAfterPayback.payoutAmount).toBe(DEFAULT_DEPOSIT);

      // Step 4: User withdraws
      await withdraw(contract, 'user1');

      // Verify paid status
      const participantAfterWithdraw = await getParticipant(contract, user1Address);
      expect(participantAfterWithdraw.paid).toBe(true);

      // Verify contract balance is now zero
      const finalState = await getContractState(contract);
      expect(finalState.totalBalance).toBe(0n);
    });

    it('should split payout among multiple attendees', async () => {
      // Register 4 users
      await register(contract, '@alice', 'user1');
      await register(contract, '@bob', 'user2');
      await register(contract, '@charlie', 'user3');
      await register(contract, '@dave', 'user4');

      // Only 2 attend
      await attend(contract, [getAddress('user1'), getAddress('user2')]);

      // Trigger payback
      await payback(contract);

      // Payout should be total balance / attended = (4 * 0.02) / 2 = 0.04 ETH each
      const state = await getContractState(contract);
      const expectedPayout = (DEFAULT_DEPOSIT * 4n) / 2n;
      expect(state.payoutAmount).toBe(expectedPayout);

      // Both attendees can withdraw
      await withdraw(contract, 'user1');
      await withdraw(contract, 'user2');

      // Verify both are paid
      const p1 = await getParticipant(contract, getAddress('user1'));
      const p2 = await getParticipant(contract, getAddress('user2'));
      expect(p1.paid).toBe(true);
      expect(p2.paid).toBe(true);

      // Contract should be empty
      const finalState = await getContractState(contract);
      expect(finalState.totalBalance).toBe(0n);
    });

    it('should not allow non-attendees to withdraw after payback', async () => {
      // Register 2 users
      await register(contract, '@alice', 'user1');
      await register(contract, '@bob', 'user2');

      // Only user1 attends
      await attend(contract, getAddress('user1'));
      await payback(contract);

      // user2 should not be able to withdraw
      await expect(withdraw(contract, 'user2')).rejects.toThrow();

      // user1 can withdraw
      await withdraw(contract, 'user1');
      const p1 = await getParticipant(contract, getAddress('user1'));
      expect(p1.paid).toBe(true);
    });
  });

  describe('Cancel Flow', () => {
    let contract;

    beforeEach(async () => {
      // Reset Anvil to clean state before each test to avoid nonce issues
      await resetAnvil();
      contract = await deployContract();
    });

    it('should allow all registered users to withdraw after cancel', async () => {
      // Register users
      await register(contract, '@alice', 'user1');
      await register(contract, '@bob', 'user2');

      // Cancel event
      await cancel(contract);

      // Verify cancelled state
      const state = await getContractState(contract);
      expect(state.cancelled).toBe(true);
      expect(state.ended).toBe(true);
      expect(state.payoutAmount).toBe(DEFAULT_DEPOSIT);

      // Both users can withdraw their full deposit
      await withdraw(contract, 'user1');
      await withdraw(contract, 'user2');

      const p1 = await getParticipant(contract, getAddress('user1'));
      const p2 = await getParticipant(contract, getAddress('user2'));
      expect(p1.paid).toBe(true);
      expect(p2.paid).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    beforeEach(async () => {
      // Reset Anvil to clean state before each test to avoid nonce issues
      await resetAnvil();
    });

    it('should handle event with maximum participants', async () => {
      // Deploy with limit of 3
      const contract = await deployContract({ limitOfParticipants: 3 });

      // Register 3 users
      await register(contract, '@alice', 'user1');
      await register(contract, '@bob', 'user2');
      await register(contract, '@charlie', 'user3');

      // 4th user should fail
      await expect(register(contract, '@dave', 'user4')).rejects.toThrow();

      const state = await getContractState(contract);
      expect(state.registered).toBe(3);
      expect(state.limitOfParticipants).toBe(3);
    });

    it('should handle 100% no-show scenario', async () => {
      const contract = await deployContract();

      // Register users
      await register(contract, '@alice', 'user1');
      await register(contract, '@bob', 'user2');

      // No one attends, cancel the event
      await cancel(contract);

      // All can withdraw
      await withdraw(contract, 'user1');
      await withdraw(contract, 'user2');

      const state = await getContractState(contract);
      expect(state.totalBalance).toBe(0n);
    });

    it('should handle 100% attendance scenario', async () => {
      const contract = await deployContract();

      // Register users
      await register(contract, '@alice', 'user1');
      await register(contract, '@bob', 'user2');

      // Everyone attends
      await attend(contract, [getAddress('user1'), getAddress('user2')]);
      await payback(contract);

      // Payout equals deposit (no bonus since everyone attended)
      const state = await getContractState(contract);
      expect(state.payoutAmount).toBe(DEFAULT_DEPOSIT);

      // All can withdraw
      await withdraw(contract, 'user1');
      await withdraw(contract, 'user2');
    });
  });
});
