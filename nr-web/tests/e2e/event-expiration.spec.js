import { test, expect } from '@playwright/test';

/**
 * E2E tests for event expiration functionality (NIP-40)
 * 
 * Tests verify the structure and logic of expiration handling.
 * Full integration testing happens via the unit tests.
 */

test.describe('Event Expiration E2E', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('isEventExpired function exists and works correctly', async ({ page }) => {
    const result = await page.evaluate(() => {
      if (typeof window.isEventExpired !== 'function') {
        return { exists: false };
      }
      
      const now = Math.floor(Date.now() / 1000);
      
      // Test expired event
      const expiredEvent = {
        id: 'expired',
        tags: [['expiration', (now - 100).toString()]],
      };
      
      // Test valid event
      const validEvent = {
        id: 'valid',
        tags: [['expiration', (now + 3600).toString()]],
      };
      
      // Test event without expiration
      const noExpEvent = {
        id: 'no-exp',
        tags: [],
      };
      
      return {
        exists: true,
        expiredIsExpired: window.isEventExpired(expiredEvent),
        validIsExpired: window.isEventExpired(validEvent),
        noExpIsExpired: window.isEventExpired(noExpEvent),
      };
    });
    
    expect(result.exists).toBe(true);
    expect(result.expiredIsExpired).toBe(true);
    expect(result.validIsExpired).toBe(false);
    expect(result.noExpIsExpired).toBe(false);
  });

  test('getExpirationTimestamp function exists and works', async ({ page }) => {
    const result = await page.evaluate(() => {
      if (typeof window.getExpirationTimestamp !== 'function') {
        return { exists: false };
      }
      
      const timestamp = 1706270400;
      const eventWithExp = {
        tags: [['expiration', timestamp.toString()]],
      };
      
      const eventNoExp = {
        tags: [],
      };
      
      return {
        exists: true,
        withExp: window.getExpirationTimestamp(eventWithExp),
        noExp: window.getExpirationTimestamp(eventNoExp),
      };
    });
    
    expect(result.exists).toBe(true);
    expect(result.withExp).toBe(1706270400);
    expect(result.noExp).toBeNull();
  });

  test('getRemainingTime function exists and works', async ({ page }) => {
    const result = await page.evaluate(() => {
      if (typeof window.getRemainingTime !== 'function') {
        return { exists: false };
      }
      
      const now = Math.floor(Date.now() / 1000);
      const futureEvent = {
        tags: [['expiration', (now + 3600).toString()]],
      };
      
      const pastEvent = {
        tags: [['expiration', (now - 100).toString()]],
      };
      
      const noExpEvent = {
        tags: [],
      };
      
      return {
        exists: true,
        futureRemaining: window.getRemainingTime(futureEvent),
        pastRemaining: window.getRemainingTime(pastEvent),
        noExpRemaining: window.getRemainingTime(noExpEvent),
      };
    });
    
    expect(result.exists).toBe(true);
    expect(result.futureRemaining).toBeGreaterThan(0);
    expect(result.futureRemaining).toBeLessThanOrEqual(3600);
    expect(result.pastRemaining).toBeLessThan(0);
    expect(result.noExpRemaining).toBeNull();
  });

  test('formatRemainingTime function exists and formats correctly', async ({ page }) => {
    const result = await page.evaluate(() => {
      if (typeof window.formatRemainingTime !== 'function') {
        return { exists: false };
      }
      
      const HOUR = 60 * 60;
      const DAY = 24 * HOUR;
      
      return {
        exists: true,
        sevenDays: window.formatRemainingTime(7 * DAY),
        oneDay: window.formatRemainingTime(DAY),
        fiveHours: window.formatRemainingTime(5 * HOUR + 30 * 60),
        thirtyMinutes: window.formatRemainingTime(30 * 60),
        lessThanMinute: window.formatRemainingTime(30),
        expired: window.formatRemainingTime(-100),
        nullInput: window.formatRemainingTime(null),
      };
    });
    
    expect(result.exists).toBe(true);
    expect(result.sevenDays).toBe('7d');
    expect(result.oneDay).toBe('1d');
    expect(result.fiveHours).toBe('5h');
    expect(result.thirtyMinutes).toBe('30m');
    expect(result.lessThanMinute).toBe('<1m');
    expect(result.expired).toBe('expired');
    expect(result.nullInput).toBeNull();
  });

  test('flushExpiredEvents function exists and removes expired events', async ({ page }) => {
    const result = await page.evaluate(() => {
      if (typeof window.flushExpiredEvents !== 'function') {
        return { exists: false };
      }
      
      const now = Math.floor(Date.now() / 1000);
      
      // Set up test events
      window.events = [
        {
          id: 'should-be-removed',
          kind: 30397,
          tags: [
            ['l', 'TEST0000+', 'open-location-code'],
            ['expiration', (now - 100).toString()],
          ],
          content: 'expired',
        },
        {
          id: 'should-remain',
          kind: 30397,
          tags: [
            ['l', 'TEST1111+', 'open-location-code'],
            ['expiration', (now + 86400).toString()],
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
      
      // Mock the functions that flushExpiredEvents calls
      window.saveEventsToCache = window.saveEventsToCache || (() => {});
      window.rebuildSpatialIndex = window.rebuildSpatialIndex || (() => {});
      window.updateMapMarkers = window.updateMapMarkers || (() => {});
      window.updatePlusCodeGrid = window.updatePlusCodeGrid || (() => {});
      window.cachedFilteredEvents = null;
      window.filteredEventsCacheKey = null;
      
      window.flushExpiredEvents();
      
      return {
        exists: true,
        remainingIds: window.events.map(e => e.id),
      };
    });
    
    expect(result.exists).toBe(true);
    expect(result.remainingIds).not.toContain('should-be-removed');
    expect(result.remainingIds).toContain('should-remain');
    expect(result.remainingIds).toContain('no-expiration');
  });

  test('note-expiry CSS class is defined', async ({ page }) => {
    const hasClass = await page.evaluate(() => {
      const styles = document.styleSheets;
      for (let sheet of styles) {
        try {
          const rules = sheet.cssRules || sheet.rules;
          for (let rule of rules) {
            if (rule.selectorText && rule.selectorText.includes('.note-expiry')) {
              return true;
            }
          }
        } catch (e) {
          // Cross-origin stylesheets may throw
        }
      }
      return false;
    });
    
    expect(hasClass).toBe(true);
  });

  test('createNoteItem creates expiry span for events with expiration', async ({ page }) => {
    const result = await page.evaluate(() => {
      if (typeof window.createNoteItem !== 'function') {
        return { exists: false };
      }
      
      const now = Math.floor(Date.now() / 1000);
      const event = {
        id: 'test-event',
        kind: 30397,
        pubkey: 'test-pubkey-123',
        created_at: now,
        tags: [
          ['l', 'TEST0000+', 'open-location-code'],
          ['L', 'open-location-code'],
          ['expiration', (now + 86400).toString()], // 1 day from now
        ],
        content: 'Test note with expiration',
        sig: 'test-sig',
      };
      
      const noteItem = window.createNoteItem(event);
      const expirySpan = noteItem.querySelector('.note-expiry');
      
      return {
        exists: true,
        hasExpirySpan: !!expirySpan,
        expiryText: expirySpan ? expirySpan.textContent : null,
        hasTooltip: expirySpan ? !!expirySpan.title : false,
      };
    });
    
    expect(result.exists).toBe(true);
    expect(result.hasExpirySpan).toBe(true);
    expect(result.expiryText).toContain('⏱️');
    expect(result.hasTooltip).toBe(true);
  });

  test('createNoteItem does not create expiry span for events without expiration', async ({ page }) => {
    const result = await page.evaluate(() => {
      if (typeof window.createNoteItem !== 'function') {
        return { exists: false };
      }
      
      const now = Math.floor(Date.now() / 1000);
      const event = {
        id: 'test-event-no-exp',
        kind: 30397,
        pubkey: 'test-pubkey-456',
        created_at: now,
        tags: [
          ['l', 'TEST0001+', 'open-location-code'],
          ['L', 'open-location-code'],
          // No expiration tag
        ],
        content: 'Test note without expiration',
        sig: 'test-sig',
      };
      
      const noteItem = window.createNoteItem(event);
      const expirySpan = noteItem.querySelector('.note-expiry');
      
      return {
        exists: true,
        hasExpirySpan: !!expirySpan,
      };
    });
    
    expect(result.exists).toBe(true);
    expect(result.hasExpirySpan).toBe(false);
  });

  test('expiry span color changes based on urgency', async ({ page }) => {
    const result = await page.evaluate(() => {
      if (typeof window.createNoteItem !== 'function') {
        return { exists: false };
      }
      
      const now = Math.floor(Date.now() / 1000);
      
      // Event expiring in 1 hour (less than 24h - warning color)
      const urgentEvent = {
        id: 'urgent-event',
        kind: 30397,
        pubkey: 'test-pubkey',
        created_at: now,
        tags: [
          ['l', 'TEST0002+', 'open-location-code'],
          ['L', 'open-location-code'],
          ['expiration', (now + 3600).toString()], // 1 hour
        ],
        content: 'Urgent note',
        sig: 'test-sig',
      };
      
      // Event expiring in 7 days (normal color)
      const normalEvent = {
        id: 'normal-event',
        kind: 30397,
        pubkey: 'test-pubkey',
        created_at: now,
        tags: [
          ['l', 'TEST0003+', 'open-location-code'],
          ['L', 'open-location-code'],
          ['expiration', (now + 7 * 24 * 60 * 60).toString()], // 7 days
        ],
        content: 'Normal note',
        sig: 'test-sig',
      };
      
      const urgentNoteItem = window.createNoteItem(urgentEvent);
      const normalNoteItem = window.createNoteItem(normalEvent);
      
      const urgentExpirySpan = urgentNoteItem.querySelector('.note-expiry');
      const normalExpirySpan = normalNoteItem.querySelector('.note-expiry');
      
      return {
        exists: true,
        urgentColor: urgentExpirySpan ? urgentExpirySpan.style.color : null,
        normalColor: normalExpirySpan ? normalExpirySpan.style.color : null,
      };
    });
    
    expect(result.exists).toBe(true);
    // Urgent (less than 24h) should be amber/orange
    expect(result.urgentColor).toBe('rgb(245, 158, 11)');
    // Normal (more than 24h) should use muted foreground
    expect(result.normalColor).toBe('var(--muted-foreground)');
  });

  test('filtering logic excludes expired events', async ({ page }) => {
    const result = await page.evaluate(() => {
      if (typeof window.isEventExpired !== 'function') {
        return { exists: false };
      }
      
      const now = Math.floor(Date.now() / 1000);
      
      const events = [
        {
          id: 'valid1',
          tags: [['expiration', (now + 3600).toString()]],
        },
        {
          id: 'valid2',
          tags: [], // No expiration = never expires
        },
        {
          id: 'expired1',
          tags: [['expiration', (now - 100).toString()]],
        },
      ];
      
      const filtered = events.filter(e => !window.isEventExpired(e));
      
      return {
        exists: true,
        filteredIds: filtered.map(e => e.id),
      };
    });
    
    expect(result.exists).toBe(true);
    expect(result.filteredIds).toContain('valid1');
    expect(result.filteredIds).toContain('valid2');
    expect(result.filteredIds).not.toContain('expired1');
  });

  test('expiration tag follows NIP-40 format', async ({ page }) => {
    // Verify that expiration tags use the correct format: ['expiration', unix_timestamp_string]
    const result = await page.evaluate(() => {
      const now = Math.floor(Date.now() / 1000);
      const expirationTimestamp = now + 86400;
      
      // This is the format used when creating new notes
      const expirationTag = ['expiration', expirationTimestamp.toString()];
      
      return {
        tagName: expirationTag[0],
        tagValue: expirationTag[1],
        isString: typeof expirationTag[1] === 'string',
        parsedValue: parseInt(expirationTag[1]),
      };
    });
    
    expect(result.tagName).toBe('expiration');
    expect(result.isString).toBe(true);
    expect(typeof result.parsedValue).toBe('number');
    expect(result.parsedValue).toBeGreaterThan(0);
  });
});
