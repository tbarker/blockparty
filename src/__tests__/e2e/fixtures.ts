/**
 * OnchainTestKit Test Fixtures for BlockParty E2E Tests
 *
 * Provides test fixtures that integrate:
 * - OnchainTestKit for MetaMask or Coinbase Wallet interactions (configurable)
 * - Per-test Anvil instances via LocalNodeManager (enables parallelization)
 * - Contract deployment helpers
 * - App-specific UI helpers
 */

import { test as base, expect } from '@playwright/test';
import { MetaMask, CoinbaseWallet, BaseActionType, ActionApprovalType, setupRpcPortInterceptor } from '@coinbase/onchaintestkit';
import {
  walletConfig,
  WALLET_TYPE,
  ANVIL_ACCOUNTS,
  CHAIN_ID,
  ANVIL_URL,
  ANVIL_PORT,
} from './config';
import { checkAnvilHealth, runDiagnostics, waitForAnvil } from './diagnostics';
import * as fs from 'fs';
import * as path from 'path';

// Unified wallet type that can be either MetaMask or CoinbaseWallet
export type Wallet = MetaMask | CoinbaseWallet;

// Use direct paths to avoid package.json exports resolution issues
/* eslint-disable @typescript-eslint/no-var-requires */
const onchaintkitPath = path.join(process.cwd(), 'node_modules', '@coinbase', 'onchaintestkit', 'dist', 'src');
const { createTempDir } = require(path.join(onchaintkitPath, 'utils', 'createTempDir.js'));
const { removeTempDir } = require(path.join(onchaintkitPath, 'utils', 'removeTempDir.js'));
const { getExtensionId } = require(path.join(onchaintkitPath, 'utils', 'extensionManager.js'));
const { LocalNodeManager } = require(path.join(onchaintkitPath, 'node', 'LocalNodeManager.js'));
/* eslint-enable @typescript-eslint/no-var-requires */

// Re-export for convenience
export { expect, BaseActionType, ActionApprovalType };
export { checkAnvilHealth, runDiagnostics, waitForAnvil } from './diagnostics';
export { ANVIL_ACCOUNTS, CHAIN_ID, ANVIL_URL, ANVIL_PORT, WALLET_TYPE } from './config';

// Shared wallet state across tests in the same worker
let sharedWalletPage: any;
let sharedExtensionId: string;
let networkAlreadyAdded = false;
let currentNetworkPort: number | null = null;

/**
 * Get the Anvil RPC URL from the node fixture.
 * Falls back to default ANVIL_URL if node is not available.
 */
export function getAnvilUrl(node: any): string {
  if (node && typeof node.port === 'number') {
    return `http://localhost:${node.port}`;
  }
  return ANVIL_URL;
}

/**
 * Add Anvil network to MetaMask with MetaMask 12.8.1 compatible selectors.
 *
 * OnchainTestKit's addNetwork function uses #networkName selector which doesn't
 * work reliably with MetaMask 12.8.1. This custom function handles the new UI.
 *
 * OPTIMIZATION: Skips if network was already added with the same port in this worker.
 */
async function addAnvilNetworkMetaMask(walletPage: any, rpcUrl: string = ANVIL_URL): Promise<void> {
  // Extract port from RPC URL
  const portMatch = rpcUrl.match(/:(\d+)$/);
  const port = portMatch ? parseInt(portMatch[1], 10) : ANVIL_PORT;

  // Skip if already added with the same port in this worker session
  if (networkAlreadyAdded && currentNetworkPort === port) {
    console.log('[addAnvilNetworkMetaMask] Network already added, skipping');
    return;
  }

  const networkName = 'Localhost';
  const chainId = CHAIN_ID.toString();
  const symbol = 'ETH';

  console.log(`[addAnvilNetworkMetaMask] Adding network "${networkName}" with RPC URL: ${rpcUrl}`);

  try {
    // Click the network selector dropdown
    await walletPage.locator('[data-testid="network-display"]').click();
    await walletPage.waitForTimeout(200);

    // Check if Localhost network already exists
    const localhostOption = walletPage.locator('button:has-text("Localhost"), [data-testid="Localhost"]').first();
    if (await localhostOption.isVisible({ timeout: 1000 }).catch(() => false)) {
      console.log('[addAnvilNetworkMetaMask] Localhost network already exists, selecting it');
      await localhostOption.click();
      networkAlreadyAdded = true;
      return;
    }

    // Click "Add a custom network" button
    const addNetworkButton = walletPage.getByRole('button', { name: 'Add a custom network' });
    await addNetworkButton.waitFor({ state: 'visible', timeout: 5000 });
    await addNetworkButton.click();
    await walletPage.waitForTimeout(200);

    // Fill network name - try multiple selectors for MetaMask 12.8.1 compatibility
    const networkNameInput = walletPage.locator('input[placeholder="Enter network name"], #networkName, input[name="networkName"]').first();
    await networkNameInput.waitFor({ state: 'visible', timeout: 5000 });
    await networkNameInput.clear();
    await networkNameInput.fill(networkName);

    // Fill chain ID
    const chainIdInput = walletPage.locator('#chainId, input[name="chainId"]').first();
    await chainIdInput.waitFor({ state: 'visible', timeout: 5000 });
    await chainIdInput.clear();
    await chainIdInput.fill(chainId);

    // Fill currency symbol
    const symbolInput = walletPage.locator('#nativeCurrency, input[name="nativeCurrency"]').first();
    await symbolInput.waitFor({ state: 'visible', timeout: 5000 });
    await symbolInput.clear();
    await symbolInput.fill(symbol);

    // Add RPC URL - click the dropdown first
    const rpcDropdown = walletPage.getByLabel('Default RPC URL');
    await rpcDropdown.click();
    await walletPage.waitForTimeout(200);

    // Click "Add RPC URL" button
    const addRpcButton = walletPage.getByRole('button', { name: 'Add RPC URL' });
    await addRpcButton.waitFor({ state: 'visible', timeout: 5000 });
    await addRpcButton.click();
    await walletPage.waitForTimeout(200);

    // Fill RPC URL
    const rpcUrlInput = walletPage.locator('#rpcUrl, input[name="rpcUrl"]').first();
    await rpcUrlInput.waitFor({ state: 'visible', timeout: 5000 });
    await rpcUrlInput.fill(rpcUrl);

    // Fill RPC name
    const rpcNameInput = walletPage.locator('#rpcName, input[name="rpcName"]').first();
    await rpcNameInput.waitFor({ state: 'visible', timeout: 5000 });
    await rpcNameInput.fill(networkName);

    // Click "Add URL" button
    const addUrlButton = walletPage.getByRole('button', { name: 'Add URL' });
    await addUrlButton.waitFor({ state: 'visible', timeout: 5000 });
    await addUrlButton.click();
    await walletPage.waitForTimeout(300);

    // Click "Save" button
    const saveButton = walletPage.getByRole('button', { name: 'Save' });
    await saveButton.waitFor({ state: 'visible', timeout: 5000 });
    // Wait for save button to be enabled (network name must be filled)
    await walletPage.waitForFunction(() => {
      const btn = document.querySelector('button[type="button"]');
      return btn && !btn.hasAttribute('disabled') && btn.textContent?.includes('Save');
    }, { timeout: 5000 }).catch(() => {});
    await saveButton.click();
    await walletPage.waitForTimeout(500);

    // Handle "network added" popup if it appears
    const gotItButton = walletPage.getByRole('button', { name: 'Got it' });
    if (await gotItButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await gotItButton.click();
      await walletPage.waitForTimeout(200);
    }

    // Handle network info popup if it appears
    const dismissButton = walletPage.locator('button:has-text("Dismiss"), button:has-text("Close")').first();
    if (await dismissButton.isVisible({ timeout: 1000 }).catch(() => false)) {
      await dismissButton.click();
    }

    networkAlreadyAdded = true;
    currentNetworkPort = port;
    console.log(`[addAnvilNetworkMetaMask] Network "${networkName}" added successfully`);
  } catch (error) {
    console.error('[addAnvilNetworkMetaMask] Error adding network:', error);
    throw error;
  }
}

/**
 * Add Anvil network to Coinbase Wallet.
 *
 * Coinbase Wallet has a different UI for network management.
 * OPTIMIZATION: Skips if network was already added with the same port in this worker.
 */
async function addAnvilNetworkCoinbase(walletPage: any, rpcUrl: string = ANVIL_URL): Promise<void> {
  // Extract port from RPC URL
  const portMatch = rpcUrl.match(/:(\d+)$/);
  const port = portMatch ? parseInt(portMatch[1], 10) : ANVIL_PORT;

  // Skip if already added with the same port in this worker session
  if (networkAlreadyAdded && currentNetworkPort === port) {
    console.log('[addAnvilNetworkCoinbase] Network already added, skipping');
    return;
  }

  const networkName = 'Localhost';
  const chainId = CHAIN_ID.toString();

  console.log(`[addAnvilNetworkCoinbase] Adding network "${networkName}" with RPC URL: ${rpcUrl}`);

  try {
    // Coinbase Wallet uses Settings > Networks for custom network management
    // Click the settings/menu button
    const settingsButton = walletPage.locator('[data-testid="settings-button"], button[aria-label="Settings"], button:has-text("Settings")').first();
    if (await settingsButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await settingsButton.click();
      await walletPage.waitForTimeout(300);
    }

    // Look for Networks option
    const networksOption = walletPage.locator('button:has-text("Networks"), [data-testid="networks-option"]').first();
    if (await networksOption.isVisible({ timeout: 2000 }).catch(() => false)) {
      await networksOption.click();
      await walletPage.waitForTimeout(300);
    }

    // Check if Localhost network already exists
    const localhostOption = walletPage.locator(`button:has-text("${networkName}"), [data-testid="${networkName}"]`).first();
    if (await localhostOption.isVisible({ timeout: 1000 }).catch(() => false)) {
      console.log('[addAnvilNetworkCoinbase] Localhost network already exists, selecting it');
      await localhostOption.click();
      networkAlreadyAdded = true;
      currentNetworkPort = port;
      return;
    }

    // Click "Add Network" button
    const addNetworkButton = walletPage.locator('button:has-text("Add Network"), button:has-text("Add network")').first();
    if (await addNetworkButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await addNetworkButton.click();
      await walletPage.waitForTimeout(300);
    }

    // Fill network details - Coinbase Wallet UI
    const nameInput = walletPage.locator('input[placeholder*="name"], input[name="name"]').first();
    if (await nameInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await nameInput.fill(networkName);
    }

    const rpcInput = walletPage.locator('input[placeholder*="RPC"], input[name="rpcUrl"]').first();
    if (await rpcInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await rpcInput.fill(rpcUrl);
    }

    const chainIdInput = walletPage.locator('input[placeholder*="Chain"], input[name="chainId"]').first();
    if (await chainIdInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await chainIdInput.fill(chainId);
    }

    const symbolInput = walletPage.locator('input[placeholder*="Symbol"], input[name="symbol"]').first();
    if (await symbolInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await symbolInput.fill('ETH');
    }

    // Save the network
    const saveButton = walletPage.locator('button:has-text("Save"), button:has-text("Add")').first();
    if (await saveButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await saveButton.click();
      await walletPage.waitForTimeout(500);
    }

    networkAlreadyAdded = true;
    currentNetworkPort = port;
    console.log(`[addAnvilNetworkCoinbase] Network "${networkName}" added successfully`);
  } catch (error) {
    console.error('[addAnvilNetworkCoinbase] Error adding network:', error);
    // Don't throw - Coinbase Wallet might handle networks differently
  }
}

/**
 * Switch MetaMask to the Localhost network.
 * OPTIMIZATION: Reduced waits and check if already on correct network.
 */
async function switchToLocalhostNetworkMetaMask(walletPage: any): Promise<void> {
  console.log('[switchToLocalhostNetworkMetaMask] Switching to Localhost network');

  try {
    // Check if already on Localhost network
    const networkDisplay = walletPage.locator('[data-testid="network-display"]');
    const currentNetwork = await networkDisplay.textContent().catch(() => '');
    if (currentNetwork?.includes('Localhost')) {
      console.log('[switchToLocalhostNetworkMetaMask] Already on Localhost network');
      return;
    }

    // Click the network selector dropdown
    await networkDisplay.click();
    await walletPage.waitForTimeout(200);

    // Look for Localhost network in the list
    const localhostOption = walletPage.locator('button:has-text("Localhost"), [data-testid="Localhost"]').first();
    if (await localhostOption.isVisible({ timeout: 2000 }).catch(() => false)) {
      await localhostOption.click();
      console.log('[switchToLocalhostNetworkMetaMask] Switched to Localhost network');
      return;
    }

    // If not found, close the dropdown and the network might already be selected
    await walletPage.keyboard.press('Escape');
    console.log('[switchToLocalhostNetworkMetaMask] Localhost network not found in list, may already be selected');
  } catch (error) {
    console.error('[switchToLocalhostNetworkMetaMask] Error switching network:', error);
    // Don't throw - the network might already be selected
  }
}

/**
 * Add Anvil network to the wallet (MetaMask or Coinbase).
 * Delegates to the appropriate wallet-specific function.
 */
async function addAnvilNetwork(walletPage: any, rpcUrl: string = ANVIL_URL): Promise<void> {
  if (WALLET_TYPE === 'coinbase') {
    await addAnvilNetworkCoinbase(walletPage, rpcUrl);
  } else {
    await addAnvilNetworkMetaMask(walletPage, rpcUrl);
  }
}

/**
 * Switch to the Localhost network in the wallet.
 * Delegates to the appropriate wallet-specific function.
 */
async function switchToLocalhostNetwork(walletPage: any): Promise<void> {
  if (WALLET_TYPE === 'coinbase') {
    // Coinbase Wallet typically switches network as part of addAnvilNetwork
    console.log('[switchToLocalhostNetwork] Coinbase Wallet - network switch handled in addAnvilNetwork');
  } else {
    await switchToLocalhostNetworkMetaMask(walletPage);
  }
}

/**
 * Custom test fixtures for OnchainTestKit with per-test Anvil instances.
 * Uses LocalNodeManager for parallel test execution support.
 * Supports both MetaMask and Coinbase Wallet via WALLET_TYPE env var.
 */
export const test = base.extend<{
  node: any;
  wallet: Wallet | null;
  walletPage: any;
  extensionId: string;
  // Keep metamask for backward compatibility
  metamask: MetaMask | null;
  metamaskPage: any;
}>({
  // Per-test Anvil instance via LocalNodeManager
  node: [async ({}, use) => {
    const nodeConfig = walletConfig.nodeConfig;
    if (nodeConfig) {
      const node = new LocalNodeManager(nodeConfig);
      await node.start();
      console.log(`Node is ready on port ${node.port}`);
      await use(node);
      console.log('Node stopping...');
      await node.stop();
    } else {
      // Fallback: no per-test node, use global Anvil
      await use({ port: ANVIL_PORT, rpcUrl: ANVIL_URL });
    }
  }, { scope: 'test', auto: true }],

  // Create temp directory for extension data
  _contextPath: [async ({}, use, testInfo) => {
    const contextPath = await createTempDir(testInfo.testId);
    await use(contextPath);
    const error = await removeTempDir(contextPath);
    if (error) console.error(error);
  }, { scope: 'test' }],

  // Initialize wallet context with RPC interception for dynamic port
  context: async ({ context: currentContext, _contextPath, node }: any, use: any) => {
    try {
      const port = node?.port || ANVIL_PORT;

      if (WALLET_TYPE === 'coinbase') {
        // Initialize Coinbase Wallet
        const cbConfig = walletConfig.wallets?.coinbase;
        if (!cbConfig) {
          throw new Error('Coinbase config not found in walletConfig');
        }

        const { coinbaseContext, coinbasePage } = await CoinbaseWallet.initialize(
          currentContext,
          _contextPath,
          cbConfig
        );
        sharedWalletPage = coinbasePage;

        // Set up RPC interceptor for the per-test Anvil instance
        await setupRpcPortInterceptor(coinbaseContext, port);

        await use(coinbaseContext);
        await coinbaseContext.close();
      } else {
        // Initialize MetaMask (default)
        const mmConfig = walletConfig.wallets?.metamask;
        if (!mmConfig) {
          throw new Error('MetaMask config not found in walletConfig');
        }

        const { metamaskContext, metamaskPage } = await MetaMask.initialize(
          currentContext,
          _contextPath,
          mmConfig
        );
        sharedWalletPage = metamaskPage;

        // Set up RPC interceptor for the per-test Anvil instance
        await setupRpcPortInterceptor(metamaskContext, port);

        await use(metamaskContext);
        await metamaskContext.close();
      }
    } catch (error) {
      console.error('Error in context fixture:', error);
      throw error;
    }
  },

  // Expose wallet page (unified)
  walletPage: async ({ context: _ }: any, use: any) => {
    await use(sharedWalletPage);
  },

  // Expose MetaMask page (backward compatibility)
  metamaskPage: async ({ context: _ }: any, use: any) => {
    await use(sharedWalletPage);
  },

  // Get extension ID
  extensionId: async ({ context }: any, use: any) => {
    try {
      const extensionName = WALLET_TYPE === 'coinbase' ? 'Coinbase Wallet' : 'MetaMask';
      const extensionId = await getExtensionId(context, extensionName);
      sharedExtensionId = extensionId;
      await use(extensionId);
    } catch (error) {
      console.error('Error in extensionId fixture:', error);
      throw error;
    }
  },

  // Create unified wallet wrapper with per-test Anvil configuration
  wallet: [async ({ context, extensionId, node }: any, use: any) => {
    try {
      const port = node?.port || ANVIL_PORT;
      const rpcUrl = `http://localhost:${port}`;

      let wallet: Wallet;

      if (WALLET_TYPE === 'coinbase') {
        // Initialize Coinbase Wallet
        const cbConfig = walletConfig.wallets?.coinbase;
        if (!cbConfig) {
          throw new Error('Coinbase config not found in walletConfig');
        }

        wallet = new CoinbaseWallet(cbConfig, context, sharedWalletPage, extensionId);

        // Run wallet setup manually
        if (cbConfig.walletSetup) {
          await cbConfig.walletSetup(wallet, { localNodePort: port });
        }
      } else {
        // Initialize MetaMask (default)
        const mmConfig = walletConfig.wallets?.metamask;
        if (!mmConfig) {
          throw new Error('MetaMask config not found in walletConfig');
        }

        wallet = new MetaMask(mmConfig, context, sharedWalletPage, extensionId);

        // Run wallet setup manually (seed phrase import only, no network setup)
        if (mmConfig.walletSetup) {
          await mmConfig.walletSetup(wallet, { localNodePort: port });
        }
      }

      // Add Anvil network using the appropriate wallet-specific function
      await addAnvilNetwork(sharedWalletPage, rpcUrl);

      // Switch to the Localhost network
      await switchToLocalhostNetwork(sharedWalletPage);

      await use(wallet);
    } catch (error) {
      console.error('Error in wallet fixture:', error);
      throw error;
    }
  }, { scope: 'test', auto: true }],

  // Keep metamask fixture for backward compatibility (aliases wallet)
  metamask: [async ({ wallet }: any, use: any) => {
    // For backward compatibility, metamask fixture returns the wallet
    // This works because both MetaMask and CoinbaseWallet implement handleAction
    await use(wallet as MetaMask);
  }, { scope: 'test' }],
});

/**
 * Deploy a Conference contract for testing.
 * Uses ethers.js to deploy directly to the shared Anvil instance.
 */
export async function deployTestEvent(options: {
  name?: string;
  deposit?: string;
  maxParticipants?: number;
  coolingPeriod?: number;
  privateKey: string;
  rpcUrl?: string;
}): Promise<string> {
  const {
    name = 'Test Event',
    deposit = '0.02',
    maxParticipants = 20,
    coolingPeriod = 604800,
    privateKey,
    rpcUrl = ANVIL_URL,
  } = options;

  console.log(`[deployTestEvent] Starting deployment for "${name}" to ${rpcUrl}`);

  // Dynamic import for ethers (ESM module)
  const { ethers } = await import('ethers');

  // Verify Anvil is responsive
  const isResponsive = await waitForAnvil(rpcUrl, 5, 2000);
  if (!isResponsive) {
    throw new Error('Anvil not responding - cannot deploy contract');
  }

  // Connect to Anvil
  const provider = new ethers.JsonRpcProvider(rpcUrl, undefined, {
    cacheTimeout: -1, // Disable caching to avoid stale nonces
  });

  const wallet = new ethers.Wallet(privateKey, provider);
  console.log(`[deployTestEvent] Wallet address: ${wallet.address}`);

  // Load the compiled contract artifact
  const artifactPath = path.join(__dirname, '../../../out/Conference.sol/Conference.json');
  if (!fs.existsSync(artifactPath)) {
    throw new Error(
      `Contract artifact not found at ${artifactPath}. ` +
        'Make sure to run "forge build" before running E2E tests.'
    );
  }

  const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf-8'));
  const abi = artifact.abi;
  const bytecode = artifact.bytecode.object;

  // Deploy contract
  console.log('[deployTestEvent] Deploying contract...');
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

  console.log(`[deployTestEvent] Deployed at: ${contractAddress}`);
  return contractAddress;
}

/**
 * Deploy the ConferenceFactory contract for create-event tests.
 */
export async function deployFactory(options: {
  privateKey: string;
  rpcUrl?: string;
}): Promise<string> {
  const { privateKey, rpcUrl = ANVIL_URL } = options;

  console.log(`[deployFactory] Starting deployment to ${rpcUrl}`);

  const { ethers } = await import('ethers');

  const provider = new ethers.JsonRpcProvider(rpcUrl, undefined, {
    cacheTimeout: -1,
  });

  const wallet = new ethers.Wallet(privateKey, provider);

  const artifactPath = path.join(
    __dirname,
    '../../../out/ConferenceFactory.sol/ConferenceFactory.json'
  );
  if (!fs.existsSync(artifactPath)) {
    throw new Error(`Factory artifact not found at ${artifactPath}.`);
  }

  const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf-8'));
  const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode.object, wallet);
  const contract = await factory.deploy(wallet.address);

  await contract.waitForDeployment();
  const factoryAddress = await contract.getAddress();

  console.log(`[deployFactory] Deployed at: ${factoryAddress}`);
  return factoryAddress;
}

/**
 * Inject E2E configuration into the page.
 * Sets contract address and prevents welcome modal.
 */
export async function injectE2EConfig(
  page: any,
  config: {
    contractAddress?: string;
    factoryAddress?: string;
    chainId?: number;
  }
): Promise<void> {
  await page.addInitScript(
    (cfg: { contractAddress?: string; factoryAddress?: string; chainId?: number }) => {
      (window as any).__E2E_CONFIG__ = cfg;
      // Prevent welcome modal
      try {
        localStorage.setItem('blockparty_welcome_seen', 'true');
      } catch {
        // localStorage may not be available
      }
    },
    {
      contractAddress: config.contractAddress || '',
      factoryAddress: config.factoryAddress || '',
      chainId: config.chainId || CHAIN_ID,
    }
  );
}

/**
 * Dismiss the welcome modal if it appears.
 */
export async function dismissWelcomeModal(page: any): Promise<void> {
  const isCI = process.env.CI === 'true';
  const maxAttempts = isCI ? 15 : 8;

  // Set localStorage first
  try {
    await page.evaluate(() => {
      localStorage.setItem('blockparty_welcome_seen', 'true');
    });
  } catch {
    // localStorage might not be accessible
  }

  // Small delay for modal to potentially appear
  await page.waitForTimeout(isCI ? 500 : 300).catch(() => {});

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      if (page.isClosed()) return;

      const welcomeModal = page.locator('[role="dialog"]:has-text("Welcome to BlockParty")');
      const okButton = welcomeModal.locator('button:has-text("Ok")');

      const isVisible = await welcomeModal.isVisible({ timeout: 2000 }).catch(() => false);
      if (isVisible) {
        console.log(`[dismissWelcomeModal] Modal visible, clicking Ok`);
        await okButton.waitFor({ state: 'visible', timeout: 5000 });
        await okButton.click({ force: true });
        await welcomeModal.waitFor({ state: 'hidden', timeout: 5000 });
        console.log(`[dismissWelcomeModal] Modal dismissed`);
        return;
      }
    } catch (e) {
      console.log(`[dismissWelcomeModal] Attempt ${attempt + 1} error:`, (e as Error).message);
    }
    await page.waitForTimeout(300).catch(() => {});
  }
}

/**
 * Dismiss any RainbowKit popovers that might be blocking interactions.
 */
export async function dismissRainbowKitPopovers(page: any): Promise<void> {
  try {
    if (page.isClosed()) return;
  } catch {
    return;
  }

  const maxAttempts = 5;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const popoverSelectors = [
        '#popover-content',
        '.popover-bg',
        '[data-rk] [role="dialog"]',
        '[data-rk] [data-radix-popper-content-wrapper]',
      ];

      let popoverFound = false;
      for (const selector of popoverSelectors) {
        const popover = page.locator(selector);
        const isVisible = await popover.isVisible({ timeout: 500 }).catch(() => false);
        if (isVisible) {
          popoverFound = true;
          break;
        }
      }

      if (!popoverFound) return;

      console.log(`[dismissRainbowKitPopovers] Popover found, pressing Escape`);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500).catch(() => {});
    } catch {
      // Continue
    }
  }
}

/**
 * Wait for app to fully load.
 */
export async function waitForAppLoad(page: any): Promise<void> {
  // Set localStorage
  try {
    await page.evaluate(() => {
      localStorage.setItem('blockparty_welcome_seen', 'true');
    });
  } catch {}

  // Dismiss popovers
  await dismissRainbowKitPopovers(page);

  // Wait for page ready
  await page.waitForLoadState('domcontentloaded').catch(() => {});

  // Wait for React to render
  await page
    .waitForFunction(
      () => {
        const appDiv = document.getElementById('app');
        return appDiv && appDiv.innerHTML.length > 100;
      },
      { timeout: 60000 }
    )
    .catch(() => {});

  // Dismiss welcome modal
  await dismissWelcomeModal(page);

  // Wait for Event Info header
  await page.waitForSelector('h4:has-text("Event Info")', { timeout: 60000 }).catch(() => {});

  // Wait for ETH deposit amount
  await page
    .locator('text=/\\d+\\.\\d+.*ETH/i')
    .first()
    .waitFor({ state: 'visible', timeout: 30000 })
    .catch(() => {});
}

/**
 * Wait for transaction success notification in the UI.
 */
export async function waitForTransactionSuccess(page: any, timeout = 60000): Promise<void> {
  const isCI = process.env.CI === 'true';
  const effectiveTimeout = isCI ? Math.max(timeout, 90000) : timeout;

  console.log(`[waitForTransactionSuccess] Waiting for alert (timeout: ${effectiveTimeout}ms)`);

  const alertLocator = page.locator('[role="alert"]').first();
  await expect(alertLocator).toBeVisible({ timeout: effectiveTimeout });

  const alertText = await alertLocator.textContent();
  console.log(`[waitForTransactionSuccess] Alert: ${alertText?.substring(0, 100)}`);

  if (alertText && alertText.toLowerCase().includes('error')) {
    throw new Error(`Transaction failed: ${alertText}`);
  }
}

/**
 * Wait for UI to reflect transaction completion.
 */
export async function waitForTransactionComplete(
  page: any,
  options?: {
    timeout?: number;
    expectElement?: string;
  }
): Promise<void> {
  const timeout = options?.timeout || 120000;

  await waitForTransactionSuccess(page, timeout);

  if (options?.expectElement) {
    await page
      .locator(options.expectElement)
      .waitFor({ state: 'visible', timeout: 10000 })
      .catch(() => {});
  }

  // Wait for loading indicators to disappear
  await page
    .locator('[role="progressbar"], .MuiCircularProgress-root')
    .waitFor({ state: 'hidden', timeout: 5000 })
    .catch(() => {});
}

/**
 * Switch MetaMask account by index.
 * OnchainTestKit uses the same seed phrase, so accounts match Anvil accounts.
 * Account 0 = deployer, Account 1 = user1, etc.
 *
 * Note: After switching accounts, the network may reset. This function
 * also ensures the Localhost network is selected after the switch.
 */
export async function switchMetaMaskAccount(
  metamask: any,
  accountIndex: number
): Promise<void> {
  console.log(`[switchMetaMaskAccount] Switching to account ${accountIndex}`);

  // OnchainTestKit's metamask fixture should have a switchAccount method
  // or we need to do it through the MetaMask UI
  if (typeof metamask.switchAccount === 'function') {
    await metamask.switchAccount(accountIndex);
  } else {
    // Fallback: Use MetaMask page interaction if available
    // Note: This may need adjustment based on actual OnchainTestKit API
    console.log(`[switchMetaMaskAccount] Using page interaction for account switch`);
    const metamaskPage = metamask.page || metamask.extensionPage;
    if (metamaskPage) {
      // Click account selector
      await metamaskPage.locator('[data-testid="account-menu-icon"]').click();
      await metamaskPage.waitForTimeout(500);

      // Select the account by index (accounts are listed in order)
      const accountSelector = metamaskPage.locator(
        `[data-testid="account-list-menu-details"]:nth-child(${accountIndex + 1}), [data-testid="account-list-item"]:nth-child(${accountIndex + 1})`
      );
      if ((await accountSelector.count()) > 0) {
        await accountSelector.click();
      } else {
        // Try clicking by account name pattern (Account 1, Account 2, etc.)
        const accountName = `Account ${accountIndex + 1}`;
        await metamaskPage.locator(`text="${accountName}"`).click();
      }
      await metamaskPage.waitForTimeout(500);

      // After switching accounts, ensure we're on the Localhost network
      // (MetaMask may reset to Mainnet when switching accounts)
      await switchToLocalhostNetworkMetaMask(metamaskPage);
    }
  }
}

/**
 * Handle MetaMask connection flow including the MetaMask 12.x "Review permissions" dialog.
 *
 * MetaMask 12.x has a two-step connection flow:
 * 1. First dialog: "Connect to [site]" with account selection
 * 2. Second dialog: "Review permissions" for network access
 *
 * OnchainTestKit's CONNECT_TO_DAPP only handles step 1 and waits for the page to close,
 * but in MetaMask 12.x the page doesn't close - it transitions to step 2.
 */
export async function handleMetaMaskConnection(context: any, extensionId: string): Promise<void> {
  const maxAttempts = 30;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    // Wait a moment between attempts
    await new Promise(resolve => setTimeout(resolve, 500));

    // Find all pages and look for MetaMask notification pages
    const pages = context.pages();

    for (const notificationPage of pages) {
      try {
        const url = notificationPage.url();

        // MetaMask notification pages have 'notification' in URL
        if (url.includes(extensionId) && url.includes('notification')) {
          console.log(`[handleMetaMaskConnection] Attempt ${attempt + 1}, found notification page:`, url);

          // Check for "Connect" button (step 1 - account selection)
          const connectButton = notificationPage.getByRole('button', { name: 'Connect' });
          const hasConnect = await connectButton.isVisible({ timeout: 1000 }).catch(() => false);

          if (hasConnect) {
            console.log('[handleMetaMaskConnection] Found Connect dialog, clicking Connect');
            await connectButton.click();
            // After clicking, the page transitions to permissions - continue loop
            await new Promise(resolve => setTimeout(resolve, 1500));
            break; // Break inner loop to restart with fresh page list
          }

          // Check for "Confirm" button (step 2 - permissions)
          // MetaMask 12.x has different confirmation dialogs:
          // - #connect/.../confirm-permissions - uses "Confirm" button
          // - #confirmation - may use different button text
          const confirmSelectors = [
            notificationPage.getByRole('button', { name: 'Confirm' }),
            notificationPage.getByRole('button', { name: 'Approve' }),
            notificationPage.locator('button[data-testid="confirm-btn"]'),
            notificationPage.locator('button[data-testid="page-container-footer-next"]'),
            notificationPage.locator('button.btn-primary').filter({ hasText: /confirm/i }),
          ];

          for (const confirmButton of confirmSelectors) {
            const hasConfirm = await confirmButton.isVisible({ timeout: 500 }).catch(() => false);

            if (hasConfirm) {
              console.log('[handleMetaMaskConnection] Found confirmation dialog, clicking button');
              await confirmButton.click();

              // Wait for the page to close
              await notificationPage.waitForEvent('close', { timeout: 5000 }).catch(() => {});
              console.log('[handleMetaMaskConnection] Connection complete');
              return;
            }
          }

          // If we have a #confirmation URL but couldn't find buttons, log the page content for debugging
          if (url.includes('#confirmation') && attempt === 5) {
            console.log('[handleMetaMaskConnection] Debugging #confirmation page - looking for buttons...');
            const buttons = await notificationPage.locator('button').all();
            for (const btn of buttons) {
              const text = await btn.textContent().catch(() => '');
              const testId = await btn.getAttribute('data-testid').catch(() => '');
              console.log(`[handleMetaMaskConnection] Button found: "${text}" data-testid="${testId}"`);
            }
          }
        }
      } catch (err) {
        // Continue checking other pages
      }
    }
  }

  console.log('[handleMetaMaskConnection] No notification dialog found after all attempts');
}

/**
 * Handle Coinbase Wallet connection flow.
 *
 * Coinbase Wallet typically has a simpler connection flow with a single popup.
 */
export async function handleCoinbaseConnection(context: any, extensionId: string): Promise<void> {
  const maxAttempts = 30;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    // Wait a moment between attempts
    await new Promise(resolve => setTimeout(resolve, 500));

    // Find all pages and look for Coinbase Wallet popup pages
    const pages = context.pages();

    for (const popupPage of pages) {
      try {
        const url = popupPage.url();

        // Coinbase Wallet popup pages contain the extension ID
        if (url.includes(extensionId)) {
          console.log(`[handleCoinbaseConnection] Attempt ${attempt + 1}, found popup page:`, url);

          // Look for Connect/Approve buttons in Coinbase Wallet UI
          const connectSelectors = [
            popupPage.getByRole('button', { name: 'Connect' }),
            popupPage.getByRole('button', { name: 'Approve' }),
            popupPage.getByRole('button', { name: 'Allow' }),
            popupPage.locator('button[data-testid="allow-authorize-button"]'),
            popupPage.locator('button:has-text("Connect")'),
          ];

          for (const button of connectSelectors) {
            const isVisible = await button.isVisible({ timeout: 500 }).catch(() => false);
            if (isVisible) {
              console.log('[handleCoinbaseConnection] Found connect button, clicking');
              await button.click();

              // Wait for the popup to close or transition
              await popupPage.waitForEvent('close', { timeout: 5000 }).catch(() => {});
              console.log('[handleCoinbaseConnection] Connection complete');
              return;
            }
          }
        }
      } catch (err) {
        // Continue checking other pages
      }
    }
  }

  console.log('[handleCoinbaseConnection] No popup dialog found after all attempts');
}

/**
 * Handle wallet connection flow (MetaMask or Coinbase).
 * Delegates to the appropriate wallet-specific handler.
 */
export async function handleWalletConnection(context: any, extensionId: string): Promise<void> {
  if (WALLET_TYPE === 'coinbase') {
    await handleCoinbaseConnection(context, extensionId);
  } else {
    await handleMetaMaskConnection(context, extensionId);
  }
}

/**
 * Switch wallet account by index.
 * OnchainTestKit uses the same seed phrase, so accounts match Anvil accounts.
 * Account 0 = deployer, Account 1 = user1, etc.
 */
export async function switchWalletAccount(
  wallet: Wallet,
  accountIndex: number
): Promise<void> {
  console.log(`[switchWalletAccount] Switching to account ${accountIndex}`);

  // Both MetaMask and CoinbaseWallet should have switchAccount method
  if (typeof (wallet as any).switchAccount === 'function') {
    await (wallet as any).switchAccount(accountIndex);
  } else {
    // Fallback: delegate to MetaMask-specific handler (works for MetaMask)
    await switchMetaMaskAccount(wallet, accountIndex);
  }
}

/**
 * Connect wallet via RainbowKit.
 * Handles both MetaMask and Coinbase Wallet connection flows.
 *
 * @param page - Playwright page
 * @param wallet - Wallet instance (MetaMask or CoinbaseWallet) from OnchainTestKit
 * @param options - Optional: { accountIndex } to switch accounts before connecting
 */
export async function connectWallet(
  page: any,
  wallet: any,
  options?: {
    accountIndex?: number;
  }
): Promise<void> {
  const accountIndex = options?.accountIndex ?? 0;

  // Get context and extensionId from wallet
  const context = wallet.context;
  const extensionId = wallet.extensionId;

  if (!context || !extensionId) {
    throw new Error('Wallet context or extensionId not available. Ensure wallet fixture is properly initialized.');
  }

  // Switch to desired account first if not default
  if (accountIndex !== 0) {
    await switchWalletAccount(wallet, accountIndex);
  }

  // Click Connect Wallet button
  const connectButton = page.locator('button:has-text("Connect Wallet")');
  if (await connectButton.isVisible({ timeout: 5000 }).catch(() => false)) {
    await connectButton.click();

    if (WALLET_TYPE === 'coinbase') {
      // Click Coinbase Wallet option in RainbowKit modal
      await page
        .locator('button:has-text("Coinbase Wallet"), [data-testid="rk-wallet-option-coinbase"]')
        .first()
        .click();

      // Handle Coinbase Wallet connection flow
      await handleCoinbaseConnection(context, extensionId);
    } else {
      // Click MetaMask option in RainbowKit modal (default)
      await page
        .locator('button:has-text("MetaMask"), [data-testid="rk-wallet-option-metaMask"]')
        .first()
        .click();

      // Handle MetaMask 12.x two-step connection flow (Connect + Review permissions)
      await handleMetaMaskConnection(context, extensionId);
    }
  }
}

/**
 * Wait for page to be ready (React rendered, content visible).
 */
export async function waitForPageReady(page: any): Promise<void> {
  await page.waitForLoadState('domcontentloaded').catch(() => {});

  // Wait for React to render
  await page
    .waitForFunction(
      () => {
        const appDiv = document.getElementById('app');
        return appDiv && appDiv.innerHTML.length > 100;
      },
      { timeout: 30000 }
    )
    .catch(() => {});

  // Dismiss welcome modal
  await dismissWelcomeModal(page);
}

/**
 * Ensure page is ready for interaction.
 */
export async function ensurePageReady(page: any): Promise<void> {
  await waitForPageReady(page);
  await dismissRainbowKitPopovers(page);
}
