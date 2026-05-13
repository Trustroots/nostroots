import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';

const __dirname = dirname(fileURLToPath(import.meta.url));
const indexHtml = readFileSync(join(__dirname, '../../index.html'), 'utf-8');

describe('new conversation modal', () => {
  it('has an accessible inline feedback region', () => {
    const dom = new JSDOM(indexHtml);
    const feedback = dom.window.document.getElementById('new-dm-feedback');
    expect(feedback).toBeTruthy();
    expect(feedback?.className).toContain('form-feedback');
    expect(feedback?.getAttribute('role')).toBe('status');
    expect(feedback?.getAttribute('aria-live')).toBe('polite');
  });
});
