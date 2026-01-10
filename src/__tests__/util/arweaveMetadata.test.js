/**
 * Tests for Arweave metadata fetching utilities
 */

import {
  arweaveUriToGatewayUrl,
  transformArweaveMetadata,
  clearMetadataCache,
} from '../../util/arweaveMetadata';

describe('arweaveMetadata', () => {
  beforeEach(() => {
    clearMetadataCache();
  });

  describe('arweaveUriToGatewayUrl', () => {
    it('converts ar:// URI to gateway URL', () => {
      const result = arweaveUriToGatewayUrl('ar://abc123xyz');
      expect(result).toBe('https://arweave.net/abc123xyz');
    });

    it('handles plain transaction ID', () => {
      const result = arweaveUriToGatewayUrl('abc123xyz');
      expect(result).toBe('https://arweave.net/abc123xyz');
    });

    it('returns full https URL unchanged', () => {
      const url = 'https://arweave.net/abc123xyz';
      const result = arweaveUriToGatewayUrl(url);
      expect(result).toBe(url);
    });

    it('returns null for empty input', () => {
      expect(arweaveUriToGatewayUrl('')).toBeNull();
      expect(arweaveUriToGatewayUrl(null)).toBeNull();
      expect(arweaveUriToGatewayUrl(undefined)).toBeNull();
    });
  });

  describe('transformArweaveMetadata', () => {
    it('transforms new schema to legacy format', () => {
      const arweaveMetadata = {
        name: 'Test Event',
        date: '2026-03-15T18:30:00Z',
        location: {
          name: 'Test Venue',
          address: '123 Main St',
          mapUrl: 'https://maps.google.com/?q=test',
        },
        description: 'Test description',
        images: {
          banner: 'ar://bannerTxId',
        },
        links: {
          website: 'https://example.com',
        },
      };

      const result = transformArweaveMetadata(arweaveMetadata);

      expect(result.date).toBe('2026-03-15T18:30:00Z');
      expect(result.map_url).toBe('https://maps.google.com/?q=test');
      expect(result.location_text).toBe('123 Main St');
      expect(result.description_text).toBe('Test description');
      expect(result.images.banner).toBe('https://arweave.net/bannerTxId');
      expect(result.links.website).toBe('https://example.com');
    });

    it('handles location with only name', () => {
      const arweaveMetadata = {
        location: {
          name: 'Test Venue',
        },
      };

      const result = transformArweaveMetadata(arweaveMetadata);
      expect(result.location_text).toBe('Test Venue');
    });

    it('handles location with legacy text field', () => {
      const arweaveMetadata = {
        location: {
          text: 'Legacy location text',
        },
      };

      const result = transformArweaveMetadata(arweaveMetadata);
      expect(result.location_text).toBe('Legacy location text');
    });

    it('returns null for null input', () => {
      expect(transformArweaveMetadata(null)).toBeNull();
      expect(transformArweaveMetadata(undefined)).toBeNull();
    });

    it('handles missing optional fields', () => {
      const arweaveMetadata = {
        name: 'Minimal Event',
      };

      const result = transformArweaveMetadata(arweaveMetadata);

      expect(result.date).toBeNull();
      expect(result.map_url).toBeNull();
      expect(result.location_text).toBeNull();
      expect(result.description_text).toBeNull();
      expect(result.images).toBeNull();
      expect(result.links).toBeNull();
    });

    it('converts multiple image URIs', () => {
      const arweaveMetadata = {
        images: {
          banner: 'ar://banner123',
          venue: 'ar://venue456',
          logo: 'https://example.com/logo.png',
        },
      };

      const result = transformArweaveMetadata(arweaveMetadata);

      expect(result.images.banner).toBe('https://arweave.net/banner123');
      expect(result.images.venue).toBe('https://arweave.net/venue456');
      expect(result.images.logo).toBe('https://example.com/logo.png');
    });
  });
});
