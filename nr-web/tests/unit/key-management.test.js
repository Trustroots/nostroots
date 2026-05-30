import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * Note: Many key management functions are in the module script and use CDN imports.
 * These tests focus on what can be tested in unit/integration context.
 * Full functionality should be tested via E2E tests.
 */
describe('Key Management', () => {
  beforeEach(() => {
    localStorage.clear();
    // Reset any global state
    if (window.currentPrivateKey) window.currentPrivateKey = null;
    if (window.currentPublicKey) window.currentPublicKey = null;
  });

  describe('localStorage operations', () => {
    it('can store and retrieve private key', () => {
      const testKey = 'a'.repeat(64); // 64 char hex string
      localStorage.setItem('nostr_private_key', testKey);
      expect(localStorage.getItem('nostr_private_key')).toBe(testKey);
    });

    it('can remove private key', () => {
      localStorage.setItem('nostr_private_key', 'test');
      localStorage.removeItem('nostr_private_key');
      expect(localStorage.getItem('nostr_private_key')).toBeNull();
    });

    it('handles missing key gracefully', () => {
      expect(localStorage.getItem('nostr_private_key')).toBeNull();
    });
  });

  describe('Key display elements', () => {
    it('has required DOM elements for key management', () => {
      const nsecImport = document.getElementById('nsec-import');
      const npubDisplay = document.getElementById('npub-display');
      const copyBtn = document.getElementById('copy-npub-btn');
      
      expect(nsecImport).toBeTruthy();
      expect(npubDisplay).toBeTruthy();
      expect(copyBtn).toBeTruthy();
    });

    it('has onboarding elements', () => {
      const onboardingImport = document.getElementById('onboarding-import');
      const keysModal = document.getElementById('keys-modal');
      
      expect(onboardingImport).toBeTruthy();
      expect(keysModal).toBeTruthy();
    });

    it('renumbers onboarding options when no NIP-07 extension is available', () => {
      window.NrWebKeysModal.openKeysModal({ hasKey: false });
      window.NrWebKeysModal.updateKeyDisplay({
        hasNsec: false,
        hasPublicKey: false,
        nip7Status: 'none',
        signerMode: 'local',
      });

      expect(document.getElementById('keys-nip7-section').style.display).toBe('none');
      expect(document.getElementById('keys-import-heading').textContent).toBe('Option 1: Import an existing key');
      expect(document.getElementById('keys-generate-heading').textContent).toBe('Option 2: Generate a new key');
      expect(document.getElementById('keys-onboarding-intro').textContent).not.toContain('browser extension');

      const statusLinks = Array.from(document.querySelectorAll('#keys-signer-status a'));
      expect(statusLinks.map((link) => link.textContent)).toEqual(['Alby', 'nos2x']);
      expect(statusLinks[0].href).toBe('https://guides.getalby.com/user-guide/browser-extension/faq/how-do-i-install-the-alby-browser-extension');
      expect(statusLinks[1].href).toBe('https://chromewebstore.google.com/detail/nos2x/kpgefcfmnafjgpblomihpgmejjdanjjp');
      expect(statusLinks.every((link) => link.target === '_blank')).toBe(true);
      expect(statusLinks.every((link) => link.rel === 'noopener noreferrer')).toBe(true);
    });

    it('keeps browser extension as the first onboarding option when available', () => {
      window.NrWebKeysModal.openKeysModal({ hasKey: false });
      window.NrWebKeysModal.updateKeyDisplay({
        hasNsec: false,
        hasPublicKey: false,
        nip7Status: 'full',
        signerMode: 'local',
      });

      expect(document.getElementById('keys-nip7-section').style.display).toBe('block');
      expect(document.getElementById('keys-nip7-heading').textContent).toBe('Option 1: Connect browser extension');
      expect(document.getElementById('keys-import-heading').textContent).toBe('Option 2: Import an existing key');
      expect(document.getElementById('keys-generate-heading').textContent).toBe('Option 3: Generate a new key');
      expect(document.getElementById('keys-onboarding-intro').textContent).toContain('browser extension');
    });

    it('clearly explains Trustroots account linking when a key exists without NIP-05', () => {
      window.NrWebKeysModal.openKeysModal({ hasKey: true });
      window.NrWebKeysModal.updateKeyDisplay({
        hasNsec: true,
        hasPublicKey: true,
        isProfileLinked: false,
        isUsernameLinked: false,
      });

      const note = document.getElementById('keys-trustroots-needed-note');
      expect(note.style.display).toBe('block');
      expect(note.textContent).toContain('To fully use Nostroots');
      expect(note.textContent).toContain('Trustroots account');
      expect(note.textContent).toContain('nip42.trustroots.org');
      expect(note.querySelector('a')?.href).toBe('https://www.trustroots.org/signup');
      expect(document.getElementById('keys-username-guidance-text').textContent).toContain('unlock full Nostroots access');
    });
  });
});
