import { describe, it, expect, beforeEach } from 'vitest';

describe('Browser notifications', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('Notification plus codes storage', () => {
    const NOTIFICATION_PLUS_CODES_KEY = 'notification_plus_codes';

    it('stores and retrieves notification plus codes', () => {
      const codes = ['849VCWC8+2X', '849VCWC8+22'];
      localStorage.setItem(NOTIFICATION_PLUS_CODES_KEY, JSON.stringify(codes));
      const stored = JSON.parse(localStorage.getItem(NOTIFICATION_PLUS_CODES_KEY) || '[]');
      expect(stored).toEqual(codes);
    });

    it('handles empty list', () => {
      localStorage.setItem(NOTIFICATION_PLUS_CODES_KEY, JSON.stringify([]));
      const stored = JSON.parse(localStorage.getItem(NOTIFICATION_PLUS_CODES_KEY) || '[]');
      expect(stored).toEqual([]);
    });

    it('handles missing key', () => {
      expect(localStorage.getItem(NOTIFICATION_PLUS_CODES_KEY)).toBeNull();
    });
  });

  describe('Notifications enabled flag', () => {
    const NOTIFICATIONS_ENABLED_KEY = 'notifications_enabled';

    it('stores enabled state', () => {
      localStorage.setItem(NOTIFICATIONS_ENABLED_KEY, 'true');
      expect(localStorage.getItem(NOTIFICATIONS_ENABLED_KEY)).toBe('true');
    });

    it('stores disabled state', () => {
      localStorage.setItem(NOTIFICATIONS_ENABLED_KEY, 'false');
      expect(localStorage.getItem(NOTIFICATIONS_ENABLED_KEY)).toBe('false');
    });
  });

  describe('Notifications UI', () => {
    it('has settings notifications section', () => {
      const section = document.getElementById('settings-notifications-section');
      expect(section).toBeTruthy();
      expect(section.classList.contains('settings-section')).toBe(true);
    });

    it('has notification subscribe block in notes panel', () => {
      const block = document.getElementById('notification-subscribe-block');
      expect(block).toBeTruthy();
      expect(block.classList.contains('notification-subscribe-block')).toBe(true);
    });
  });
});
