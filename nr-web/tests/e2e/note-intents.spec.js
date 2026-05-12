import { test, expect } from './fixtures.js';

/**
 * Validates the map-note intent UX:
 *   - chips render in the Host & Meet area page composer
 *   - clicking a chip toggles aria-checked
 *   - the "Host & meet" header shortcut pre-selects #wanttomeet
 *   - rendered notes carrying a t/intent tag get a badge
 * No relays are contacted; we drive the in-page helpers directly.
 */

const TEST_PRIV_HEX = '0000000000000000000000000000000000000000000000000000000000000001';

test.beforeEach(async ({ page }) => {
    await page.addInitScript((hex) => {
        try {
            localStorage.clear();
            localStorage.setItem('nostr_private_key', hex);
        } catch (_) {}
    }, TEST_PRIV_HEX);
});

test.describe('Map note intent chips', () => {
    test('chips render and select-by-click in the area page composer', async ({ page }) => {
        await page.goto('/');
        await page.waitForLoadState('networkidle');

        await page.evaluate(() => window.showNotesForPlusCode('9F3HC2J7+'));
        await expect(page.locator('body.nr-surface-host')).toBeVisible();
        await expect(page.locator('#nr-host-view')).toBeVisible();
        await expect(page.locator('#area-location-code')).toHaveText('9F3HC2J7+');

        const chips = page.locator('#note-intent-chips .note-intent-chip');
        await expect(chips).toHaveCount(6);
        await expect(chips.first()).toHaveAttribute('data-intent', 'wanttomeet');
        await expect(chips.first()).toHaveAttribute('aria-checked', 'true');

        await page.locator('.note-intent-chip[data-intent="wanttomeet"]').click();
        await expect(
            page.locator('.note-intent-chip[data-intent="wanttomeet"]'),
        ).toHaveAttribute('aria-checked', 'true');

        // Single-select: clicking a different chip switches selection.
        await page.locator('.note-intent-chip[data-intent="hosting"]').click();
        await expect(
            page.locator('.note-intent-chip[data-intent="hosting"]'),
        ).toHaveAttribute('aria-checked', 'true');
        await expect(
            page.locator('.note-intent-chip[data-intent="wanttomeet"]'),
        ).toHaveAttribute('aria-checked', 'false');
    });

    test('Host & meet shortcut pre-selects #wanttomeet', async ({ page }) => {
        await page.goto('/');
        await page.waitForLoadState('networkidle');

        await page.evaluate(() => window.openHostNoteFlow());
        await expect(page.locator('body.nr-surface-host')).toBeVisible();
        await expect(page.locator('#nr-host-view')).toBeVisible();
        await expect(
            page.locator('.note-intent-chip[data-intent="wanttomeet"]'),
        ).toHaveAttribute('aria-checked', 'true');
    });

    test('a note carrying a t-tag intent renders an intent badge', async ({ page }) => {
        await page.goto('/');
        await page.waitForLoadState('networkidle');

        // Use the exposed createNoteItem() to render a synthetic note and
        // mount it. This avoids depending on relays or the spatial index,
        // and keeps the test focused on UI behaviour.
        await page.evaluate(() => {
            window.showNotesForPlusCode('9F3HC2J7+');
            const fake = {
                id: 'aa'.repeat(32),
                kind: 30397,
                pubkey: 'bb'.repeat(32),
                created_at: Math.floor(Date.now() / 1000),
                content: '#hosting Cosy spare bed in town',
                tags: [
                    ['expiration', String(Math.floor(Date.now() / 1000) + 86400)],
                    ['L', 'open-location-code'],
                    ['l', '9F3HC2J7+', 'open-location-code'],
                    ['t', 'hosting'],
                ],
                sig: 'cc'.repeat(32),
            };
            const item = window.createNoteItem(fake);
            const host = document.getElementById('pluscode-notes-content');
            host.replaceChildren(item);
        });

        await expect(page.locator('body.nr-surface-host')).toBeVisible();
        await expect(page.locator('#nr-host-view')).toBeVisible();
        const badge = page
            .locator('#pluscode-notes-content .nr-note-intent-badge.nr-note-intent-hosting')
            .first();
        await expect(badge).toBeVisible();
        await expect(badge).toHaveText('Hosting');
        // The leading `#hosting` token must not appear in the rendered text.
        const noteText = await page
            .locator('#pluscode-notes-content .host-note-content')
            .first()
            .textContent();
        expect(noteText.trim().startsWith('Hosting')).toBe(true);
        expect(noteText).not.toMatch(/^\s*#hosting/i);
    });

    test('Host & Meet notes and composer use compact Chat primitives', async ({ page }) => {
        await page.goto('/');
        await page.waitForLoadState('networkidle');

        await page.evaluate(() => {
            window.showNotesForPlusCode('9F3HC2J7+');
            const fake = {
                id: 'dd'.repeat(32),
                kind: 30397,
                pubkey: 'bb'.repeat(32),
                created_at: Math.floor(Date.now() / 1000),
                content: 'Shared house plants with npub10xlxvlhemja6c4dqv22uapctqupfhlxm9h8z3k2e72q4k9hcz7vqpkge6d',
                tags: [
                    ['expiration', String(Math.floor(Date.now() / 1000) + 86400)],
                    ['L', 'open-location-code'],
                    ['l', '9F3HC2J7+', 'open-location-code'],
                ],
                sig: 'ee'.repeat(32),
                relayScope: 'public',
            };
            const item = window.createNoteItem(fake);
            const host = document.getElementById('pluscode-notes-content');
            host.replaceChildren(item);
        });

        const note = page.locator('#pluscode-notes-content .host-note-row');
        await expect(note.locator('.message.other.host-note-bubble')).toBeVisible();
        await expect(note.locator('.message-delete')).toHaveCount(2);
        await expect(note.locator('.host-note-pluscode')).toHaveText('9F3HC2J7+');
        await expect(note.locator('.note-expiry')).toBeVisible();
        await expect(note.locator('.note-relay-scope-pill')).toBeVisible();
        await expect(note.locator('a[href^="#profile/npub10xlx"]')).toBeVisible();

        const sizes = await page.evaluate(() => {
            const bubble = document.querySelector('#pluscode-notes-content .host-note-bubble');
            const action = document.querySelector('#pluscode-notes-content .message-delete');
            const textarea = document.querySelector('#note-content-in-modal');
            const bubbleStyle = getComputedStyle(bubble);
            const actionStyle = getComputedStyle(action);
            const textareaStyle = getComputedStyle(textarea);
            return {
                bubbleFont: bubbleStyle.fontSize,
                bubblePaddingTop: bubbleStyle.paddingTop,
                actionWidth: actionStyle.width,
                textareaMinHeight: textareaStyle.minHeight,
                textareaBorderWidth: textareaStyle.borderTopWidth,
            };
        });
        expect(parseFloat(sizes.bubbleFont)).toBeLessThanOrEqual(15);
        expect(parseFloat(sizes.bubblePaddingTop)).toBeLessThanOrEqual(10);
        expect(parseFloat(sizes.actionWidth)).toBeLessThanOrEqual(34);
        expect(parseFloat(sizes.textareaMinHeight)).toBeLessThanOrEqual(36);
        expect(sizes.textareaBorderWidth).toBe('1px');
    });
});
