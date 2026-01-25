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

    it('onboarding nsec input exists', () => {
      const input = document.getElementById('onboarding-nsec');
      expect(input).toBeTruthy();
    });
  });

  describe('Relay Settings Form', () => {
    it('relay URLs textarea exists', () => {
      const textarea = document.getElementById('relay-urls');
      expect(textarea).toBeTruthy();
      expect(textarea.tagName).toBe('TEXTAREA');
    });

    it('can set and get relay URLs', () => {
      const textarea = document.getElementById('relay-urls');
      const testUrls = 'wss://relay1.com\nwss://relay2.com';
      textarea.value = testUrls;
      expect(textarea.value).toBe(testUrls);
    });

    it('has save button', () => {
      const textarea = document.getElementById('relay-urls');
      const button = textarea?.parentElement?.querySelector('button[onclick*="saveRelays"]');
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

    it('has link profile button', () => {
      const button = document.getElementById('link-profile-btn');
      expect(button).toBeTruthy();
    });

    it('has username indicator element', () => {
      const indicator = document.getElementById('username-nostr-indicator');
      expect(indicator).toBeTruthy();
    });
  });
});
