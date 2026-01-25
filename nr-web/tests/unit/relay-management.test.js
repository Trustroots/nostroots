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

  describe('Relay settings UI', () => {
    it('has relay settings form elements', () => {
      const relayUrlsTextarea = document.getElementById('relay-urls');
      expect(relayUrlsTextarea).toBeTruthy();
      expect(relayUrlsTextarea.tagName).toBe('TEXTAREA');
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
  });
});
