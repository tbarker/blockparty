/**
 * Jest setup file - runs before each test file
 */

// Extend Jest with custom matchers from testing-library
import '@testing-library/jest-dom';

// Mock window.matchMedia (required by Material-UI)
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(), // deprecated
    removeListener: jest.fn(), // deprecated
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Mock window.localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// Mock window.location
delete window.location;
window.location = {
  hostname: 'localhost',
  href: 'http://localhost:8080',
  protocol: 'http:',
  assign: jest.fn(),
  reload: jest.fn(),
};

// Mock navigator.userAgent
Object.defineProperty(navigator, 'userAgent', {
  value: 'Mozilla/5.0 (jest-test)',
  writable: true,
});

// Mock fetch
global.fetch = jest.fn(() =>
  Promise.resolve({
    json: () => Promise.resolve({}),
    ok: true,
  })
);

// Mock jQuery AJAX (used by the app)
global.$ = {
  get: jest.fn((url, callback) => {
    if (callback) callback({});
    return {
      fail: jest.fn().mockReturnThis(),
      always: jest.fn((cb) => {
        cb();
        return { fail: jest.fn() };
      }),
    };
  }),
  ajax: jest.fn(),
};

// Mock global web3 object (used by QRCode and other components)
global.web3 = {
  currentProvider: {
    constructor: { name: 'MockProvider' },
    scanQRCode: null, // Set to null - component checks for this
  },
  fromWei: jest.fn((val) => {
    if (typeof val === 'object' && val.toNumber) {
      val = val.toNumber();
    }
    if (typeof val === 'number') return (val / 1e18).toString();
    return '0';
  }),
  toWei: jest.fn((val, unit) => (parseFloat(val) * 1e18).toString()),
  eth: {
    getAccounts: jest.fn(() => Promise.resolve([])),
    getBalance: jest.fn(() => Promise.resolve('0')),
  },
  version: {
    getNetwork: jest.fn((cb) => cb(null, '1')),
  },
};

// Suppress console errors during tests (optional - comment out for debugging)
// console.error = jest.fn();
// console.warn = jest.fn();

// Mock RainbowKit ConnectButton (requires provider context in real usage)
jest.mock('@rainbow-me/rainbowkit', () => ({
  ConnectButton: () => {
    const React = require('react');
    return React.createElement('button', { 'data-testid': 'mock-connect-button' }, 'Connect Wallet');
  },
  RainbowKitProvider: ({ children }) => children,
  getDefaultConfig: jest.fn(() => ({})),
  lightTheme: jest.fn(() => ({})),
  darkTheme: jest.fn(() => ({})),
}));

// Mock wagmi hooks
jest.mock('wagmi', () => ({
  WagmiProvider: ({ children }) => children,
  useAccount: () => ({ address: undefined, isConnected: false }),
  useChainId: () => 1337,
  useSwitchChain: () => ({ switchChain: jest.fn() }),
  useClient: () => null,
  useConnectorClient: () => ({ data: null }),
}));

// Mock @tanstack/react-query
jest.mock('@tanstack/react-query', () => ({
  QueryClient: jest.fn().mockImplementation(() => ({})),
  QueryClientProvider: ({ children }) => children,
}));

// Global test timeout
jest.setTimeout(30000);
