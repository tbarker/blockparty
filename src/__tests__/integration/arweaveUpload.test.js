/**
 * Arweave Upload Integration Tests
 *
 * These tests verify the arweaveUpload module's functionality and code paths.
 *
 * IMPORTANT: These tests run in Jest's Node.js environment, NOT in a browser.
 * The ArDrive Turbo SDK (@ardrive/turbo-sdk/web) is designed for browser environments
 * and will not load in Node.js. Therefore:
 *
 * - Tests that verify SDK availability will correctly show SDK as unavailable
 * - The E2E tests (createEvent.spec.ts) verify actual browser bundling
 * - These tests verify the module's error handling and utility functions
 *
 * To verify Turbo SDK bundling works in the browser, run:
 *   npm run test:e2e
 *
 * The E2E test "should verify Arweave upload is available when filling metadata fields"
 * specifically checks that the webpack-bundled SDK loads correctly in Chrome.
 */

// Import the actual module without mocking
const arweaveUpload = require('../../util/arweaveUpload');

// Polyfill TextEncoder for Node.js environment (needed by calculateTotalSize)
const { TextEncoder } = require('util');
global.TextEncoder = TextEncoder;

describe('Arweave Upload Integration Tests', () => {
  describe('isUploadAvailable', () => {
    it('should return a boolean indicating SDK availability', async () => {
      // Call the real isUploadAvailable function without mocking
      const result = await arweaveUpload.isUploadAvailable();

      // Result should be a boolean
      expect(typeof result).toBe('boolean');
    });

    it('should return false in Node.js environment (SDK is browser-only)', async () => {
      // The ArDrive Turbo web SDK is designed for browsers, not Node.js
      // In Jest (Node.js), the dynamic import will fail, returning false
      // This is expected behavior - the E2E tests verify browser bundling
      const isAvailable = await arweaveUpload.isUploadAvailable();

      // In Node.js, the browser SDK won't load
      expect(isAvailable).toBe(false);
    });

    it('should be callable multiple times without error', async () => {
      // Verify the function is idempotent and doesn't cause issues
      // when called multiple times (as happens in React component lifecycle)
      const result1 = await arweaveUpload.isUploadAvailable();
      const result2 = await arweaveUpload.isUploadAvailable();
      const result3 = await arweaveUpload.isUploadAvailable();

      expect(result1).toBe(result2);
      expect(result2).toBe(result3);
    });

    it('should gracefully handle import failures', async () => {
      // The function should never throw - it should catch errors and return false
      // This tests the error handling path
      let threw = false;
      try {
        await arweaveUpload.isUploadAvailable();
      } catch {
        threw = true;
      }
      expect(threw).toBe(false);
    });
  });

  describe('SDK Dynamic Import Error Handling', () => {
    it('should catch errors when @ardrive/turbo-sdk/web fails to import', async () => {
      // In Node.js, the browser SDK won't load
      // This verifies the error handling works correctly
      let importError = null;

      try {
        await import('@ardrive/turbo-sdk/web');
      } catch (error) {
        importError = error;
      }

      // We expect an error in Node.js environment
      // The important thing is that isUploadAvailable() handles this gracefully
      expect(importError).not.toBeNull();

      // And isUploadAvailable should return false, not throw
      const result = await arweaveUpload.isUploadAvailable();
      expect(result).toBe(false);
    });
  });

  describe('loadTurboSDK Error Handling', () => {
    it('getTurboUploader should throw meaningful error when SDK unavailable', async () => {
      // When the SDK can't be loaded, getTurboUploader should throw
      // a helpful error message pointing to the CLI tool
      let thrownError = null;

      try {
        await arweaveUpload.getTurboUploader({});
      } catch (error) {
        thrownError = error;
      }

      expect(thrownError).not.toBeNull();
      expect(thrownError.message).toContain('Arweave upload is not available');
      expect(thrownError.message).toContain('command-line tool');
    });

  });

  describe('Module Exports', () => {
    it('should export all required functions', () => {
      // Verify the module exports the expected API
      expect(typeof arweaveUpload.isUploadAvailable).toBe('function');
      expect(typeof arweaveUpload.getTurboUploader).toBe('function');
      expect(typeof arweaveUpload.uploadEventMetadata).toBe('function');
      expect(typeof arweaveUpload.uploadFile).toBe('function');
      expect(typeof arweaveUpload.uploadMetadataJson).toBe('function');
      expect(typeof arweaveUpload.getPrice).toBe('function');
      expect(typeof arweaveUpload.calculateTotalSize).toBe('function');
      expect(typeof arweaveUpload.getUploadCost).toBe('function');
      expect(typeof arweaveUpload.arweaveUriToGatewayUrl).toBe('function');
      expect(typeof arweaveUpload.setDevnetMode).toBe('function');
      expect(typeof arweaveUpload.waitForArweaveConfirmation).toBe('function');
    });

    it('should have a default export with all functions', () => {
      const defaultExport = arweaveUpload.default;
      expect(defaultExport).toBeDefined();
      expect(typeof defaultExport.isUploadAvailable).toBe('function');
      expect(typeof defaultExport.uploadEventMetadata).toBe('function');
      expect(typeof defaultExport.waitForArweaveConfirmation).toBe('function');
    });
  });

  describe('Utility Functions (no SDK required)', () => {
    it('arweaveUriToGatewayUrl should convert ar:// URIs', () => {
      const result = arweaveUpload.arweaveUriToGatewayUrl('ar://abc123');
      expect(result).toBe('https://arweave.net/abc123');
    });

    it('arweaveUriToGatewayUrl should handle plain transaction IDs', () => {
      const result = arweaveUpload.arweaveUriToGatewayUrl('abc123');
      expect(result).toBe('https://arweave.net/abc123');
    });

    it('arweaveUriToGatewayUrl should return null for empty input', () => {
      expect(arweaveUpload.arweaveUriToGatewayUrl('')).toBeNull();
      expect(arweaveUpload.arweaveUriToGatewayUrl(null)).toBeNull();
      expect(arweaveUpload.arweaveUriToGatewayUrl(undefined)).toBeNull();
    });

    it('arweaveUriToGatewayUrl should pass through https URLs', () => {
      const url = 'https://arweave.net/existing';
      expect(arweaveUpload.arweaveUriToGatewayUrl(url)).toBe(url);
    });

    it('calculateTotalSize should calculate metadata size', () => {
      const metadata = {
        name: 'Test Event',
        description: 'A test event',
      };
      const size = arweaveUpload.calculateTotalSize(metadata);
      expect(size).toBeGreaterThan(0);
      expect(typeof size).toBe('number');
    });

    it('calculateTotalSize should return consistent results', () => {
      const metadata = { name: 'Test', value: 123 };
      const size1 = arweaveUpload.calculateTotalSize(metadata);
      const size2 = arweaveUpload.calculateTotalSize(metadata);
      expect(size1).toBe(size2);
    });

    it('calculateTotalSize should handle empty metadata', () => {
      const size = arweaveUpload.calculateTotalSize({});
      expect(size).toBeGreaterThan(0); // Even {} has some JSON representation
    });

    it('calculateTotalSize should handle complex metadata', () => {
      const metadata = {
        name: 'Complex Event',
        date: '2026-01-01T00:00:00Z',
        location: {
          name: 'Venue',
          address: '123 Main St',
        },
        images: {
          banner: 'ar://abc123',
        },
      };
      const size = arweaveUpload.calculateTotalSize(metadata);
      expect(size).toBeGreaterThan(100); // Complex metadata should be reasonably sized
    });
  });

  describe('Devnet Mode', () => {
    // Note: setDevnetMode uses localStorage which isn't available in Node
    // but the function should handle this gracefully

    beforeEach(() => {
      // Clear localStorage before each test
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem('turbo_devnet');
      }
    });

    it('setDevnetMode should not throw in Node.js environment', () => {
      // Even without localStorage, the function should handle gracefully
      expect(() => {
        arweaveUpload.setDevnetMode(true);
      }).not.toThrow();

      expect(() => {
        arweaveUpload.setDevnetMode(false);
      }).not.toThrow();
    });

    it('shouldUseDevnet should return true for local chain IDs', () => {
      // Access shouldUseDevnet from default export
      const shouldUseDevnet = arweaveUpload.default.shouldUseDevnet;

      // Chain ID 1337 (Anvil) should use devnet
      expect(shouldUseDevnet('1337')).toBe(true);

      // Chain ID 31337 (Hardhat) should use devnet
      expect(shouldUseDevnet('31337')).toBe(true);

      // Sepolia should use devnet
      expect(shouldUseDevnet('11155111')).toBe(true);

      // Mainnet should NOT use devnet
      expect(shouldUseDevnet('1')).toBe(false);
    });
  });

  describe('waitForArweaveConfirmation', () => {
    // Mock global fetch
    let originalFetch;

    beforeEach(() => {
      originalFetch = global.fetch;
    });

    afterEach(() => {
      global.fetch = originalFetch;
    });

    it('should return true immediately for null/empty metadataUri', async () => {
      const result1 = await arweaveUpload.waitForArweaveConfirmation(null);
      const result2 = await arweaveUpload.waitForArweaveConfirmation('');
      const result3 = await arweaveUpload.waitForArweaveConfirmation(undefined);

      expect(result1).toBe(true);
      expect(result2).toBe(true);
      expect(result3).toBe(true);
    });

    it('should return true when gateway returns 200 OK', async () => {
      global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200 });

      const result = await arweaveUpload.waitForArweaveConfirmation('ar://test123', {
        maxAttempts: 3,
        intervalMs: 10,
      });

      expect(result).toBe(true);
      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(global.fetch).toHaveBeenCalledWith('https://arweave.net/test123', {
        method: 'HEAD',
      });
    });

    it('should retry on 404 until success', async () => {
      let callCount = 0;
      global.fetch = jest.fn().mockImplementation(() => {
        callCount++;
        if (callCount < 3) {
          return Promise.resolve({ ok: false, status: 404 });
        }
        return Promise.resolve({ ok: true, status: 200 });
      });

      const result = await arweaveUpload.waitForArweaveConfirmation('ar://test123', {
        maxAttempts: 5,
        intervalMs: 10,
      });

      expect(result).toBe(true);
      expect(global.fetch).toHaveBeenCalledTimes(3);
    });

    it('should return false when max attempts exceeded', async () => {
      global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 404 });

      const result = await arweaveUpload.waitForArweaveConfirmation('ar://test123', {
        maxAttempts: 3,
        intervalMs: 10,
      });

      expect(result).toBe(false);
      expect(global.fetch).toHaveBeenCalledTimes(3);
    });

    it('should call onProgress callback with attempt info', async () => {
      let callCount = 0;
      global.fetch = jest.fn().mockImplementation(() => {
        callCount++;
        if (callCount < 2) {
          return Promise.resolve({ ok: false, status: 404 });
        }
        return Promise.resolve({ ok: true, status: 200 });
      });

      const progressCalls = [];
      const onProgress = progress => progressCalls.push(progress);

      await arweaveUpload.waitForArweaveConfirmation('ar://test123', {
        maxAttempts: 5,
        intervalMs: 10,
        onProgress,
      });

      // Progress is called after each failed attempt before retry
      expect(progressCalls.length).toBe(1); // Only called on failed attempts before success
      expect(progressCalls[0]).toEqual({
        attempt: 1,
        maxAttempts: 5,
        uri: 'ar://test123',
      });
    });

    it('should handle fetch errors gracefully and retry', async () => {
      let callCount = 0;
      global.fetch = jest.fn().mockImplementation(() => {
        callCount++;
        if (callCount < 2) {
          return Promise.reject(new Error('Network error'));
        }
        return Promise.resolve({ ok: true, status: 200 });
      });

      const result = await arweaveUpload.waitForArweaveConfirmation('ar://test123', {
        maxAttempts: 5,
        intervalMs: 10,
      });

      expect(result).toBe(true);
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it('should handle plain transaction ID without ar:// prefix', async () => {
      global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200 });

      await arweaveUpload.waitForArweaveConfirmation('plainTxId123', {
        maxAttempts: 3,
        intervalMs: 10,
      });

      expect(global.fetch).toHaveBeenCalledWith('https://arweave.net/plainTxId123', {
        method: 'HEAD',
      });
    });

    it('should skip confirmation check when networkId indicates devnet', async () => {
      global.fetch = jest.fn();

      // Clear any localStorage setting that might override network detection
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem('turbo_devnet');
      }

      // Chain ID 1337 (local anvil) should trigger devnet mode
      const result = await arweaveUpload.waitForArweaveConfirmation('ar://test123', {
        maxAttempts: 3,
        intervalMs: 10,
        networkId: '1337',
      });

      // Should return true immediately without making fetch requests
      expect(result).toBe(true);
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should still check gateway when networkId indicates mainnet', async () => {
      global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200 });

      // Chain ID 1 (mainnet) should NOT trigger devnet mode
      const result = await arweaveUpload.waitForArweaveConfirmation('ar://test123', {
        maxAttempts: 3,
        intervalMs: 10,
        networkId: '1',
      });

      expect(result).toBe(true);
      expect(global.fetch).toHaveBeenCalled();
    });
  });
});
