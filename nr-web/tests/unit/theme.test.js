import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';

const __dirname = dirname(fileURLToPath(import.meta.url));
const commonSrc = readFileSync(join(__dirname, '../../common.js'), 'utf-8');

/** Load nr-web common.js in an isolated window with NrWebTheme available. */
function loadNrWebThemeTestWindow() {
    const dom = new JSDOM('<!DOCTYPE html><html><head></head><body></body></html>', {
        url: 'http://localhost',
        runScripts: 'outside-only'
    });
    const { window } = dom;
    // common.js injectKeysSettingsModals() calls fetch; stub so eval does not throw in jsdom
    window.fetch = () =>
        Promise.resolve({
            ok: false,
            status: 404,
            text: () => Promise.resolve('')
        });
    window.eval(commonSrc);
    return window;
}

describe('NrWebTheme (common.js)', () => {
    it('mergeThemeFromRemote applies when remote created_at is strictly greater than local ts', () => {
        const w = loadNrWebThemeTestWindow();
        w.localStorage.setItem('nrweb_theme', 'light');
        w.localStorage.setItem('nrweb_theme_ts', '100');
        const ok = w.NrWebTheme.mergeThemeFromRemote({ theme: 'dark', created_at: 200 });
        expect(ok).toBe(true);
        expect(w.localStorage.getItem('nrweb_theme')).toBe('dark');
        expect(w.localStorage.getItem('nrweb_theme_ts')).toBe('200');
        expect(w.document.documentElement.getAttribute('data-theme')).toBe('dark');
    });

    it('mergeThemeFromRemote ignores older remote events', () => {
        const w = loadNrWebThemeTestWindow();
        w.localStorage.setItem('nrweb_theme', 'light');
        w.localStorage.setItem('nrweb_theme_ts', '200');
        const ok = w.NrWebTheme.mergeThemeFromRemote({ theme: 'dark', created_at: 100 });
        expect(ok).toBe(false);
        expect(w.localStorage.getItem('nrweb_theme')).toBe('light');
    });

    it('applyTheme sets data-theme on documentElement', () => {
        const w = loadNrWebThemeTestWindow();
        w.NrWebTheme.applyTheme('light', { silent: true });
        expect(w.document.documentElement.getAttribute('data-theme')).toBe('light');
        w.NrWebTheme.applyTheme('dark', { silent: true });
        expect(w.document.documentElement.getAttribute('data-theme')).toBe('dark');
    });
});
