/**
 * Create Event Integration Tests
 *
 * These tests verify that events can be created via the ConferenceFactory:
 * - Anyone can create an event
 * - Creator becomes the owner
 * - Event parameters are set correctly
 * - Metadata URI is stored correctly
 *
 * Prerequisites:
 *   - Anvil running: npm run anvil
 *   - Contract artifacts built: npm run forge:build
 */

const { ethers } = require('ethers');
const path = require('path');
const fs = require('fs');

// Load contract artifacts (resolve to absolute path from project root)
// __dirname is src/__tests__/integration, so we go up 3 levels to reach project root
const projectRoot = path.resolve(__dirname, '../../..');
const factoryArtifactPath = path.join(
  projectRoot,
  'out/ConferenceFactory.sol/ConferenceFactory.json'
);
const conferenceUpgradeableArtifactPath = path.join(
  projectRoot,
  'out/ConferenceUpgradeable.sol/ConferenceUpgradeable.json'
);

const FactoryArtifact = JSON.parse(fs.readFileSync(factoryArtifactPath, 'utf8'));
const ConferenceUpgradeableArtifact = JSON.parse(
  fs.readFileSync(conferenceUpgradeableArtifactPath, 'utf8')
);

// Anvil default test accounts
const ANVIL_ACCOUNTS = {
  deployer: '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
  user1: '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d',
  user2: '0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a',
};

const ANVIL_URL = 'http://127.0.0.1:8545';

// Import anvil utilities
const { ensureAnvilRunning, stopAnvil, resetAnvil } = require('./anvilSetup');

// Test context - recreated for each test
let testContext = null;

/**
 * Create fresh test context with new provider, signers, and deployed factory
 */
async function createTestContext() {
  // Create a fresh provider with caching disabled
  const provider = new ethers.JsonRpcProvider(ANVIL_URL, undefined, {
    cacheTimeout: -1,
    pollingInterval: 100,
  });

  // Create fresh signers
  const deployer = new ethers.Wallet(ANVIL_ACCOUNTS.deployer, provider);
  const user1 = new ethers.Wallet(ANVIL_ACCOUNTS.user1, provider);
  const user2 = new ethers.Wallet(ANVIL_ACCOUNTS.user2, provider);

  // Deploy the factory
  const factoryFactory = new ethers.ContractFactory(
    FactoryArtifact.abi,
    FactoryArtifact.bytecode.object,
    deployer
  );
  const factory = await factoryFactory.deploy(deployer.address);
  await factory.waitForDeployment();

  return {
    provider,
    deployer,
    user1,
    user2,
    factory,
  };
}

describe('Create Event Integration Tests', () => {
  let weStartedAnvil = false;

  // Ensure Anvil is running before all tests
  beforeAll(async () => {
    weStartedAnvil = await ensureAnvilRunning();
  });

  // Clean up Anvil if we started it
  afterAll(() => {
    if (weStartedAnvil) {
      stopAnvil();
    }
  });

  // Reset Anvil and create fresh context before each test
  beforeEach(async () => {
    await resetAnvil();
    testContext = await createTestContext();
  });

  describe('Factory Deployment', () => {
    it('should deploy factory successfully', async () => {
      const { factory } = testContext;
      const factoryAddress = await factory.getAddress();
      expect(factoryAddress).toMatch(/^0x[a-fA-F0-9]{40}$/);
    });

    it('should have zero conferences initially', async () => {
      const { factory } = testContext;
      const count = await factory.conferenceCount();
      expect(count).toBe(0n);
    });
  });

  describe('Event Creation', () => {
    it('should allow anyone to create an event', async () => {
      const { factory, user1 } = testContext;

      const tx = await factory.connect(user1).createConference(
        'Test Event',
        ethers.parseEther('0.02'),
        20,
        604800, // 1 week
        ''
      );
      const receipt = await tx.wait();

      expect(receipt.status).toBe(1);

      const count = await factory.conferenceCount();
      expect(count).toBe(1n);
    });

    it('should set creator as owner of new event', async () => {
      const { factory, user1, provider } = testContext;

      const tx = await factory
        .connect(user1)
        .createConference('Test Event', ethers.parseEther('0.02'), 20, 604800, '');
      await tx.wait();

      const conferenceAddress = await factory.conferences(0);
      const conference = new ethers.Contract(
        conferenceAddress,
        ConferenceUpgradeableArtifact.abi,
        provider
      );

      const owner = await conference.owner();
      expect(owner).toBe(await user1.getAddress());
    });

    it('should set event parameters correctly', async () => {
      const { factory, user1, provider } = testContext;

      const tx = await factory.connect(user1).createConference(
        'My Conference',
        ethers.parseEther('0.05'),
        50,
        1209600, // 2 weeks
        'ar://testMetadata'
      );
      await tx.wait();

      const conferenceAddress = await factory.conferences(0);
      const conference = new ethers.Contract(
        conferenceAddress,
        ConferenceUpgradeableArtifact.abi,
        provider
      );

      const name = await conference.name();
      const deposit = await conference.deposit();
      const limit = await conference.limitOfParticipants();
      const metadataUri = await conference.metadataUri();

      expect(name).toBe('My Conference');
      expect(deposit).toBe(ethers.parseEther('0.05'));
      expect(limit).toBe(50n);
      expect(metadataUri).toBe('ar://testMetadata');
    });

    it('should emit ConferenceCreated event', async () => {
      const { factory, user1 } = testContext;

      const tx = await factory
        .connect(user1)
        .createConference('Event With Event', ethers.parseEther('0.02'), 20, 604800, '');
      const receipt = await tx.wait();

      // Find the ConferenceCreated event
      const event = receipt.logs.find(log => {
        try {
          const parsed = factory.interface.parseLog({ topics: log.topics, data: log.data });
          return parsed && parsed.name === 'ConferenceCreated';
        } catch {
          return false;
        }
      });

      expect(event).toBeDefined();

      const parsed = factory.interface.parseLog({ topics: event.topics, data: event.data });
      expect(parsed.args.owner).toBe(await user1.getAddress());
      expect(parsed.args.name).toBe('Event With Event');
    });

    it('should store conference address in factory', async () => {
      const { factory, user1, user2, provider } = testContext;

      const tx1 = await factory
        .connect(user1)
        .createConference('First Event', ethers.parseEther('0.02'), 20, 604800, '');
      await tx1.wait();

      const tx2 = await factory
        .connect(user2)
        .createConference('Second Event', ethers.parseEther('0.03'), 30, 1209600, '');
      await tx2.wait();

      const conferences = await factory.getAllConferences();
      expect(conferences.length).toBe(2);

      // Verify each conference exists
      const conf1 = new ethers.Contract(
        conferences[0],
        ConferenceUpgradeableArtifact.abi,
        provider
      );
      const conf2 = new ethers.Contract(
        conferences[1],
        ConferenceUpgradeableArtifact.abi,
        provider
      );

      expect(await conf1.name()).toBe('First Event');
      expect(await conf2.name()).toBe('Second Event');
    });
  });

  describe('Event Functionality After Creation', () => {
    it('should allow registration on created event', async () => {
      const { factory, user1, user2, provider } = testContext;

      // Create event
      const tx = await factory
        .connect(user1)
        .createConference(
          'Functional Event',
          ethers.parseEther('0.02'),
          20,
          604800,
          'ar://initialMetadata'
        );
      await tx.wait();

      const conferenceAddress = await factory.conferences(0);
      const conference = new ethers.Contract(
        conferenceAddress,
        ConferenceUpgradeableArtifact.abi,
        provider
      );

      // Register
      const regTx = await conference
        .connect(user2)
        .register('Alice', { value: ethers.parseEther('0.02') });
      await regTx.wait();

      const registered = await conference.registered();
      expect(registered).toBe(1n);
    });

    it('should allow owner to update metadata', async () => {
      const { factory, user1, provider } = testContext;

      // Create event
      const tx = await factory
        .connect(user1)
        .createConference(
          'Metadata Event',
          ethers.parseEther('0.02'),
          20,
          604800,
          'ar://initialMetadata'
        );
      await tx.wait();

      const conferenceAddress = await factory.conferences(0);
      const conference = new ethers.Contract(
        conferenceAddress,
        ConferenceUpgradeableArtifact.abi,
        provider
      );

      // Update metadata
      const updateTx = await conference.connect(user1).setMetadataUri('ar://updatedMetadata');
      await updateTx.wait();

      const uri = await conference.metadataUri();
      expect(uri).toBe('ar://updatedMetadata');
    });

    it('should allow owner to grant admin', async () => {
      const { factory, user1, user2, provider } = testContext;

      // Create event
      const tx = await factory
        .connect(user1)
        .createConference('Admin Event', ethers.parseEther('0.02'), 20, 604800, '');
      await tx.wait();

      const conferenceAddress = await factory.conferences(0);
      const conference = new ethers.Contract(
        conferenceAddress,
        ConferenceUpgradeableArtifact.abi,
        provider
      );

      // Grant admin (grant takes an array of addresses)
      const grantTx = await conference.connect(user1).grant([await user2.getAddress()]);
      await grantTx.wait();

      const isAdmin = await conference.isAdmin(await user2.getAddress());
      expect(isAdmin).toBe(true);
    });

    it('should allow granted admin to update metadata', async () => {
      const { factory, user1, user2, provider } = testContext;

      // Create event
      const tx = await factory
        .connect(user1)
        .createConference(
          'Admin Metadata Event',
          ethers.parseEther('0.02'),
          20,
          604800,
          'ar://initial'
        );
      await tx.wait();

      const conferenceAddress = await factory.conferences(0);
      const conference = new ethers.Contract(
        conferenceAddress,
        ConferenceUpgradeableArtifact.abi,
        provider
      );

      // Grant admin to user2
      const grantTx = await conference.connect(user1).grant([await user2.getAddress()]);
      await grantTx.wait();

      // Admin updates metadata
      const updateTx = await conference.connect(user2).setMetadataUri('ar://adminUpdated');
      await updateTx.wait();

      const uri = await conference.metadataUri();
      expect(uri).toBe('ar://adminUpdated');
    });
  });

  describe('Deterministic Event Creation', () => {
    it('should create event at predictable address with salt', async () => {
      const { factory, user1 } = testContext;

      const salt = ethers.id('unique-salt-value');

      const tx = await factory
        .connect(user1)
        .createConferenceDeterministic(
          'Deterministic Event',
          ethers.parseEther('0.02'),
          20,
          604800,
          '',
          salt
        );
      const receipt = await tx.wait();

      expect(receipt.status).toBe(1);

      // Get the created address from event
      const event = receipt.logs.find(log => {
        try {
          const parsed = factory.interface.parseLog({ topics: log.topics, data: log.data });
          return parsed && parsed.name === 'ConferenceCreated';
        } catch {
          return false;
        }
      });

      expect(event).toBeDefined();
      const parsed = factory.interface.parseLog({ topics: event.topics, data: event.data });
      expect(parsed.args.conferenceProxy).toMatch(/^0x[a-fA-F0-9]{40}$/);
    });
  });

  describe('Edge Cases', () => {
    it('should create event with empty metadata URI', async () => {
      const { factory, user1, provider } = testContext;

      const tx = await factory
        .connect(user1)
        .createConference('No Metadata Event', ethers.parseEther('0.01'), 10, 86400, '');
      await tx.wait();

      const conferenceAddress = await factory.conferences(0);
      const conference = new ethers.Contract(
        conferenceAddress,
        ConferenceUpgradeableArtifact.abi,
        provider
      );

      const uri = await conference.metadataUri();
      expect(uri).toBe('');
    });

    it('should create event with very long metadata URI', async () => {
      const { factory, user1, provider } = testContext;

      const longUri = 'ar://' + 'a'.repeat(200);

      const tx = await factory
        .connect(user1)
        .createConference('Long URI Event', ethers.parseEther('0.02'), 20, 604800, longUri);
      await tx.wait();

      const conferenceAddress = await factory.conferences(0);
      const conference = new ethers.Contract(
        conferenceAddress,
        ConferenceUpgradeableArtifact.abi,
        provider
      );

      const uri = await conference.metadataUri();
      expect(uri).toBe(longUri);
    });

    it('should create multiple events from same creator', async () => {
      const { factory, user1, provider } = testContext;

      const tx1 = await factory
        .connect(user1)
        .createConference('Event 1', ethers.parseEther('0.01'), 10, 86400, '');
      await tx1.wait();

      const tx2 = await factory
        .connect(user1)
        .createConference('Event 2', ethers.parseEther('0.02'), 20, 604800, '');
      await tx2.wait();

      const tx3 = await factory
        .connect(user1)
        .createConference('Event 3', ethers.parseEther('0.03'), 30, 1209600, '');
      await tx3.wait();

      const count = await factory.conferenceCount();
      expect(count).toBe(3n);

      // All should be owned by user1
      for (let i = 0; i < 3; i++) {
        const addr = await factory.conferences(i);
        const conf = new ethers.Contract(addr, ConferenceUpgradeableArtifact.abi, provider);
        const owner = await conf.owner();
        expect(owner).toBe(await user1.getAddress());
      }
    });
  });
});
