/**
 * Arweave Upload Integration Tests
 *
 * These tests verify the arweaveUpload module's functionality and code paths.
 *
 * IMPORTANT: These tests run in Jest's Node.js environment, NOT in a browser.
 * The Irys SDK (@irys/web-upload) is designed for browser environments and
 * will not load in Node.js. Therefore:
 *
 * - Tests that verify SDK availability will correctly show SDK as unavailable
 * - The E2E tests (createEvent.spec.ts) verify actual browser bundling
 * - These tests verify the module's error handling and utility functions
 *
 * To verify Irys SDK bundling works in the browser, run:
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
      // The Irys web SDK is designed for browsers, not Node.js
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
    it('should catch errors when @irys/web-upload fails to import', async () => {
      // In Node.js, the browser SDK won't load
      // This verifies the error handling works correctly
      let importError = null;

      try {
        await import('@irys/web-upload');
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

    it('should catch errors when @irys/web-upload-ethereum fails to import', async () => {
      let importError = null;

      try {
        await import('@irys/web-upload-ethereum');
      } catch (error) {
        importError = error;
      }

      // We expect an error in Node.js environment
      expect(importError).not.toBeNull();
    });
  });

  describe('loadIrysSDK Error Handling', () => {
    it('getIrysUploader should throw meaningful error when SDK unavailable', async () => {
      // When the SDK can't be loaded, getIrysUploader should throw
      // a helpful error message pointing to the CLI tool
      let thrownError = null;

      try {
        await arweaveUpload.getIrysUploader({});
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
      expect(typeof arweaveUpload.getIrysUploader).toBe('function');
      expect(typeof arweaveUpload.uploadEventMetadata).toBe('function');
      expect(typeof arweaveUpload.uploadFile).toBe('function');
      expect(typeof arweaveUpload.uploadMetadataJson).toBe('function');
      expect(typeof arweaveUpload.getPrice).toBe('function');
      expect(typeof arweaveUpload.checkBalance).toBe('function');
      expect(typeof arweaveUpload.fundNode).toBe('function');
      expect(typeof arweaveUpload.calculateTotalSize).toBe('function');
      expect(typeof arweaveUpload.getUploadCost).toBe('function');
      expect(typeof arweaveUpload.arweaveUriToGatewayUrl).toBe('function');
      expect(typeof arweaveUpload.setDevnetMode).toBe('function');
    });

    it('should have a default export with all functions', () => {
      const defaultExport = arweaveUpload.default;
      expect(defaultExport).toBeDefined();
      expect(typeof defaultExport.isUploadAvailable).toBe('function');
      expect(typeof defaultExport.uploadEventMetadata).toBe('function');
    });
  });

  describe('Utility Functions (no SDK required)', () => {
    it('arweaveUriToGatewayUrl should convert ar:// URIs', () => {
      const result = arweaveUpload.arweaveUriToGatewayUrl('ar://abc123');
      expect(result).toBe('https://gateway.irys.xyz/abc123');
    });

    it('arweaveUriToGatewayUrl should handle plain transaction IDs', () => {
      const result = arweaveUpload.arweaveUriToGatewayUrl('abc123');
      expect(result).toBe('https://gateway.irys.xyz/abc123');
    });

    it('arweaveUriToGatewayUrl should return null for empty input', () => {
      expect(arweaveUpload.arweaveUriToGatewayUrl('')).toBeNull();
      expect(arweaveUpload.arweaveUriToGatewayUrl(null)).toBeNull();
      expect(arweaveUpload.arweaveUriToGatewayUrl(undefined)).toBeNull();
    });

    it('arweaveUriToGatewayUrl should pass through https URLs', () => {
      const url = 'https://gateway.irys.xyz/existing';
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

    it('setDevnetMode should not throw in Node.js environment', () => {
      // Even without localStorage, the function should handle gracefully
      expect(() => {
        arweaveUpload.setDevnetMode(true);
      }).not.toThrow();

      expect(() => {
        arweaveUpload.setDevnetMode(false);
      }).not.toThrow();
    });
  });
});
