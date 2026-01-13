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
  // Reduced from 30s to 5s - on Anvil, MetaMask popups appear in <2s
  const timeout = options?.timeout || 5000;

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
 * The modal renders via requestAnimationFrame after React mounts, which can be delayed in CI.
 */
export async function dismissWelcomeModal(page: any): Promise<void> {
  // Retry multiple times - modal may appear after a delay in CI environments
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      // The MuiDialog modal contains "Welcome to BlockParty" title and an "Ok" button
      const modalDialog = page.locator('.MuiDialog-root');
      const okButton = page.locator('.MuiDialog-root button:has-text("Ok")');

      // Wait for modal to potentially appear (can be delayed via requestAnimationFrame)
      const isModalVisible = await modalDialog.isVisible({ timeout: 2000 }).catch(() => false);

      if (isModalVisible) {
        // Wait for the Ok button to be clickable and click it
        await okButton.waitFor({ state: 'visible', timeout: 5000 });
        // Use force:true to click even if something is in front (modal backdrop edge cases)
        await okButton.click({ force: true });

        // Wait for modal to fully close
        await modalDialog.waitFor({ state: 'hidden', timeout: 5000 });
        return; // Successfully dismissed
      }
    } catch {
      // Modal may have already closed or page state changed - try again
    }
    // Small delay before retry
    await page.waitForTimeout(500);
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
  await dismissWelcomeModal(page);

  // Wait for Event Info header
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
 * Connect MetaMask to dapp - handles RainbowKit ConnectButton flow
 * With RainbowKit, clicking the Connect button opens a modal where user selects a wallet.
 * For MetaMask, this triggers a MetaMask notification popup.
 */
export async function connectWalletIfNeeded(
  page: any,
  metamask: MetaMask,
  context: any
): Promise<any> {
  // First, dismiss any welcome/instruction modal that might be blocking
  await dismissWelcomeModal(page);

  // Check if already connected - RainbowKit shows account address when connected
  const isAlreadyConnected = await page
    .locator('[data-testid="rk-account-button"], button:has-text("0x")')
    .isVisible({ timeout: 3000 })
    .catch(() => false);

  if (isAlreadyConnected) {
    console.log('Wallet already connected');
    return await getAppPage(context);
  }

  // Look for RainbowKit Connect Wallet button
  const rainbowKitConnectButton = page.locator('button:has-text("Connect Wallet")');

  // Wait for the button to be visible (may take time after modal dismissal)
  await rainbowKitConnectButton.waitFor({ state: 'visible', timeout: 10000 }).catch(() => {
    console.log('Connect Wallet button not found');
  });

  const isRainbowKitButtonVisible = await rainbowKitConnectButton.isVisible().catch(() => false);

  if (isRainbowKitButtonVisible) {
    console.log('Clicking RainbowKit Connect Wallet button');
    await rainbowKitConnectButton.click();

    // Wait for RainbowKit modal to appear
    await page.waitForTimeout(500);

    // Look for MetaMask option in the RainbowKit modal and click it
    const metamaskOption = page.locator('button:has-text("MetaMask"), [data-testid="rk-wallet-option-metaMask"]');
    const isMetaMaskOptionVisible = await metamaskOption
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    if (isMetaMaskOptionVisible) {
      console.log('Clicking MetaMask option in RainbowKit modal');
      await metamaskOption.first().click();
    }

    // Wait for MetaMask notification popup to appear
    try {
      await context.waitForEvent('page', {
        predicate: (p: any) => p.url().includes('notification.html'),
        timeout: 10000,
      });
    } catch {
      // Popup might already exist
    }

    // Approve the connection in MetaMask
    try {
      await metamask.connectToDapp();
      console.log('MetaMask connection approved');
    } catch (e) {
      console.log('connectToDapp attempt:', (e as Error).message);
    }
  } else {
    // Fallback: Check for MetaMask notification popup (auto-connection scenarios)
    try {
      await context.waitForEvent('page', {
        predicate: (p: any) => p.url().includes('notification.html'),
        timeout: 5000,
      });
      await metamask.connectToDapp();
    } catch {
      // No popup appeared
    }
  }

  // Return the app page (in case focus shifted during connection)
  const appPage = await getAppPage(context);
  await appPage.bringToFront();

  // Wait a moment for the UI to update after connection
  await appPage.waitForTimeout(1000);

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
 * MetaMask names match the wallet-setup: "Account 1" (default), "User2", "Admin3", etc.
 */
export const ALL_ANVIL_ACCOUNTS = [
  { address: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266', privateKey: '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80', metamaskName: 'Account 1' },
  { address: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8', privateKey: '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d', metamaskName: 'User2' },
  { address: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC', privateKey: '0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a', metamaskName: 'Admin3' },
  { address: '0x90F79bf6EB2c4f870365E785982E1f101E93b906', privateKey: '0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6', metamaskName: 'User4' },
  { address: '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65', privateKey: '0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a', metamaskName: 'Admin5' },
  { address: '0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc', privateKey: '0x8b3a350cf5c34c9194ca85829a2df0ec3153be0318b5e2d3348e872092edffba', metamaskName: 'User6' },
  { address: '0x976EA74026E726554dB657fA54763abd0C3a0aa9', privateKey: '0x92db14e403b83dfe3df233f83dfa3a0d7096f21ca9b0d6d6b8d88b2b4ec1564e', metamaskName: 'Admin7' },
  { address: '0x14dC79964da2C08b23698B3D3cc7Ca32193d9955', privateKey: '0x4bbbf85ce3377467afe5d46f804f221813b2bb87f24d81f60f1fcdbf7cbf4356', metamaskName: 'User8' },
  { address: '0x23618e81E3f5cdF7f54C3d65f7FBc0aBf5B21E8f', privateKey: '0xdbda1821b80551c9d65939329250298aa3472ba22feea921c0cf5d620ea67b97', metamaskName: 'Admin9' },
  { address: '0xa0Ee7A142d267C1f36714E4a8F75612F20a79720', privateKey: '0x2a871d0798f97d79848a013d4936a73bf4cc922c825d33c1cf7073dff6d409c6', metamaskName: 'User10' },
] as const;

/**
 * Get accounts for a test based on its parallel worker index.
 * Each worker gets a dedicated pair of accounts to prevent nonce conflicts.
 *
 * With 4 workers and 10 accounts:
 * - Worker 0: accounts 0,1 (Account 1, User2)
 * - Worker 1: accounts 2,3 (Admin3, User4)
 * - Worker 2: accounts 4,5 (Admin5, User6)
 * - Worker 3: accounts 6,7 (Admin7, User8)
 *
 * This ensures no two workers can use the same account simultaneously,
 * preventing nonce conflicts when deploying contracts in parallel.
 *
 * @param parallelIndex - The worker index from test.info().parallelIndex
 * @returns Object with admin and user accounts for this worker
 */
export function getWorkerAccounts(parallelIndex: number) {
  // With 4 workers and 10 accounts, each worker gets 2 dedicated accounts
  // Use modulo to handle cases with more workers than pairs
  const pairIndex = parallelIndex % 5;
  const adminIndex = pairIndex * 2;
  const userIndex = pairIndex * 2 + 1;

  return {
    admin: ALL_ANVIL_ACCOUNTS[adminIndex],
    user: ALL_ANVIL_ACCOUNTS[userIndex],
    // deployer is same as admin for most tests
    deployer: ALL_ANVIL_ACCOUNTS[adminIndex],
  };
}

/**
 * Suite-specific account assignments for parallel test execution.
 * Each suite gets dedicated accounts to avoid nonce conflicts when running in parallel.
 *
 * NOTE: With fullyParallel: true, tests may run on any worker with any MetaMask instance.
 * Each worker has its own MetaMask, so the same account names can be used safely.
 * These assignments provide consistent defaults for tests that use them.
 */
export const SUITE_ACCOUNTS = {
  createEvent: {
    deployer: ALL_ANVIL_ACCOUNTS[0], // Account 1
  },
  registration: {
    deployer: ALL_ANVIL_ACCOUNTS[2], // Admin3
    user: ALL_ANVIL_ACCOUNTS[3],     // User4
  },
  attendance: {
    admin: ALL_ANVIL_ACCOUNTS[4],    // Admin5
    user: ALL_ANVIL_ACCOUNTS[5],     // User6
  },
  withdrawal: {
    admin: ALL_ANVIL_ACCOUNTS[6],    // Admin7
    user: ALL_ANVIL_ACCOUNTS[7],     // User8
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
