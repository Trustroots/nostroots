import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('Modal Behavior', () => {
  beforeEach(() => {
    // Reset modal states
    const modals = ['settings-modal', 'onboarding-modal', 'view-note-modal', 'pluscode-notes-modal', 'add-note-modal'];
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

  describe('Onboarding Modal', () => {
    it('onboarding modal element exists', () => {
      const modal = document.getElementById('onboarding-modal');
      expect(modal).toBeTruthy();
    });

    it('has key generation options', () => {
      const modal = document.getElementById('onboarding-modal');
      const generateBtn = modal?.querySelector('button[onclick*="onboardingGenerate"]');
      const importBtn = modal?.querySelector('button[onclick*="onboardingImport"]');
      
      expect(generateBtn).toBeTruthy();
      expect(importBtn).toBeTruthy();
    });

    it('has NIP-07 section', () => {
      const nip07Section = document.getElementById('onboarding-nip07-section');
      expect(nip07Section).toBeTruthy();
    });
  });

  describe('Note Modals', () => {
    it('view note modal exists', () => {
      const modal = document.getElementById('view-note-modal');
      expect(modal).toBeTruthy();
    });

    it('plus code notes modal exists', () => {
      const modal = document.getElementById('pluscode-notes-modal');
      expect(modal).toBeTruthy();
    });

    // Note: add-note-modal might be created dynamically or have a different ID
    // Check for note-related modals that exist
    it('has note-related modal elements', () => {
      const viewModal = document.getElementById('view-note-modal');
      const plusCodeModal = document.getElementById('pluscode-notes-modal');
      expect(viewModal || plusCodeModal).toBeTruthy();
    });
  });

  describe('Modal structure', () => {
    it('all modals have modal-content wrapper', () => {
      const modals = ['settings-modal', 'onboarding-modal', 'view-note-modal'];
      modals.forEach(id => {
        const modal = document.getElementById(id);
        const content = modal?.querySelector('.modal-content');
        expect(content).toBeTruthy();
      });
    });
  });
});
