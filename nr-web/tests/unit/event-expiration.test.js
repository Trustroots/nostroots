import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { createMockMapNoteEvent } from '../fixtures/mock-events.js';

/**
 * Tests for event expiration functionality (NIP-40)
 * 
 * Events can have an 'expiration' tag containing a Unix timestamp.
 * Events are considered expired when the current time is past the expiration time.
 * 
 * Note: These tests focus on the logic that can be tested in unit tests.
 * Full expiration flow with UI updates is tested in E2E tests.
 */

// Helper to get current timestamp (matches index.html logic)
function getCurrentTimestamp() {
  return Math.floor(Date.now() / 1000);
}

// Helper to check if an event is expired (matches index.html isEventExpired)
function isEventExpired(event) {
  for (const tag of event.tags) {
    if (tag.length >= 2 && tag[0] === 'expiration') {
      const expirationTimestamp = parseInt(tag[1]);
      if (!isNaN(expirationTimestamp)) {
        const currentTimestamp = getCurrentTimestamp();
        return expirationTimestamp <= currentTimestamp;
      }
    }
  }
  return false;
}

// Helper to get expiration timestamp from event
function getExpirationTimestamp(event) {
  for (const tag of event.tags) {
    if (tag.length >= 2 && tag[0] === 'expiration') {
      const expirationTimestamp = parseInt(tag[1]);
      if (!isNaN(expirationTimestamp)) {
        return expirationTimestamp;
      }
    }
  }
  return null;
}

// Helper to get remaining time until expiration
function getRemainingTime(event) {
  const expirationTimestamp = getExpirationTimestamp(event);
  if (expirationTimestamp === null) {
    return null;
  }
  const currentTimestamp = getCurrentTimestamp();
  return expirationTimestamp - currentTimestamp;
}

// Helper to format remaining time for display
function formatRemainingTime(seconds) {
  if (seconds === null) return null;
  if (seconds <= 0) return 'expired';
  
  const days = Math.floor(seconds / (24 * 60 * 60));
  const hours = Math.floor((seconds % (24 * 60 * 60)) / (60 * 60));
  const minutes = Math.floor((seconds % (60 * 60)) / 60);
  
  if (days > 0) {
    return `${days}d ${hours}h`;
  } else if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else if (minutes > 0) {
    return `${minutes}m`;
  } else {
    return '<1m';
  }
}

// Helper to create event with expiration
function createEventWithExpiration(expirationTimestamp, overrides = {}) {
  const event = createMockMapNoteEvent(overrides);
  event.tags.push(['expiration', expirationTimestamp.toString()]);
  return event;
}

describe('Event Expiration (NIP-40)', () => {
  describe('isEventExpired', () => {
    it('should return false for events without expiration tag', () => {
      const event = createMockMapNoteEvent();
      expect(isEventExpired(event)).toBe(false);
    });

    it('should return false for events with future expiration', () => {
      const futureTimestamp = getCurrentTimestamp() + 3600; // 1 hour from now
      const event = createEventWithExpiration(futureTimestamp);
      expect(isEventExpired(event)).toBe(false);
    });

    it('should return true for events with past expiration', () => {
      const pastTimestamp = getCurrentTimestamp() - 3600; // 1 hour ago
      const event = createEventWithExpiration(pastTimestamp);
      expect(isEventExpired(event)).toBe(true);
    });

    it('should return true for events with expiration exactly at current time', () => {
      const currentTimestamp = getCurrentTimestamp();
      const event = createEventWithExpiration(currentTimestamp);
      expect(isEventExpired(event)).toBe(true);
    });

    it('should handle invalid expiration values gracefully', () => {
      const event = createMockMapNoteEvent();
      event.tags.push(['expiration', 'invalid']);
      expect(isEventExpired(event)).toBe(false);
    });

    it('should handle empty expiration tag', () => {
      const event = createMockMapNoteEvent();
      event.tags.push(['expiration']);
      expect(isEventExpired(event)).toBe(false);
    });

    it('should use the first expiration tag if multiple exist', () => {
      const futureTimestamp = getCurrentTimestamp() + 3600;
      const pastTimestamp = getCurrentTimestamp() - 3600;
      
      const event = createMockMapNoteEvent();
      event.tags.push(['expiration', futureTimestamp.toString()]);
      event.tags.push(['expiration', pastTimestamp.toString()]);
      
      // Should use first expiration tag (future)
      expect(isEventExpired(event)).toBe(false);
    });
  });

  describe('getExpirationTimestamp', () => {
    it('should return null for events without expiration tag', () => {
      const event = createMockMapNoteEvent();
      expect(getExpirationTimestamp(event)).toBeNull();
    });

    it('should return the expiration timestamp for events with valid tag', () => {
      const timestamp = getCurrentTimestamp() + 3600;
      const event = createEventWithExpiration(timestamp);
      expect(getExpirationTimestamp(event)).toBe(timestamp);
    });

    it('should return null for invalid expiration values', () => {
      const event = createMockMapNoteEvent();
      event.tags.push(['expiration', 'not-a-number']);
      expect(getExpirationTimestamp(event)).toBeNull();
    });

    it('should handle string timestamps correctly', () => {
      const timestamp = 1706270400; // A specific timestamp
      const event = createMockMapNoteEvent();
      event.tags.push(['expiration', timestamp.toString()]);
      expect(getExpirationTimestamp(event)).toBe(timestamp);
    });
  });

  describe('getRemainingTime', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should return null for events without expiration', () => {
      const event = createMockMapNoteEvent();
      expect(getRemainingTime(event)).toBeNull();
    });

    it('should return positive seconds for future expiration', () => {
      const now = Date.now();
      vi.setSystemTime(now);
      
      const futureTimestamp = Math.floor(now / 1000) + 3600;
      const event = createEventWithExpiration(futureTimestamp);
      
      const remaining = getRemainingTime(event);
      expect(remaining).toBeGreaterThan(0);
      expect(remaining).toBeLessThanOrEqual(3600);
    });

    it('should return zero or negative for past expiration', () => {
      const now = Date.now();
      vi.setSystemTime(now);
      
      const pastTimestamp = Math.floor(now / 1000) - 100;
      const event = createEventWithExpiration(pastTimestamp);
      
      const remaining = getRemainingTime(event);
      expect(remaining).toBeLessThanOrEqual(0);
    });
  });

  describe('formatRemainingTime', () => {
    it('should return null for null input', () => {
      expect(formatRemainingTime(null)).toBeNull();
    });

    it('should return "expired" for zero or negative values', () => {
      expect(formatRemainingTime(0)).toBe('expired');
      expect(formatRemainingTime(-100)).toBe('expired');
    });

    it('should format days and hours correctly', () => {
      const threeDaysTwoHours = 3 * 24 * 60 * 60 + 2 * 60 * 60;
      expect(formatRemainingTime(threeDaysTwoHours)).toBe('3d 2h');
    });

    it('should format hours and minutes correctly when less than a day', () => {
      const fiveHoursThirtyMinutes = 5 * 60 * 60 + 30 * 60;
      expect(formatRemainingTime(fiveHoursThirtyMinutes)).toBe('5h 30m');
    });

    it('should format minutes only when less than an hour', () => {
      const fortyFiveMinutes = 45 * 60;
      expect(formatRemainingTime(fortyFiveMinutes)).toBe('45m');
    });

    it('should return "<1m" for less than a minute', () => {
      expect(formatRemainingTime(30)).toBe('<1m');
      expect(formatRemainingTime(59)).toBe('<1m');
    });

    it('should handle exactly 1 day', () => {
      const oneDay = 24 * 60 * 60;
      expect(formatRemainingTime(oneDay)).toBe('1d 0h');
    });

    it('should handle exactly 1 hour', () => {
      const oneHour = 60 * 60;
      expect(formatRemainingTime(oneHour)).toBe('1h 0m');
    });

    it('should handle exactly 1 minute', () => {
      const oneMinute = 60;
      expect(formatRemainingTime(oneMinute)).toBe('1m');
    });

    it('should handle 7 days (typical default expiration)', () => {
      const sevenDays = 7 * 24 * 60 * 60;
      expect(formatRemainingTime(sevenDays)).toBe('7d 0h');
    });
  });

  describe('Expiration Tag Structure', () => {
    it('should have correct tag format for NIP-40', () => {
      const timestamp = getCurrentTimestamp() + 86400;
      const event = createEventWithExpiration(timestamp);
      
      const expirationTag = event.tags.find(tag => tag[0] === 'expiration');
      expect(expirationTag).toBeDefined();
      expect(expirationTag[0]).toBe('expiration');
      expect(expirationTag[1]).toBe(timestamp.toString());
    });

    it('should coexist with other tags', () => {
      const timestamp = getCurrentTimestamp() + 86400;
      const event = createEventWithExpiration(timestamp);
      
      // Original event should have location tags
      const locationTag = event.tags.find(tag => tag[0] === 'l');
      expect(locationTag).toBeDefined();
      
      // And expiration tag
      const expirationTag = event.tags.find(tag => tag[0] === 'expiration');
      expect(expirationTag).toBeDefined();
    });
  });

  describe('Event Filtering with Expiration', () => {
    it('should filter out expired events from a list', () => {
      const now = getCurrentTimestamp();
      const validEvent1 = createEventWithExpiration(now + 3600, { id: 'valid1' });
      const validEvent2 = createMockMapNoteEvent({ id: 'valid2' }); // No expiration
      const expiredEvent = createEventWithExpiration(now - 3600, { id: 'expired' });
      
      const events = [validEvent1, validEvent2, expiredEvent];
      const filtered = events.filter(event => !isEventExpired(event));
      
      expect(filtered).toHaveLength(2);
      expect(filtered.map(e => e.id)).toContain('valid1');
      expect(filtered.map(e => e.id)).toContain('valid2');
      expect(filtered.map(e => e.id)).not.toContain('expired');
    });

    it('should keep events without expiration tag', () => {
      const events = [
        createMockMapNoteEvent({ id: 'event1' }),
        createMockMapNoteEvent({ id: 'event2' }),
      ];
      
      const filtered = events.filter(event => !isEventExpired(event));
      expect(filtered).toHaveLength(2);
    });

    it('should handle empty events array', () => {
      const events = [];
      const filtered = events.filter(event => !isEventExpired(event));
      expect(filtered).toHaveLength(0);
    });
  });

  describe('Expiration Time Constants', () => {
    it('should have expected values for time constants', () => {
      const HOUR_IN_SECONDS = 60 * 60;
      const DAY_IN_SECONDS = 24 * 60 * 60;
      const WEEK_IN_SECONDS = 7 * 24 * 60 * 60;
      
      expect(HOUR_IN_SECONDS).toBe(3600);
      expect(DAY_IN_SECONDS).toBe(86400);
      expect(WEEK_IN_SECONDS).toBe(604800);
    });
  });
});
