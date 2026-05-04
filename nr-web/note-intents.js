/**
 * Map note interaction intents — small controlled vocabulary surfaced in the
 * compose UI as single-select chips, written to kind 30397 events as both a
 * NIP-12 `t` tag and an in-content `#hashtag`.
 *
 * Keep this file dependency-free so it can be unit-tested directly.
 */

export const MAP_NOTE_INTENTS = [
    { id: 'hosting',        label: 'Hosting',          hint: 'I can host travelers' },
    { id: 'lookingforhost', label: 'Looking for host', hint: 'I need a place to stay' },
    { id: 'wanttomeet',     label: 'Want to meet',     hint: 'Social meetup, no hosting' },
    { id: 'localtips',      label: 'Local tips',       hint: 'Share or ask about the area' },
    { id: 'ride',           label: 'Ride',             hint: 'Offering or seeking a ride' },
    { id: 'event',          label: 'Event',            hint: 'Something happening at a time' },
];

export const MAP_NOTE_INTENT_IDS = new Set(MAP_NOTE_INTENTS.map((i) => i.id));

export function getIntentById(id) {
    if (!id) return null;
    const lower = String(id).trim().toLowerCase();
    return MAP_NOTE_INTENTS.find((i) => i.id === lower) || null;
}

export function isIntentId(id) {
    if (!id) return false;
    return MAP_NOTE_INTENT_IDS.has(String(id).trim().toLowerCase());
}

/**
 * Detect a note's intent. Prefer the first NIP-12 `t` tag matching a known
 * intent; fall back to the first `#intent` hashtag in the content.
 * @param {{tags?: any[], content?: string}} event
 * @returns {string|null}
 */
export function detectNoteIntent(event) {
    if (!event) return null;
    const tags = Array.isArray(event.tags) ? event.tags : [];
    for (const tag of tags) {
        if (!Array.isArray(tag) || tag.length < 2) continue;
        if (tag[0] !== 't') continue;
        const value = String(tag[1] || '').trim().toLowerCase();
        if (MAP_NOTE_INTENT_IDS.has(value)) return value;
    }
    const content = String(event.content || '');
    const matches = content.match(/#(\w+)/g) || [];
    for (const m of matches) {
        const value = m.slice(1).toLowerCase();
        if (MAP_NOTE_INTENT_IDS.has(value)) return value;
    }
    return null;
}

/**
 * Prepend `#intent` to the note content if it does not already contain that
 * exact hashtag. Trims the result. Returns the original content if intent is
 * unknown/empty.
 * @param {string} content
 * @param {string|null} intentId
 * @returns {string}
 */
export function applyIntentHashtagToContent(content, intentId) {
    const text = String(content == null ? '' : content);
    if (!isIntentId(intentId)) return text;
    const id = String(intentId).trim().toLowerCase();
    const hashtag = `#${id}`;
    const existing = text.match(/#\w+/g) || [];
    const has = existing.some((h) => h.toLowerCase() === hashtag);
    if (has) return text.trim();
    return `${hashtag} ${text}`.trim();
}

/**
 * Push a NIP-12 `t` tag for the intent into a tag array (mutates and returns).
 * No-op for unknown intent.
 * @param {any[]} tags
 * @param {string|null} intentId
 * @returns {any[]}
 */
export function pushIntentTag(tags, intentId) {
    if (!Array.isArray(tags)) return tags;
    if (!isIntentId(intentId)) return tags;
    tags.push(['t', String(intentId).trim().toLowerCase()]);
    return tags;
}

/**
 * If the content begins with `#intent` (with optional surrounding whitespace),
 * strip exactly that leading token so the visible note doesn't repeat the
 * badge label. Other occurrences are left intact.
 * @param {string} content
 * @param {string|null} intentId
 * @returns {string}
 */
export function stripLeadingIntentHashtag(content, intentId) {
    const text = String(content == null ? '' : content);
    if (!isIntentId(intentId)) return text;
    const id = String(intentId).trim().toLowerCase();
    const re = new RegExp(`^\\s*#${id}\\b\\s*`, 'i');
    return text.replace(re, '');
}
