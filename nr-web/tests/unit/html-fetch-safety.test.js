import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { JSDOM, VirtualConsole } from 'jsdom';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const indexHtml = readFileSync(join(__dirname, '../../index.html'), 'utf-8');

describe('index.html fetch safety', () => {
    it('does not throw when metadata fetch runs without fetch support', async () => {
        const jsdomErrors = [];
        const virtualConsole = new VirtualConsole();
        virtualConsole.on('jsdomError', (error) => {
            jsdomErrors.push(String(error?.message || error));
        });

        const dom = new JSDOM(indexHtml, {
            url: 'http://localhost/',
            runScripts: 'dangerously',
            resources: 'usable',
            pretendToBeVisual: true,
            virtualConsole,
            beforeParse(window) {
                delete window.fetch;
            },
        });

        await new Promise((resolve) => setTimeout(resolve, 30));
        dom.window.close();

        expect(jsdomErrors.some((message) => message.includes('fetch is not defined'))).toBe(false);
    });
});
