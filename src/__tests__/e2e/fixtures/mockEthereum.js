/**
 * Mock Ethereum Provider for E2E Tests
 *
 * This script is injected into the browser to simulate MetaMask.
 * It uses Anvil's pre-funded test accounts and forwards transactions to Anvil.
 *
 * Unlike @depay/web3-mock which mocks responses, this provider forwards
 * real transactions to a local Anvil instance for true integration testing.
 *
 * Usage: page.addInitScript({ path: 'mockEthereum.js' })
 */

// Anvil's pre-funded test accounts (same as Hardhat's default accounts)
const TEST_ACCOUNTS = {
  deployer: {
    address: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
    privateKey: '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
  },
  user1: {
    address: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
    privateKey: '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d',
  },
  user2: {
    address: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
    privateKey: '0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a',
  },
  user3: {
    address: '0x90F79bf6EB2c4f870365E785982E1f101E93b906',
    privateKey: '0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6',
  },
};

// Configuration - can be overridden via window.__E2E_CONFIG__
// Also check sessionStorage for persisted account selection (for page reloads)
const getConfig = () => {
  // Check if account was changed during the session
  const persistedAccount =
    typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('__e2e_active_account__') : null;

  return {
    // Use 127.0.0.1 to avoid DNS resolution issues in containers
    rpcUrl: window.__E2E_CONFIG__?.rpcUrl || 'http://127.0.0.1:8545',
    chainId: window.__E2E_CONFIG__?.chainId || 1337,
    activeAccount: persistedAccount || window.__E2E_CONFIG__?.activeAccount || 'user1',
  };
};

/**
 * Create a mock Ethereum provider that mimics MetaMask's window.ethereum
 * Compatible with EIP-1193 standard
 */
function createMockEthereum() {
  const config = getConfig();
  let currentAccount = TEST_ACCOUNTS[config.activeAccount];
  const listeners = new Map();
  let isConnected = true;

  const mockEthereum = {
    // MetaMask identification
    isMetaMask: true,
    _metamask: {
      isUnlocked: () => Promise.resolve(true),
    },

    // Connection state
    isConnected: () => isConnected,

    // Chain info (EIP-1193)
    get chainId() {
      return `0x${config.chainId.toString(16)}`;
    },
    get networkVersion() {
      return config.chainId.toString();
    },

    // Selected address (legacy)
    get selectedAddress() {
      return currentAccount.address;
    },

    /**
     * Main request method - handles all JSON-RPC calls (EIP-1193)
     */
    async request({ method, params }) {
      // console.log('[MockEthereum] Request:', method, params);

      switch (method) {
        // Account methods
        case 'eth_requestAccounts':
        case 'eth_accounts':
          return [currentAccount.address];

        // Chain methods
        case 'eth_chainId':
          return `0x${config.chainId.toString(16)}`;

        case 'net_version':
          return config.chainId.toString();

        case 'wallet_switchEthereumChain': {
          const requestedChainId = params?.[0]?.chainId;
          if (requestedChainId && requestedChainId !== mockEthereum.chainId) {
            // Simulate switching to requested chain
            mockEthereum.emit('chainChanged', requestedChainId);
          }
          return null;
        }

        case 'wallet_addEthereumChain':
          // Auto-approve adding chains
          return null;

        // Transaction methods - forward to Anvil
        case 'eth_sendTransaction': {
          const tx = params[0];
          return await sendTransaction(tx);
        }

        case 'eth_getTransactionReceipt':
        case 'eth_getTransactionByHash':
          return await forwardToRpc(method, params);

        // Signing methods
        case 'personal_sign': {
          const [message, address] = params;
          return await signMessage(message, address);
        }

        case 'eth_sign': {
          const [address, message] = params;
          return await signMessage(message, address);
        }

        case 'eth_signTypedData':
        case 'eth_signTypedData_v3':
        case 'eth_signTypedData_v4': {
          const [address, typedData] = params;
          return await signTypedData(address, typedData);
        }

        // Permissions (EIP-2255)
        case 'wallet_requestPermissions':
          return [{ parentCapability: 'eth_accounts' }];

        case 'wallet_getPermissions':
          return [{ parentCapability: 'eth_accounts' }];

        // Default - forward to Anvil RPC
        default:
          return await forwardToRpc(method, params);
      }
    },

    /**
     * Legacy send method (deprecated but still used by some dapps)
     */
    send(methodOrPayload, paramsOrCallback) {
      if (typeof methodOrPayload === 'string') {
        return this.request({ method: methodOrPayload, params: paramsOrCallback });
      }
      // Handle object payload
      return this.request(methodOrPayload);
    },

    /**
     * Legacy sendAsync method
     */
    sendAsync(payload, callback) {
      this.request(payload)
        .then(result => callback(null, { id: payload.id, jsonrpc: '2.0', result }))
        .catch(error => callback(error, null));
    },

    /**
     * Event listener methods (EIP-1193)
     */
    on(event, handler) {
      if (!listeners.has(event)) {
        listeners.set(event, new Set());
      }
      listeners.get(event).add(handler);
      return this;
    },

    once(event, handler) {
      const onceHandler = (...args) => {
        this.removeListener(event, onceHandler);
        handler(...args);
      };
      return this.on(event, onceHandler);
    },

    off(event, handler) {
      return this.removeListener(event, handler);
    },

    removeListener(event, handler) {
      if (listeners.has(event)) {
        listeners.get(event).delete(handler);
      }
      return this;
    },

    removeAllListeners(event) {
      if (event) {
        listeners.delete(event);
      } else {
        listeners.clear();
      }
      return this;
    },

    /**
     * Emit an event to all listeners
     */
    emit(event, ...args) {
      if (listeners.has(event)) {
        listeners.get(event).forEach(handler => {
          try {
            handler(...args);
          } catch (e) {
            console.error('[MockEthereum] Error in event handler:', e);
          }
        });
      }
      return true;
    },

    // Alias for emit
    _emit(event, ...args) {
      return this.emit(event, ...args);
    },

    /**
     * Switch to a different test account (for multi-user testing)
     * Persists selection to sessionStorage so it survives page reloads
     */
    __switchAccount(accountKey) {
      if (!TEST_ACCOUNTS[accountKey]) {
        throw new Error(
          `Unknown account: ${accountKey}. Available: ${Object.keys(TEST_ACCOUNTS).join(', ')}`
        );
      }
      const oldAddress = currentAccount.address;
      currentAccount = TEST_ACCOUNTS[accountKey];

      // Persist to sessionStorage for page reloads
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.setItem('__e2e_active_account__', accountKey);
      }

      if (oldAddress !== currentAccount.address) {
        this.emit('accountsChanged', [currentAccount.address]);
      }
    },

    /**
     * Get current account info (for debugging)
     */
    __getCurrentAccount() {
      return { ...currentAccount };
    },

    /**
     * Simulate disconnect
     */
    __disconnect() {
      isConnected = false;
      this.emit('disconnect', { code: 4900, message: 'Disconnected' });
    },

    /**
     * Simulate reconnect
     */
    __reconnect() {
      isConnected = true;
      this.emit('connect', { chainId: mockEthereum.chainId });
    },
  };

  /**
   * Send a transaction via Anvil
   */
  async function sendTransaction(tx) {
    const config = getConfig();

    // Ensure from address matches current account
    const txToSend = {
      from: currentAccount.address,
      to: tx.to,
      value: tx.value || '0x0',
      data: tx.data || '0x',
      gas: tx.gas || tx.gasLimit,
      nonce: tx.nonce,
      maxFeePerGas: tx.maxFeePerGas,
      maxPriorityFeePerGas: tx.maxPriorityFeePerGas,
      gasPrice: tx.gasPrice,
    };

    // Get nonce if not provided
    if (!txToSend.nonce) {
      const nonceResult = await forwardToRpc('eth_getTransactionCount', [
        currentAccount.address,
        'pending',
      ]);
      txToSend.nonce = nonceResult;
    }

    // Get gas estimate if not provided
    if (!txToSend.gas) {
      try {
        txToSend.gas = await forwardToRpc('eth_estimateGas', [txToSend]);
      } catch (e) {
        // Default gas limit
        txToSend.gas = '0x100000';
      }
    }

    // Send transaction to Anvil
    const response = await fetch(config.rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_sendTransaction',
        params: [txToSend],
        id: Date.now(),
      }),
    });

    const result = await response.json();

    if (result.error) {
      const error = new Error(result.error.message);
      error.code = result.error.code;
      throw error;
    }

    return result.result; // Transaction hash
  }

  /**
   * Sign a message with Anvil
   */
  async function signMessage(message, address) {
    const config = getConfig();
    const signingAddress = address || currentAccount.address;

    const response = await fetch(config.rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'personal_sign',
        params: [message, signingAddress],
        id: Date.now(),
      }),
    });

    const result = await response.json();

    if (result.error) {
      throw new Error(result.error.message);
    }

    return result.result;
  }

  /**
   * Sign typed data (EIP-712) with Anvil
   */
  async function signTypedData(address, typedData) {
    const config = getConfig();
    const signingAddress = address || currentAccount.address;

    const response = await fetch(config.rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_signTypedData_v4',
        params: [
          signingAddress,
          typeof typedData === 'string' ? typedData : JSON.stringify(typedData),
        ],
        id: Date.now(),
      }),
    });

    const result = await response.json();

    if (result.error) {
      throw new Error(result.error.message);
    }

    return result.result;
  }

  /**
   * Forward RPC calls to Anvil with retry logic for container environments
   */
  async function forwardToRpc(method, params, retries = 3) {
    const config = getConfig();

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const response = await fetch(config.rpcUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            method,
            params: params || [],
            id: Date.now(),
          }),
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const result = await response.json();

        if (result.error) {
          const error = new Error(result.error.message);
          error.code = result.error.code;
          throw error;
        }

        return result.result;
      } catch (error) {
        const isLastAttempt = attempt === retries;
        if (isLastAttempt) {
          console.error(
            `[MockEthereum] ${method} failed after ${retries} attempts:`,
            error.message
          );
          throw new Error(`Failed to call ${method} on Anvil: ${error.message}`);
        }
        // Wait before retrying (exponential backoff: 50ms, 100ms, 200ms)
        await new Promise(resolve => setTimeout(resolve, 50 * Math.pow(2, attempt - 1)));
      }
    }
  }

  return mockEthereum;
}

// Install the mock provider
window.ethereum = createMockEthereum();

// Emit connect event on load
setTimeout(() => {
  window.ethereum.emit('connect', { chainId: window.ethereum.chainId });
}, 0);

// Expose test utilities on window for E2E tests to use
window.__mockEthereum = {
  switchAccount: accountKey => window.ethereum.__switchAccount(accountKey),
  getCurrentAccount: () => window.ethereum.__getCurrentAccount(),
  disconnect: () => window.ethereum.__disconnect(),
  reconnect: () => window.ethereum.__reconnect(),
  resetAccount: () => {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem('__e2e_active_account__');
    }
  },
  accounts: TEST_ACCOUNTS,
};

console.log('[MockEthereum] Initialized with account:', window.ethereum.selectedAddress);
