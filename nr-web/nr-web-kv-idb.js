/**
 * Small IndexedDB key-value store for nr-web prefs and caches that exceed localStorage comfort.
 * Object store: { k: string, v: structuredClone-able value }.
 */

const NR_WEB_KV_DB_NAME = 'nostroots_web_kv';
const NR_WEB_KV_DB_VERSION = 1;
const NR_WEB_KV_STORE = 'kv';

/** IndexedDB keys (also legacy localStorage keys where applicable). */
export const NR_WEB_KV_KEYS = {
    NOTIFICATION_PLUS_CODES: 'notification_plus_codes',
    CLAIM_SIGN_DONE: 'nostroots_claim_sign_done',
};

let dbPromise = null;

export function chatCacheKvKey(pubkeyHex) {
    return 'nostroots_chat_cache_' + pubkeyHex;
}

export function openNrWebKvDb() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
        if (typeof indexedDB === 'undefined') {
            dbPromise = null;
            reject(new Error('indexedDB unavailable'));
            return;
        }
        const req = indexedDB.open(NR_WEB_KV_DB_NAME, NR_WEB_KV_DB_VERSION);
        req.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(NR_WEB_KV_STORE)) {
                db.createObjectStore(NR_WEB_KV_STORE, { keyPath: 'k' });
            }
        };
        req.onerror = () => {
            dbPromise = null;
            reject(req.error);
        };
        req.onsuccess = () => resolve(req.result);
    });
    return dbPromise;
}

export async function nrWebKvGet(key) {
    try {
        const db = await openNrWebKvDb();
        return await new Promise((resolve, reject) => {
            const tx = db.transaction(NR_WEB_KV_STORE, 'readonly');
            tx.onerror = () => reject(tx.error);
            const r = tx.objectStore(NR_WEB_KV_STORE).get(key);
            r.onerror = () => reject(r.error);
            r.onsuccess = () => {
                const row = r.result;
                resolve(row ? row.v : undefined);
            };
        });
    } catch (_) {
        return undefined;
    }
}

export async function nrWebKvPut(key, value) {
    const db = await openNrWebKvDb();
    await new Promise((resolve, reject) => {
        const tx = db.transaction(NR_WEB_KV_STORE, 'readwrite');
        tx.onerror = () => reject(tx.error);
        tx.oncomplete = () => resolve();
        tx.objectStore(NR_WEB_KV_STORE).put({ k: key, v: value });
    });
}

export async function nrWebKvDelete(key) {
    try {
        const db = await openNrWebKvDb();
        await new Promise((resolve, reject) => {
            const tx = db.transaction(NR_WEB_KV_STORE, 'readwrite');
            tx.onerror = () => reject(tx.error);
            tx.oncomplete = () => resolve();
            tx.objectStore(NR_WEB_KV_STORE).delete(key);
        });
    } catch (_) {}
}
