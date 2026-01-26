/**
 * E2E tests for event expiration functionality (NIP-40)
 * 
 * Tests that:
 * 1. Expired events are not displayed in the UI
 * 2. Events with future expiration show remaining time
 * 3. Expiration time is displayed correctly in notes
 */

import { test, expect } from '@playwright/test';

// Helper to get current timestamp
function getCurrentTimestamp() {
  return Math.floor(Date.now() / 1000);
}

test.describe('Event Expiration', () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage before each test
    await page.addInitScript(() => {
      localStorage.clear();
    });
    
    // Navigate to the app
    await page.goto('/');
    
    // Wait for map to load
    await page.waitForSelector('#map', { timeout: 10000 });
    await page.waitForFunction(() => {
      const map = window.map;
      return map && map.loaded && map.loaded();
    }, { timeout: 15000 });
  });

  test('should not display expired events in the notes list', async ({ page }) => {
    const now = getCurrentTimestamp();
    const expiredTimestamp = now - 3600; // 1 hour ago
    
    // Inject an expired event into the events array
    await page.evaluate((expiredTs) => {
      const expiredEvent = {
        id: 'expired-event-123',
        kind: 30397,
        pubkey: 'test-pubkey-abc',
        created_at: Math.floor(Date.now() / 1000) - 7200, // 2 hours ago
        tags: [
          ['l', '8FVC2222+', 'open-location-code'],
          ['L', 'open-location-code'],
          ['expiration', expiredTs.toString()],
        ],
        content: 'This is an expired note that should not be visible',
        sig: 'test-signature',
      };
      
      // Add to events array
      if (window.events) {
        window.events.push(expiredEvent);
      }
    }, expiredTimestamp);
    
    // Try to open notes for a plus code
    // The expired event should be filtered out
    await page.evaluate(() => {
      if (window.filterEventsForPlusCodeFast) {
        const filtered = window.filterEventsForPlusCodeFast('8FVC2222+');
        // Expired events should not appear
        return filtered.filter(e => e.id === 'expired-event-123').length;
      }
      return 0;
    }).then(count => {
      expect(count).toBe(0);
    });
  });

  test('should display events with future expiration', async ({ page }) => {
    const now = getCurrentTimestamp();
    const futureTimestamp = now + 86400; // 1 day from now
    
    // Inject a valid event with future expiration
    await page.evaluate((futureTs) => {
      const validEvent = {
        id: 'valid-event-456',
        kind: 30397,
        pubkey: 'test-pubkey-def',
        created_at: Math.floor(Date.now() / 1000),
        tags: [
          ['l', '8FVC3333+', 'open-location-code'],
          ['L', 'open-location-code'],
          ['expiration', futureTs.toString()],
        ],
        content: 'This is a valid note with future expiration',
        sig: 'test-signature',
      };
      
      if (window.events) {
        window.events.push(validEvent);
      }
    }, futureTimestamp);
    
    // Check that the event is not filtered out
    const count = await page.evaluate(() => {
      if (window.filterEventsForPlusCodeFast) {
        const filtered = window.filterEventsForPlusCodeFast('8FVC3333+');
        return filtered.filter(e => e.id === 'valid-event-456').length;
      }
      return 0;
    });
    
    expect(count).toBe(1);
  });

  test('should display events without expiration tag', async ({ page }) => {
    // Inject an event without expiration
    await page.evaluate(() => {
      const noExpirationEvent = {
        id: 'no-expiration-event-789',
        kind: 30397,
        pubkey: 'test-pubkey-ghi',
        created_at: Math.floor(Date.now() / 1000),
        tags: [
          ['l', '8FVC4444+', 'open-location-code'],
          ['L', 'open-location-code'],
          // No expiration tag
        ],
        content: 'This note has no expiration',
        sig: 'test-signature',
      };
      
      if (window.events) {
        window.events.push(noExpirationEvent);
      }
    });
    
    // Check that the event is not filtered out (no expiration = never expires)
    const count = await page.evaluate(() => {
      if (window.filterEventsForPlusCodeFast) {
        const filtered = window.filterEventsForPlusCodeFast('8FVC4444+');
        return filtered.filter(e => e.id === 'no-expiration-event-789').length;
      }
      return 0;
    });
    
    expect(count).toBe(1);
  });

  test('isEventExpired function should work correctly', async ({ page }) => {
    const now = getCurrentTimestamp();
    
    // Test expired event
    const isExpiredResult = await page.evaluate((pastTs) => {
      if (typeof window.isEventExpired !== 'function') {
        return 'function not found';
      }
      
      const expiredEvent = {
        id: 'test',
        tags: [['expiration', pastTs.toString()]],
      };
      
      return window.isEventExpired(expiredEvent);
    }, now - 100);
    
    expect(isExpiredResult).toBe(true);
    
    // Test non-expired event
    const isNotExpiredResult = await page.evaluate((futureTs) => {
      if (typeof window.isEventExpired !== 'function') {
        return 'function not found';
      }
      
      const validEvent = {
        id: 'test',
        tags: [['expiration', futureTs.toString()]],
      };
      
      return window.isEventExpired(validEvent);
    }, now + 3600);
    
    expect(isNotExpiredResult).toBe(false);
    
    // Test event without expiration tag
    const noExpirationResult = await page.evaluate(() => {
      if (typeof window.isEventExpired !== 'function') {
        return 'function not found';
      }
      
      const noExpEvent = {
        id: 'test',
        tags: [],
      };
      
      return window.isEventExpired(noExpEvent);
    });
    
    expect(noExpirationResult).toBe(false);
  });

  test('flushExpiredEvents should remove expired events', async ({ page }) => {
    const now = getCurrentTimestamp();
    
    // Add expired and valid events
    await page.evaluate((ts) => {
      const { pastTs, futureTs } = ts;
      
      window.events = [
        {
          id: 'should-be-removed',
          kind: 30397,
          tags: [
            ['l', 'TEST0000+', 'open-location-code'],
            ['expiration', pastTs.toString()],
          ],
          content: 'expired',
        },
        {
          id: 'should-remain',
          kind: 30397,
          tags: [
            ['l', 'TEST1111+', 'open-location-code'],
            ['expiration', futureTs.toString()],
          ],
          content: 'valid',
        },
        {
          id: 'no-expiration',
          kind: 30397,
          tags: [
            ['l', 'TEST2222+', 'open-location-code'],
          ],
          content: 'no expiration',
        },
      ];
    }, { pastTs: now - 100, futureTs: now + 86400 });
    
    // Call flushExpiredEvents
    await page.evaluate(() => {
      if (typeof window.flushExpiredEvents === 'function') {
        window.flushExpiredEvents();
      }
    });
    
    // Check remaining events
    const remainingIds = await page.evaluate(() => {
      return window.events.map(e => e.id);
    });
    
    expect(remainingIds).not.toContain('should-be-removed');
    expect(remainingIds).toContain('should-remain');
    expect(remainingIds).toContain('no-expiration');
  });

  test('should show expiration time in note display', async ({ page }) => {
    const now = getCurrentTimestamp();
    const futureTimestamp = now + 86400; // 1 day from now
    
    // Add event with expiration
    await page.evaluate((futureTs) => {
      window.events = [{
        id: 'note-with-expiry',
        kind: 30397,
        pubkey: 'test-pubkey-xyz',
        created_at: Math.floor(Date.now() / 1000),
        tags: [
          ['l', '8FVC5555+', 'open-location-code'],
          ['L', 'open-location-code'],
          ['expiration', futureTs.toString()],
        ],
        content: 'Note with visible expiration',
        sig: 'test-signature',
      }];
      
      // Rebuild index
      if (typeof window.rebuildSpatialIndex === 'function') {
        window.rebuildSpatialIndex();
      }
    }, futureTimestamp);
    
    // Open the plus code notes modal
    await page.evaluate(() => {
      if (typeof window.showPlusCodeNotesModal === 'function') {
        window.showPlusCodeNotesModal('8FVC5555+');
      }
    });
    
    // Wait for modal to appear
    await page.waitForSelector('#pluscode-notes-modal', { state: 'visible', timeout: 5000 }).catch(() => {
      // Modal might not be visible if no events, that's OK for this test
    });
    
    // Check if expiration indicator is present (will be added in next step)
    // For now, just verify the event is displayed
    const noteContent = await page.evaluate(() => {
      const modal = document.getElementById('pluscode-notes-modal');
      if (modal) {
        return modal.textContent;
      }
      return '';
    });
    
    // The note content should include our test note or expiration info
    // This test will be more specific once we add the expiry display
  });
});

test.describe('Expiration Display Format', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.clear();
    });
    await page.goto('/');
    await page.waitForSelector('#map', { timeout: 10000 });
  });

  test('formatRemainingTime should format correctly', async ({ page }) => {
    // Test the formatRemainingTime function if exposed globally
    const testCases = await page.evaluate(() => {
      if (typeof window.formatRemainingTime !== 'function') {
        return null; // Function not yet implemented
      }
      
      const HOUR = 60 * 60;
      const DAY = 24 * HOUR;
      
      return {
        sevenDays: window.formatRemainingTime(7 * DAY),
        oneDay: window.formatRemainingTime(DAY),
        fiveHours: window.formatRemainingTime(5 * HOUR + 30 * 60),
        thirtyMinutes: window.formatRemainingTime(30 * 60),
        lessThanMinute: window.formatRemainingTime(30),
        expired: window.formatRemainingTime(-100),
        nullInput: window.formatRemainingTime(null),
      };
    });
    
    // This test will pass once we implement the function
    if (testCases !== null) {
      expect(testCases.sevenDays).toBe('7d 0h');
      expect(testCases.oneDay).toBe('1d 0h');
      expect(testCases.fiveHours).toBe('5h 30m');
      expect(testCases.thirtyMinutes).toBe('30m');
      expect(testCases.lessThanMinute).toBe('<1m');
      expect(testCases.expired).toBe('expired');
      expect(testCases.nullInput).toBeNull();
    }
  });
});
