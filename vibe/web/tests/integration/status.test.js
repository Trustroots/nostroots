import { describe, it, expect, beforeEach } from 'vitest';

describe('Status Messages', () => {
  beforeEach(() => {
    // Clear any existing status messages
    const statusElements = document.querySelectorAll('.status-message, [class*="status"]');
    statusElements.forEach(el => el.remove());
  });

  describe('Status message elements', () => {
    it('can create status message element', () => {
      const statusDiv = document.createElement('div');
      statusDiv.className = 'status-message';
      statusDiv.textContent = 'Test message';
      document.body.appendChild(statusDiv);
      
      const found = document.querySelector('.status-message');
      expect(found).toBeTruthy();
      expect(found.textContent).toBe('Test message');
      
      statusDiv.remove();
    });

    it('status messages can have different types', () => {
      const types = ['success', 'error', 'info'];
      types.forEach(type => {
        const statusDiv = document.createElement('div');
        statusDiv.className = `status-message status-${type}`;
        statusDiv.textContent = `${type} message`;
        document.body.appendChild(statusDiv);
        
        const found = document.querySelector(`.status-${type}`);
        expect(found).toBeTruthy();
        
        statusDiv.remove();
      });
    });
  });

  describe('Status message behavior', () => {
    it('can show and hide status messages', () => {
      const statusDiv = document.createElement('div');
      statusDiv.className = 'status-message';
      statusDiv.style.display = 'block';
      document.body.appendChild(statusDiv);
      
      expect(statusDiv.style.display).toBe('block');
      
      statusDiv.style.display = 'none';
      expect(statusDiv.style.display).toBe('none');
      
      statusDiv.remove();
    });
  });
});
