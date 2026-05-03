/**
 * Trustroots circle directory events (kind 30410) — shared by chat-app and unit tests.
 */

export const TRUSTROOTS_CIRCLE_META_KIND = 30410;

export function getCircleMetaDTagFromTags(tags) {
    const row = (tags || []).find((t) => Array.isArray(t) && t[0] === 'd' && t[1]);
    return row ? String(row[1]).trim().toLowerCase() : '';
}

export function parseCircleMetaContent(jsonStr) {
    try {
        const o = JSON.parse(jsonStr || '{}');
        return {
            name: String(o.name || '').trim(),
            about: String(o.about || '').trim(),
            picture: String(o.picture || '').trim()
        };
    } catch (_) {
        return { name: '', about: '', picture: '' };
    }
}

export function isSafeHttpUrl(url) {
    if (!url || typeof url !== 'string') return false;
    try {
        const u = new URL(url.trim());
        return u.protocol === 'https:' || u.protocol === 'http:';
    } catch (_) {
        return false;
    }
}

/**
 * @param {Map<string, object>} map - slug -> { name, about, picture, created_at, eventId }
 * @param {object} ev
 * @param {{ expectedPubkey?: string, kind?: number }} opts
 * @returns {boolean} true if map was updated
 */
export function mergeCircleMetadataMapEntry(map, ev, opts) {
    const kind = opts && opts.kind != null ? opts.kind : TRUSTROOTS_CIRCLE_META_KIND;
    if (!ev || ev.kind !== kind) return false;
    const exp = String(opts?.expectedPubkey || '')
        .trim()
        .toLowerCase();
    if (exp && String(ev.pubkey || '').trim().toLowerCase() !== exp) return false;
    const slug = getCircleMetaDTagFromTags(ev.tags);
    if (!slug) return false;
    const parsed = parseCircleMetaContent(ev.content);
    const prev = map.get(slug);
    if (prev && prev.created_at >= ev.created_at) return false;
    map.set(slug, {
        name: parsed.name || slug,
        about: parsed.about,
        picture: parsed.picture,
        created_at: ev.created_at,
        eventId: ev.id
    });
    return true;
}
