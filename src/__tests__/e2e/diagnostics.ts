/**
 * Diagnostic Utilities for E2E Tests
 *
 * Provides health checks and debugging helpers for Anvil and MetaMask.
 * Used by OnchainTestKit E2E tests for debugging test failures.
 */

/**
 * Diagnostic result for tracking system health
 */
export interface DiagnosticResult {
  timestamp: string;
  anvil: {
    responding: boolean;
    blockNumber?: number;
    chainId?: string;
    peerCount?: number;
    error?: string;
    responseTimeMs?: number;
  };
  metamask?: {
    extensionLoaded: boolean;
    notificationPagesOpen: number;
    error?: string;
  };
  browser?: {
    pageCount: number;
    memoryUsageMB?: number;
  };
}

/**
 * Perform detailed Anvil health check with multiple RPC methods.
 * This helps diagnose exactly what's failing when Anvil becomes unresponsive.
 */
export async function checkAnvilHealth(
  anvilUrl: string,
  timeout = 10000
): Promise<DiagnosticResult['anvil']> {
  const startTime = Date.now();

  const result: DiagnosticResult['anvil'] = {
    responding: false,
  };

  // Test 1: eth_blockNumber (most basic)
  try {
    const response = (await Promise.race([
      fetch(anvilUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'eth_blockNumber',
          params: [],
          id: 1,
        }),
      }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), timeout)),
    ])) as Response;

    const data = await response.json();
    if (data.result) {
      result.blockNumber = parseInt(data.result, 16);
      result.responding = true;
    } else if (data.error) {
      result.error = `eth_blockNumber error: ${JSON.stringify(data.error)}`;
    }
  } catch (e) {
    result.error = `eth_blockNumber failed: ${(e as Error).message}`;
    result.responseTimeMs = Date.now() - startTime;
    return result;
  }

  // Test 2: eth_chainId
  try {
    const response = (await Promise.race([
      fetch(anvilUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'eth_chainId',
          params: [],
          id: 2,
        }),
      }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), timeout)),
    ])) as Response;

    const data = await response.json();
    if (data.result) {
      result.chainId = data.result;
    }
  } catch (e) {
    console.warn('[checkAnvilHealth] eth_chainId failed:', (e as Error).message);
  }

  // Test 3: net_peerCount (tests networking layer)
  try {
    const response = (await Promise.race([
      fetch(anvilUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'net_peerCount',
          params: [],
          id: 3,
        }),
      }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), timeout)),
    ])) as Response;

    const data = await response.json();
    if (data.result) {
      result.peerCount = parseInt(data.result, 16);
    }
  } catch {
    // net_peerCount is optional, don't fail on it
  }

  result.responseTimeMs = Date.now() - startTime;
  return result;
}

/**
 * Check MetaMask extension state in the browser context.
 * This helps identify if MetaMask itself is the issue.
 */
export async function checkMetaMaskHealth(
  context: any
): Promise<DiagnosticResult['metamask']> {
  const result: DiagnosticResult['metamask'] = {
    extensionLoaded: false,
    notificationPagesOpen: 0,
  };

  try {
    const pages = context.pages();
    let extensionPageFound = false;
    let notificationCount = 0;

    for (const p of pages) {
      try {
        const url = p.url();
        if (url.startsWith('chrome-extension://')) {
          extensionPageFound = true;
          if (url.includes('notification.html')) {
            notificationCount++;
          }
        }
      } catch {
        // Page might be closed
      }
    }

    result.extensionLoaded = extensionPageFound;
    result.notificationPagesOpen = notificationCount;
  } catch (e) {
    result.error = `Context check failed: ${(e as Error).message}`;
  }

  return result;
}

/**
 * Perform full diagnostic check and log results.
 * Call this when tests fail to understand the system state.
 */
export async function runDiagnostics(
  anvilUrl: string,
  context?: any,
  label = 'DIAGNOSTIC'
): Promise<DiagnosticResult> {
  const result: DiagnosticResult = {
    timestamp: new Date().toISOString(),
    anvil: await checkAnvilHealth(anvilUrl),
  };

  if (context) {
    result.metamask = await checkMetaMaskHealth(context);

    // Count pages
    try {
      const pages = context.pages();
      result.browser = {
        pageCount: pages.length,
      };
    } catch {
      result.browser = { pageCount: -1 };
    }
  }

  // Log diagnostic summary
  console.log(`\n========== ${label} ==========`);
  console.log(`Timestamp: ${result.timestamp}`);
  console.log(`Anvil:`);
  console.log(`  - Responding: ${result.anvil.responding}`);
  console.log(`  - Block Number: ${result.anvil.blockNumber ?? 'N/A'}`);
  console.log(`  - Chain ID: ${result.anvil.chainId ?? 'N/A'}`);
  console.log(`  - Response Time: ${result.anvil.responseTimeMs ?? 'N/A'}ms`);
  if (result.anvil.error) {
    console.log(`  - Error: ${result.anvil.error}`);
  }

  if (result.metamask) {
    console.log(`MetaMask:`);
    console.log(`  - Extension Loaded: ${result.metamask.extensionLoaded}`);
    console.log(`  - Notification Pages: ${result.metamask.notificationPagesOpen}`);
    if (result.metamask.error) {
      console.log(`  - Error: ${result.metamask.error}`);
    }
  }

  if (result.browser) {
    console.log(`Browser:`);
    console.log(`  - Page Count: ${result.browser.pageCount}`);
  }
  console.log(`================================\n`);

  return result;
}

/**
 * Wait for Anvil to be responsive with retries.
 * Useful when starting a new Anvil node.
 */
export async function waitForAnvil(
  anvilUrl: string,
  maxRetries = 10,
  retryDelayMs = 1000
): Promise<boolean> {
  for (let i = 0; i < maxRetries; i++) {
    const health = await checkAnvilHealth(anvilUrl, 5000);
    if (health.responding) {
      console.log(`[waitForAnvil] Anvil responsive after ${i + 1} attempts`);
      return true;
    }
    console.log(`[waitForAnvil] Attempt ${i + 1}/${maxRetries} failed, retrying...`);
    await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
  }
  console.error(`[waitForAnvil] Anvil not responsive after ${maxRetries} attempts`);
  return false;
}
