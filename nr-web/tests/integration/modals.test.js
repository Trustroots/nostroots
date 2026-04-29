import { describe, it, expect, beforeEach } from 'vitest';

describe('Modal Behavior', () => {
  beforeEach(() => {
    // Reset modal states
    const modals = ['settings-modal', 'keys-modal', 'pluscode-notes-modal', 'circles-modal'];
    modals.forEach(id => {
      const modal = document.getElementById(id);
      if (modal) {
        modal.style.display = 'none';
      }
    });
  });

  describe('Settings Modal', () => {
    it('settings modal element exists', () => {
      const modal = document.getElementById('settings-modal');
      expect(modal).toBeTruthy();
    });

    it('has close button', () => {
      const modal = document.getElementById('settings-modal');
      const closeBtn = modal?.querySelector('.modal-close');
      expect(closeBtn).toBeTruthy();
    });

    it('has settings sections', () => {
      const modal = document.getElementById('settings-modal');
      const sections = modal?.querySelectorAll('.settings-section');
      expect(sections?.length).toBeGreaterThan(0);
    });
  });

  describe('Keys Modal', () => {
    it('keys modal element exists', () => {
      const modal = document.getElementById('keys-modal');
      expect(modal).toBeTruthy();
    });

    it('has key generation options', () => {
      const modal = document.getElementById('keys-modal');
      const generateBtn = modal?.querySelector('button[onclick*="onboardingGenerate"]');
      const importBtn = modal?.querySelector('button[onclick*="onboardingImport"]');
      
      expect(generateBtn).toBeTruthy();
      expect(importBtn).toBeTruthy();
    });

  });

  describe('Note Modals', () => {
    it('plus code notes modal exists', () => {
      const modal = document.getElementById('pluscode-notes-modal');
      expect(modal).toBeTruthy();
    });

    it('circles modal exists', () => {
      const modal = document.getElementById('circles-modal');
      expect(modal).toBeTruthy();
    });

    it('has note-related modal elements', () => {
      const plusCodeModal = document.getElementById('pluscode-notes-modal');
      expect(plusCodeModal).toBeTruthy();
    });
  });

  describe('Modal structure', () => {
    it('all modals have modal-content wrapper', () => {
      const modalIds = ['settings-modal', 'keys-modal', 'pluscode-notes-modal', 'circles-modal'];
      modalIds.forEach(id => {
        const modal = document.getElementById(id);
        expect(modal).toBeTruthy();
        const content = modal?.querySelector('.modal-content');
        expect(content).toBeTruthy();
      });
    });
  });

  describe('Injected modals (modals-keys-settings.html)', () => {
    it('keys modal has onboarding sections from fragment', () => {
      const keysModal = document.getElementById('keys-modal');
      expect(keysModal).toBeTruthy();
      expect(document.getElementById('keys-welcome-section')).toBeTruthy();
      expect(document.getElementById('keys-import-section')).toBeTruthy();
      expect(document.getElementById('keys-generate-section')).toBeTruthy();
      expect(document.getElementById('onboarding-import')).toBeTruthy();
    });

    it('keys modal includes guidance about nsec and password manager', () => {
      const keysModal = document.getElementById('keys-modal');
      const text = keysModal?.textContent || '';
      expect(text).toContain('Nostr private key');
      expect(text).toContain('Nostroots mobile app');
      expect(text).toContain('Bitwarden');
      expect(text).toContain('Export your nsec');
      expect(text).toContain('Update Trustroots Profile');
      expect(text).toContain('Enter your Trustroots username and verify it');
    });

    it('settings modal has relays section and GitHub link from fragment', () => {
      const settingsModal = document.getElementById('settings-modal');
      expect(settingsModal).toBeTruthy();
      expect(document.getElementById('relays-list')).toBeTruthy();
      expect(document.getElementById('new-relay-url')).toBeTruthy();
      const githubLink = settingsModal?.querySelector('a.github-icon-link[href*="github.com"]');
      expect(githubLink).toBeTruthy();
    });
  });
});
