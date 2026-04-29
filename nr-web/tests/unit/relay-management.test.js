import { describe, it, expect, beforeEach } from 'vitest';

describe('Relay Management', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('Relay URL storage', () => {
    it('can store relay URLs in localStorage', () => {
      const relays = ['wss://relay1.example.com', 'wss://relay2.example.com'];
      localStorage.setItem('relay_urls', JSON.stringify(relays));
      
      const stored = JSON.parse(localStorage.getItem('relay_urls') || '[]');
      expect(stored).toEqual(relays);
    });

    it('handles empty relay list', () => {
      localStorage.setItem('relay_urls', JSON.stringify([]));
      const stored = JSON.parse(localStorage.getItem('relay_urls') || '[]');
      expect(stored).toEqual([]);
    });

    it('handles missing relay URLs', () => {
      expect(localStorage.getItem('relay_urls')).toBeNull();
    });
  });

  describe('Relay write preference storage', () => {
    it('stores and reads per-relay post preferences', () => {
      const preferences = {
        'wss://relay.trustroots.org': true,
        'wss://nip42.trustroots.org': false,
      };
      localStorage.setItem('relay_write_enabled', JSON.stringify(preferences));

      const stored = JSON.parse(localStorage.getItem('relay_write_enabled') || '{}');
      expect(stored).toEqual(preferences);
      expect(stored['wss://nip42.trustroots.org']).toBe(false);
    });

    it('defaults to post disabled for public relays when no preference is saved', () => {
      const saved = { 'wss://relay.trustroots.org': false };
      localStorage.setItem('relay_write_enabled', JSON.stringify(saved));

      const stored = JSON.parse(localStorage.getItem('relay_write_enabled') || '{}');
      const relayUrl = 'wss://relay.nomadwiki.org';
      const isPublicRelay = relayUrl === 'wss://relay.trustroots.org' || relayUrl === 'wss://relay.nomadwiki.org';
      const canPost = Object.prototype.hasOwnProperty.call(stored, relayUrl)
        ? stored[relayUrl] !== false
        : !isPublicRelay;
      expect(canPost).toBe(false);
    });

    it('handles missing relay write preferences', () => {
      expect(localStorage.getItem('relay_write_enabled')).toBeNull();
    });
  });

  describe('Relay settings UI', () => {
    it('has relay settings form elements', () => {
      const relaysList = document.getElementById('relays-list');
      expect(relaysList).toBeTruthy();
      
      const newRelayInput = document.getElementById('new-relay-url');
      expect(newRelayInput).toBeTruthy();
      expect(newRelayInput.tagName).toBe('INPUT');
    });
  });

  describe('URL validation', () => {
    it('validates WebSocket URLs', () => {
      const validUrls = [
        'wss://relay.example.com',
        'ws://localhost:8080',
        'wss://relay.trustroots.org',
      ];
      
      const invalidUrls = [
        'http://example.com',
        'not-a-url',
        'ftp://example.com',
      ];

      validUrls.forEach(url => {
        expect(url.startsWith('ws://') || url.startsWith('wss://')).toBe(true);
      });

      invalidUrls.forEach(url => {
        expect(url.startsWith('ws://') || url.startsWith('wss://')).toBe(false);
      });
    });

    it('detects loopback relay hosts for local privacy hint', () => {
      const localRelayUrls = [
        'ws://localhost:8042',
        'ws://127.0.0.1:8042',
        'ws://[::1]:8042',
      ];
      const remoteRelayUrls = [
        'wss://relay.trustroots.org',
        'wss://relay.nomadwiki.org',
      ];

      localRelayUrls.forEach(url => {
        const parsed = new URL(url);
        const isLocal = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1' || parsed.hostname === '::1' || parsed.hostname === '[::1]';
        expect(isLocal).toBe(true);
      });

      remoteRelayUrls.forEach(url => {
        const parsed = new URL(url);
        const isLocal = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1' || parsed.hostname === '::1' || parsed.hostname === '[::1]';
        expect(isLocal).toBe(false);
      });
    });
  });
});
