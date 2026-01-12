/**
 * Synpress Test Fixtures for BlockParty E2E Tests
 *
 * Uses real MetaMask extension for wallet interactions.
 * Transactions are sent to a local Anvil instance for true E2E testing.
 */

import { testWithSynpress } from '@synthetixio/synpress';
import { MetaMask, metaMaskFixtures } from '@synthetixio/synpress/playwright';
import basicSetup from './wallet-setup/basic.setup.js';
import * as fs from 'fs';
import * as path from 'path';

// Load E2E state (contract addresses, etc.) from global setup
const STATE_FILE = path.join(__dirname, '.e2e-state.json');
function loadE2EState(): {
  contractAddress: string;
  factoryAddress: string;
  chainId: number;
  anvilUrl: string;
} {
  try {
    const data = fs.readFileSync(STATE_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (e) {
    console.warn('Could not load E2E state file:', e);
    return {
      contractAddress: '',
      factoryAddress: '',
      chainId: 1337,
      anvilUrl: 'http://127.0.0.1:8545',
    };
  }
}

export const E2E_STATE = loadE2EState();

// Create test instance with Synpress MetaMask fixtures
export const test = testWithSynpress(metaMaskFixtures(basicSetup));
export const { expect } = test;

// Re-export wallet password for creating MetaMask instances
export const WALLET_PASSWORD = basicSetup.walletPassword;

/**
 * Anvil test accounts (from seed phrase: "test test test test test test test test test test test junk")
 */
export const TEST_ACCOUNTS = {
  deployer: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
  user1: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
  user2: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
  user3: '0x90F79bf6EB2c4f870365E785982E1f101E93b906',
};

/**
 * Create a MetaMask instance for test interactions
 */
export function createMetaMask(context: any, metamaskPage: any, extensionId: string): MetaMask {
  return new MetaMask(context as any, metamaskPage as any, WALLET_PASSWORD, extensionId);
}

/**
 * Wait for transaction success notification in the UI
 */
export async function waitForTransactionSuccess(page: any, timeout = 120000): Promise<void> {
  const alertLocator = page.locator('[role="alert"]').first();
  await expect(alertLocator).toBeVisible({ timeout });

  const alertText = await alertLocator.textContent();
  if (alertText && alertText.toLowerCase().includes('error')) {
    throw new Error(`Transaction failed: ${alertText}`);
  }
}

/**
 * Wait for MetaMask notification popup and confirm the transaction.
 * Replaces the common pattern: waitForTimeout(2000) + confirmTransaction()
 */
export async function waitForMetaMaskAndConfirm(
  metamask: MetaMask,
  context: any,
  options?: { timeout?: number }
): Promise<void> {
  const timeout = options?.timeout || 30000;

  // Wait for a MetaMask notification page to appear
  // Synpress's confirmTransaction() has internal retries, but we want to ensure
  // the dApp has initiated the transaction first
  try {
    await context.waitForEvent('page', {
      predicate: (p: any) => p.url().includes('notification.html'),
      timeout: timeout,
    });
  } catch {
    // Page might already exist or transaction already initiated, continue
  }

  await metamask.confirmTransaction();
}

/**
 * Wait for UI to reflect transaction completion.
 * Waits for success notification and optional expected element.
 */
export async function waitForTransactionComplete(
  page: any,
  options?: {
    timeout?: number;
    expectElement?: string;
  }
): Promise<void> {
  const timeout = options?.timeout || 120000;

  // Wait for success notification
  await waitForTransactionSuccess(page, timeout);

  // If specific element expected, wait for it
  if (options?.expectElement) {
    await page
      .locator(options.expectElement)
      .waitFor({ state: 'visible', timeout: 10000 })
      .catch(() => {
        // Element might already be visible or not applicable
      });
  }

  // Wait for any loading indicators to disappear
  await page
    .locator('[role="progressbar"], .MuiCircularProgress-root')
    .waitFor({ state: 'hidden', timeout: 5000 })
    .catch(() => {
      // No loading indicator present
    });
}

/**
 * Inject E2E configuration into the page (contract address, factory address, etc.)
 * This must be called before navigating to the app or via addInitScript
 */
export async function injectE2EConfig(page: any): Promise<void> {
  await page.addInitScript(
    (config: { contractAddress: string; factoryAddress: string; chainId: number }) => {
      (window as any).__E2E_CONFIG__ = config;
    },
    {
      contractAddress: E2E_STATE.contractAddress,
      factoryAddress: E2E_STATE.factoryAddress,
      chainId: E2E_STATE.chainId,
    }
  );
}

/**
 * Inject E2E configuration for factory-only tests (no pre-existing contract).
 * Used for testing the "Create New Event" flow where the app starts without a contract.
 */
export async function injectE2EConfigFactoryOnly(page: any): Promise<void> {
  await page.addInitScript(
    (config: { contractAddress: string; factoryAddress: string; chainId: number }) => {
      (window as any).__E2E_CONFIG__ = config;
    },
    {
      contractAddress: '', // No pre-existing contract
      factoryAddress: E2E_STATE.factoryAddress,
      chainId: E2E_STATE.chainId,
    }
  );
}

/**
 * Dismiss the welcome/instruction modal if it appears.
 * The modal shows on first visit and blocks all interactions until dismissed.
 */
export async function dismissWelcomeModal(page: any): Promise<void> {
  try {
    // The MuiDialog modal contains "Welcome to BlockParty" title and an "Ok" button
    const modalDialog = page.locator('.MuiDialog-root');
    const okButton = page.locator('.MuiDialog-root button:has-text("Ok")');

    // Quick check if modal is present (appears via requestAnimationFrame, should be fast)
    const isModalVisible = await modalDialog.isVisible({ timeout: 1000 }).catch(() => false);

    if (isModalVisible) {
      // Wait for the Ok button to be clickable and click it
      await okButton.waitFor({ state: 'visible', timeout: 3000 });
      await okButton.click();

      // Wait for modal to fully close
      await modalDialog.waitFor({ state: 'hidden', timeout: 3000 });
    }
  } catch {
    // Modal may have already closed or page state changed - continue
  }
}

/**
 * Wait for app to fully load
 */
export async function waitForAppLoad(page: any): Promise<void> {
  // Wait for network to be idle (all resources loaded)
  await page.waitForLoadState('networkidle');

  // Wait for React to render - look for the app container to have content
  await page
    .waitForFunction(
      () => {
        const appDiv = document.getElementById('app');
        return appDiv && appDiv.innerHTML.length > 100;
      },
      { timeout: 60000 }
    )
    .catch(() => {
      // React did not render in time, continue anyway
    });

  // Dismiss the welcome modal if it appears (shows after React mounts via requestAnimationFrame)
  // Call it early in case modal blocks the Event Info header
  await dismissWelcomeModal(page);

  await page.waitForSelector('h4:has-text("Event Info")', { timeout: 60000 });

  // Wait for dynamic content to be populated instead of arbitrary timeout
  // The app is stable when deposit amount (ETH) is displayed
  await page
    .locator('text=/\\d+\\.\\d+.*ETH/i')
    .first()
    .waitFor({ state: 'visible', timeout: 30000 })
    .catch(() => {
      // Content might already be visible or in a different format
    });

  // Final modal check - the modal might have appeared during content loading
  // (e.g., triggered by ConferenceDetail 5-second timeout if data was slow)
  await dismissWelcomeModal(page);
}

/**
 * Check if user can register (twitter input visible)
 */
export async function canUserRegister(page: any): Promise<boolean> {
  const twitterInput = page.locator('input[placeholder*="twitter"]');
  return (await twitterInput.count()) > 0;
}

/**
 * Anvil local network configuration
 */
export const ANVIL_NETWORK = {
  name: 'Anvil',
  rpcUrl: 'http://127.0.0.1:8545',
  chainId: 1337,
  symbol: 'ETH',
};

/**
 * Add Anvil network to MetaMask and switch to it
 */
export async function addAndSwitchToAnvilNetwork(metamask: MetaMask): Promise<void> {
  try {
    // Add the network (this also switches to it)
    await metamask.addNetwork(ANVIL_NETWORK);
  } catch (e) {
    // Network might already exist, try switching to it
    try {
      await metamask.switchNetwork('Anvil', true);
    } catch (switchError) {
      // Could not switch to Anvil - may need debugging
    }
  }
}

/**
 * Find the app page from context (not the MetaMask extension page)
 */
export async function getAppPage(context: any): Promise<any> {
  const pages = context.pages();

  // Find the page that's on localhost:3000 (our app) by checking URL
  for (let i = 0; i < pages.length; i++) {
    const url = pages[i].url();
    if (url.includes('localhost:3000')) {
      return pages[i];
    }
  }

  // If not found, look for about:blank (might be the initial page)
  for (let i = 0; i < pages.length; i++) {
    const url = pages[i].url();
    if (url === 'about:blank') {
      return pages[i];
    }
  }

  // If not found, return the first non-extension page
  for (let i = 0; i < pages.length; i++) {
    const url = pages[i].url();
    if (!url.startsWith('chrome-extension://')) {
      return pages[i];
    }
  }

  return pages[0];
}

/**
 * Setup MetaMask for testing: add network and prepare for dapp connection
 * This should be called before navigating to the app
 * Returns the app page after switching back to it
 */
export async function setupMetaMaskNetwork(metamask: MetaMask, context: any): Promise<any> {
  await addAndSwitchToAnvilNetwork(metamask);
  // Get the app page and bring it to front
  const appPage = await getAppPage(context);
  await appPage.bringToFront();
  return appPage;
}

/**
 * Connect MetaMask to dapp - handles auto-connection popups
 * The BlockParty app auto-requests wallet connection on load,
 * so we need to approve it even without clicking a button
 */
export async function connectWalletIfNeeded(
  page: any,
  metamask: MetaMask,
  context: any
): Promise<any> {
  // Wait for either wallet connected state OR MetaMask notification popup
  // instead of fixed 4000ms wait
  const connectionReady = await Promise.race([
    // Option 1: App shows connected state (combobox with account)
    page
      .locator('[role="combobox"]')
      .waitFor({ state: 'visible', timeout: 10000 })
      .then(() => 'connected'),
    // Option 2: MetaMask notification page appears
    context
      .waitForEvent('page', {
        predicate: (p: any) => p.url().includes('notification.html'),
        timeout: 10000,
      })
      .then(() => 'popup'),
  ]).catch(() => 'timeout');

  // Try to connect to dapp - MetaMask may show a popup automatically
  if (connectionReady !== 'connected') {
    try {
      await metamask.connectToDapp();
    } catch (e) {
      // Connection may have already been approved or no popup appeared
      console.log('First connectToDapp attempt:', (e as Error).message);
    }
  }

  // Check if there's still a MetaMask notification popup
  const pages = context.pages();
  const notificationPage = pages.find((p: any) => {
    const url = p.url();
    return url.includes('notification') || url.includes('connect');
  });

  if (notificationPage) {
    try {
      await metamask.connectToDapp();
    } catch (e) {
      // Connection may have already been approved
      console.log('Second connectToDapp attempt:', (e as Error).message);
    }
  }

  // Check for manual connect button on the app page
  const connectButton = page.locator('button:has-text("Connect")');
  const isConnectVisible = await connectButton.isVisible({ timeout: 3000 }).catch(() => false);

  if (isConnectVisible) {
    await connectButton.click();

    // Wait for MetaMask popup to appear after clicking connect
    try {
      await context.waitForEvent('page', {
        predicate: (p: any) => p.url().includes('notification.html'),
        timeout: 5000,
      });
      await metamask.connectToDapp();
    } catch (e) {
      // Connection may have already been approved
    }
  }

  // Return the app page (in case focus shifted during connection)
  const appPage = await getAppPage(context);
  await appPage.bringToFront();
  return appPage;
}

/**
 * Switch MetaMask to a different account
 */
export async function switchAccount(metamask: MetaMask, accountName: string): Promise<void> {
  await metamask.switchAccount(accountName);
}

/**
 * All Anvil pre-funded accounts (from seed phrase: "test test test test test test test test test test test junk")
 * Each account has 10000 ETH on Anvil.
 */
export const ALL_ANVIL_ACCOUNTS = [
  { address: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266', privateKey: '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80', metamaskName: 'Account 1' },
  { address: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8', privateKey: '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d', metamaskName: 'Account 2' },
  { address: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC', privateKey: '0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a', metamaskName: 'Account 3' },
  { address: '0x90F79bf6EB2c4f870365E785982E1f101E93b906', privateKey: '0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6', metamaskName: 'Account 4' },
  { address: '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65', privateKey: '0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a', metamaskName: 'Account 5' },
  { address: '0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc', privateKey: '0x8b3a350cf5c34c9194ca85829a2df0ec3153be0318b5e2d3348e872092edffba', metamaskName: 'Account 6' },
  { address: '0x976EA74026E726554dB657fA54763abd0C3a0aa9', privateKey: '0x92db14e403b83dfe3df233f83dfa3a0d7096f21ca9b0d6d6b8d88b2b4ec1564e', metamaskName: 'Account 7' },
  { address: '0x14dC79964da2C08b23698B3D3cc7Ca32193d9955', privateKey: '0x4bbbf85ce3377467afe5d46f804f221813b2bb87f24d81f60f1fcdbf7cbf4356', metamaskName: 'Account 8' },
  { address: '0x23618e81E3f5cdF7f54C3d65f7FBc0aBf5B21E8f', privateKey: '0xdbda1821b80551c9d65939329250298aa3472ba22feea921c0cf5d620ea67b97', metamaskName: 'Account 9' },
  { address: '0xa0Ee7A142d267C1f36714E4a8F75612F20a79720', privateKey: '0x2a871d0798f97d79848a013d4936a73bf4cc922c825d33c1cf7073dff6d409c6', metamaskName: 'Account 10' },
] as const;

/**
 * Suite-specific account assignments for test execution.
 * All suites use Account 1 (deployer/admin) and User2 (user).
 * Tests run sequentially (workers: 1) to avoid nonce conflicts.
 */
export const SUITE_ACCOUNTS = {
  createEvent: {
    deployer: { ...ALL_ANVIL_ACCOUNTS[0], metamaskName: 'Account 1' },
  },
  registration: {
    deployer: { ...ALL_ANVIL_ACCOUNTS[0], metamaskName: 'Account 1' },
    user: { ...ALL_ANVIL_ACCOUNTS[1], metamaskName: 'User2' },
  },
  attendance: {
    admin: { ...ALL_ANVIL_ACCOUNTS[0], metamaskName: 'Account 1' },
    user: { ...ALL_ANVIL_ACCOUNTS[1], metamaskName: 'User2' },
  },
  withdrawal: {
    admin: { ...ALL_ANVIL_ACCOUNTS[0], metamaskName: 'Account 1' },
    user: { ...ALL_ANVIL_ACCOUNTS[1], metamaskName: 'User2' },
  },
} as const;

/**
 * Deploy a fresh Conference contract for isolated test suites.
 * This allows each test suite to have its own contract instance.
 *
 * @param options - Contract deployment options
 * @returns The deployed contract address
 */
export async function deployTestEvent(options: {
  name?: string;
  deposit?: string;
  maxParticipants?: number;
  coolingPeriod?: number;
  deployerPrivateKey: string;
}): Promise<string> {
  const {
    name = 'Test Event',
    deposit = '0.02',
    maxParticipants = 20,
    coolingPeriod = 604800,
    deployerPrivateKey,
  } = options;

  // Dynamic import for ethers (ESM module)
  const { ethers } = await import('ethers');

  // Connect to Anvil
  const provider = new ethers.JsonRpcProvider(E2E_STATE.anvilUrl || 'http://127.0.0.1:8545', undefined, {
    cacheTimeout: -1,
  });
  const wallet = new ethers.Wallet(deployerPrivateKey, provider);

  // Load the compiled contract artifact
  const artifactPath = path.join(__dirname, '../../../out/Conference.sol/Conference.json');
  const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf-8'));
  const abi = artifact.abi;
  const bytecode = artifact.bytecode.object;

  // Deploy contract
  const factory = new ethers.ContractFactory(abi, bytecode, wallet);
  const contract = await factory.deploy(
    name,
    ethers.parseEther(deposit),
    maxParticipants,
    coolingPeriod,
    '' // metadataUri
  );

  await contract.waitForDeployment();
  const contractAddress = await contract.getAddress();

  console.log(`[Test Setup] Deployed Conference "${name}" at: ${contractAddress}`);
  return contractAddress;
}

/**
 * Inject E2E configuration with a specific contract address.
 * Used for test suites that deploy their own contracts.
 */
export async function injectE2EConfigWithContract(page: any, contractAddress: string): Promise<void> {
  await page.addInitScript(
    (config: { contractAddress: string; factoryAddress: string; chainId: number }) => {
      (window as any).__E2E_CONFIG__ = config;
    },
    {
      contractAddress,
      factoryAddress: E2E_STATE.factoryAddress,
      chainId: E2E_STATE.chainId,
    }
  );
}
