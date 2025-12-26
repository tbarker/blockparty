/**
 * Test utilities for React component testing
 */

import React from 'react';
import { render, act } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import EventEmitter from 'event-emitter';

const theme = createTheme({
  palette: {
    primary: {
      main: '#607D8B',
    },
  },
});

/**
 * Create a mock EventEmitter for testing
 */
export function createMockEventEmitter() {
  const emitter = EventEmitter();
  // Add spy methods for testing
  emitter.emitSpy = jest.fn();
  const originalEmit = emitter.emit.bind(emitter);
  emitter.emit = (...args) => {
    emitter.emitSpy(...args);
    return originalEmit(...args);
  };
  // Helper to emit events wrapped in act() for tests
  emitter.emitAsync = async (...args) => {
    await act(async () => {
      originalEmit(...args);
      emitter.emitSpy(...args);
    });
  };
  return emitter;
}

/**
 * Create mock contract detail object
 */
export function createMockDetail(overrides = {}) {
  return {
    name: 'Test Event',
    deposit: { toNumber: () => 20000000000000000, toString: () => '20000000000000000' },
    payout: { toNumber: () => 40000000000000000, toString: () => '40000000000000000' },
    totalBalance: { toNumber: () => 100000000000000000, toString: () => '100000000000000000' },
    registered: { toNumber: () => 5 },
    attended: { toNumber: () => 3 },
    owner: '0x1234567890123456789012345678901234567890',
    ended: false,
    cancelled: false,
    limitOfParticipants: { toNumber: () => 20 },
    payoutAmount: { toNumber: () => 40000000000000000, toString: () => '40000000000000000' },
    encryption: '',
    admins: [],
    contractBalance: 0.1,
    date: '2024-01-15',
    map_url: 'https://maps.example.com',
    location_text: 'Test Location',
    description_text: 'Test Description',
    canRegister: true,
    canAttend: true,
    canPayback: false,
    canCancel: true,
    canWithdraw: false,
    contractAddress: '0xabcdef1234567890abcdef1234567890abcdef12',
    ...overrides,
  };
}

/**
 * Create mock participant object
 */
export function createMockParticipant(overrides = {}) {
  return {
    name: '@testuser',
    address: '0x1111111111111111111111111111111111111111',
    attended: false,
    paid: false,
    ensname: null,
    ...overrides,
  };
}

/**
 * Create mock web3 object (Web3 v1.x compatible)
 */
export function createMockWeb3() {
  const fromWei = jest.fn((value, unit) => {
    if (typeof value === 'object' && value.toString) {
      value = value.toString();
    }
    // Simple conversion for testing
    return (parseFloat(value) / 1e18).toString();
  });

  const toWei = jest.fn((value, unit) => {
    return (parseFloat(value) * 1e18).toString();
  });

  return {
    // Web3 v1.x uses utils namespace
    utils: {
      fromWei,
      toWei,
      sha3: jest.fn(value => '0x' + value),
      keccak256: jest.fn(value => '0x' + value),
    },
    // Also keep top-level for any legacy usage during transition
    fromWei,
    toWei,
    eth: {
      getAccounts: jest.fn(() => Promise.resolve(['0x1234567890123456789012345678901234567890'])),
      getBalance: jest.fn(() => Promise.resolve('1000000000000000000')),
      net: {
        getId: jest.fn(() => Promise.resolve(1)),
      },
    },
    currentProvider: {
      constructor: { name: 'MockProvider' },
    },
    setProvider: jest.fn(),
  };
}

/**
 * Create mock contract instance
 */
export function createMockContract() {
  const mockInstance = {
    address: '0xabcdef1234567890abcdef1234567890abcdef12',
    name: { call: jest.fn(() => Promise.resolve('Test Event')) },
    deposit: { call: jest.fn(() => Promise.resolve({ toNumber: () => 20000000000000000 })) },
    payout: { call: jest.fn(() => Promise.resolve({ toNumber: () => 0 })) },
    totalBalance: { call: jest.fn(() => Promise.resolve({ toNumber: () => 0 })) },
    registered: { call: jest.fn(() => Promise.resolve({ toNumber: () => 0 })) },
    attended: { call: jest.fn(() => Promise.resolve({ toNumber: () => 0 })) },
    owner: { call: jest.fn(() => Promise.resolve('0x1234567890123456789012345678901234567890')) },
    ended: { call: jest.fn(() => Promise.resolve(false)) },
    cancelled: { call: jest.fn(() => Promise.resolve(false)) },
    limitOfParticipants: { call: jest.fn(() => Promise.resolve({ toNumber: () => 20 })) },
    payoutAmount: { call: jest.fn(() => Promise.resolve({ toNumber: () => 0 })) },
    encryption: { call: jest.fn(() => Promise.resolve('')) },
    getAdmins: { call: jest.fn(() => Promise.resolve([])) },
    participants: { call: jest.fn(() => Promise.resolve(['', '0x0', false, false])) },
    participantsIndex: { call: jest.fn(() => Promise.resolve('0x0')) },
    register: jest.fn(() => Promise.resolve({ tx: '0x123' })),
    attend: jest.fn(() => Promise.resolve({ tx: '0x123' })),
    withdraw: jest.fn(() => Promise.resolve({ tx: '0x123' })),
    payback: jest.fn(() => Promise.resolve({ tx: '0x123' })),
    cancel: jest.fn(() => Promise.resolve({ tx: '0x123' })),
  };

  return Promise.resolve(mockInstance);
}

/**
 * Custom render function that wraps components with necessary providers
 */
export function renderWithProviders(ui, options = {}) {
  const {
    eventEmitter = createMockEventEmitter(),
    web3 = createMockWeb3(),
    ...renderOptions
  } = options;

  function Wrapper({ children }) {
    return (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    );
  }

  const result = render(ui, { wrapper: Wrapper, ...renderOptions });

  return {
    ...result,
    eventEmitter,
    web3,
  };
}

/**
 * Wait for async operations to complete, wrapped in act()
 */
export async function waitForAsync(ms = 0) {
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, ms));
  });
}

// Re-export everything from testing-library
export * from '@testing-library/react';
