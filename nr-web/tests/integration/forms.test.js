import { describe, it, expect, beforeEach } from 'vitest';

describe('Form Interactions', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('Key Import Form', () => {
    it('nsec import input exists', () => {
      const input = document.getElementById('nsec-import');
      expect(input).toBeTruthy();
      expect(input.type).toBe('text');
    });

    it('can set and get nsec input value', () => {
      const input = document.getElementById('nsec-import');
      const testValue = 'nsec1test';
      input.value = testValue;
      expect(input.value).toBe(testValue);
    });

    it('has import button', () => {
      const input = document.getElementById('nsec-import');
      const button = input?.parentElement?.querySelector('button[onclick*="importNsec"]');
      expect(button).toBeTruthy();
    });

    it('onboarding import textarea exists', () => {
      const textarea = document.getElementById('onboarding-import');
      expect(textarea).toBeTruthy();
      expect(textarea.tagName).toBe('TEXTAREA');
    });
  });

  describe('Relay Settings Form', () => {
    it('relays list container exists', () => {
      const container = document.getElementById('relays-list');
      expect(container).toBeTruthy();
    });

    it('new relay URL input exists', () => {
      const input = document.getElementById('new-relay-url');
      expect(input).toBeTruthy();
      expect(input.tagName).toBe('INPUT');
    });

    it('can set and get new relay URL input', () => {
      const input = document.getElementById('new-relay-url');
      const testUrl = 'wss://relay1.com';
      input.value = testUrl;
      expect(input.value).toBe(testUrl);
    });

    it('has add relay button', () => {
      const input = document.getElementById('new-relay-url');
      const button = input?.parentElement?.querySelector('button[onclick*="addRelay"]');
      expect(button).toBeTruthy();
    });
  });

  describe('Username Linking Form', () => {
    it('username input exists', () => {
      const input = document.getElementById('trustroots-username');
      expect(input).toBeTruthy();
      expect(input.type).toBe('text');
    });

    it('can set and get username', () => {
      const input = document.getElementById('trustroots-username');
      const testUsername = 'testuser';
      input.value = testUsername;
      expect(input.value).toBe(testUsername);
    });

    it('username input triggers link on Enter', () => {
      const input = document.getElementById('trustroots-username');
      // Link profile button was removed, but Enter key on username input triggers linkTrustrootsProfile
      expect(input.getAttribute('onkeydown')).toContain('linkTrustrootsProfile');
    });

    it('has username indicator element', () => {
      const indicator = document.getElementById('username-nostr-indicator');
      expect(indicator).toBeTruthy();
    });
  });
});
