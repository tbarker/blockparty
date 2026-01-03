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
 * Dismiss the welcome/instruction modal if it appears
 */
export async function dismissWelcomeModal(page: any): Promise<void> {
  // The instruction modal has title "Welcome to BlockParty" and an "Ok" button
  const okButton = page.locator('button:has-text("Ok")');
  if (await okButton.isVisible({ timeout: 6000 }).catch(() => false)) {
    await okButton.click();
    await page.waitForTimeout(1000); // Wait for modal to close
  }
}

/**
 * Wait for app to fully load
 */
export async function waitForAppLoad(page: any): Promise<void> {
  // Wait for network to be idle (all resources loaded)
  await page.waitForLoadState('networkidle');

  // First dismiss the welcome modal if it appears
  await dismissWelcomeModal(page);

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

  await page.waitForSelector('h4:has-text("Event Info")', { timeout: 60000 });
  await page.waitForTimeout(4000);
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
  // Wait for page to start loading and potentially trigger connection
  await page.waitForTimeout(4000);

  // Try to connect to dapp - MetaMask may show a popup automatically
  // The connectToDapp method handles finding and clicking through the MetaMask UI
  try {
    await metamask.connectToDapp();
    await page.waitForTimeout(2000);
  } catch (e) {
    // Connection may have already been approved or no popup appeared
    console.log('First connectToDapp attempt:', (e as Error).message);
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
      await page.waitForTimeout(2000);
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
    await page.waitForTimeout(2000);

    try {
      await metamask.connectToDapp();
    } catch (e) {
      // Connection may have already been approved
    }
    await page.waitForTimeout(2000);
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
