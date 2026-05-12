import { describe, it, expect, beforeEach } from 'vitest';

describe('Modal Behavior', () => {
  beforeEach(() => {
    // Reset modal states
    const modals = ['settings-modal', 'keys-modal', 'circles-modal'];
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

    it('labels dark mode as experimental', () => {
      const label = document.querySelector('label[for="theme-toggle"]');
      expect(label?.textContent).toContain('Dark mode (experimental)');
    });

    it('orders notifications first and appearance last', () => {
      const sections = Array.from(document.querySelectorAll('#settings-modal .modal-content > .settings-section'));
      expect(sections[0]?.id).toBe('settings-notifications-section');
      expect(sections.at(-1)?.querySelector('h2')?.textContent).toBe('Appearance');
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

    it('claim section includes relay scope row for publish targets', () => {
      expect(document.getElementById('claim-relay-scope')).toBeTruthy();
    });

  });

  describe('Host & Meet page', () => {
    it('host page shell exists', () => {
      expect(document.getElementById('nr-host-view')).toBeTruthy();
      expect(document.getElementById('pluscode-notes-modal')).toBeTruthy();
    });

    it('circles modal exists', () => {
      const modal = document.getElementById('circles-modal');
      expect(modal).toBeTruthy();
    });

    it('has note-related page elements', () => {
      expect(document.getElementById('pluscode-notes-content')).toBeTruthy();
      expect(document.getElementById('note-content-in-modal')).toBeTruthy();
    });
  });

  describe('Modal structure', () => {
    it('all modals have modal-content wrapper', () => {
      const modalIds = ['settings-modal', 'keys-modal', 'circles-modal'];
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
      expect(document.getElementById('keys-welcome-modal-title')).toBeTruthy();
      expect(document.getElementById('keys-import-section')).toBeTruthy();
      expect(document.getElementById('keys-generate-section')).toBeTruthy();
      expect(document.getElementById('keys-generate-intro')).toBeTruthy();
      expect(document.getElementById('onboarding-import')).toBeTruthy();
    });

    it('keys modal includes guidance about nsec and password manager', () => {
      const keysModal = document.getElementById('keys-modal');
      const text = keysModal?.textContent || '';
      expect(text).toContain('open protocols');
      expect(text).toContain('rebuilds Trustroots');
      expect(text).toContain('secret key (nsec)');
      expect(text).toContain('public address');
      expect(text).toContain('never stored on our server');
      expect(text).toContain('Bitwarden');
      expect(text).toContain('Back up your secret key');
      expect(text).toContain('Update Trustroots Profile');
      expect(text).toContain('Enter your Trustroots username to confirm this account is yours.');
      expect(text).toContain('links your Trustroots account');
    });

    it('settings modal has relays section and GitHub link from fragment', () => {
      const settingsModal = document.getElementById('settings-modal');
      expect(settingsModal).toBeTruthy();
      expect(document.getElementById('relays-list')).toBeTruthy();
      expect(document.getElementById('new-relay-url')).toBeTruthy();
      expect(document.getElementById('settings-last-commit-datetime')).toBeTruthy();
      expect(document.getElementById('settings-last-deploy-datetime')).toBeTruthy();
      const githubLink = settingsModal?.querySelector('a.github-icon-link[href*="github.com"]');
      expect(githubLink).toBeTruthy();
    });
  });
});
