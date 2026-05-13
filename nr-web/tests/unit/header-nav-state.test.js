import { beforeEach, describe, expect, it, vi } from 'vitest';

function resetHeaderSurface(className = '') {
  document.body.className = className;
  document.body.innerHTML = [
    '<header class="app-header" id="app-header"></header>',
    '<div id="map" tabindex="-1"></div>',
    '<div id="map-view" class="view"></div>',
  ].join('');
  window.location.hash = className.includes('nr-surface-stats') ? '#stats' : '';
}

function fillHeader() {
  if (!window.NrWeb || typeof window.NrWeb.fillAppHeader !== 'function') {
    throw new Error('NrWeb.fillAppHeader not loaded');
  }
  window.NrWeb.fillAppHeader();
}

describe('header navigation active state', () => {
  beforeEach(() => {
    delete window.openSearchUi;
    delete window.applyNrUnifiedHash;
  });

  it('does not mark Map active on the stats surface', () => {
    resetHeaderSurface('nr-surface-stats');
    fillHeader();

    expect(document.getElementById('nav-map-btn')?.getAttribute('aria-current')).toBeNull();
    expect(document.getElementById('nav-map-btn')?.classList.contains('is-active')).toBe(false);
    expect(document.getElementById('nav-user-btn')?.getAttribute('aria-current')).toBe('page');
  });

  it('Map nav leaves the stats route before opening map search', () => {
    resetHeaderSurface('nr-surface-stats');
    window.openSearchUi = vi.fn();
    window.applyNrUnifiedHash = vi.fn(() => {
      document.body.classList.remove('nr-surface-stats');
    });
    fillHeader();

    document.getElementById('nav-map-btn')?.click();

    expect(window.location.hash).toBe('');
    expect(window.applyNrUnifiedHash).toHaveBeenCalled();
    expect(window.openSearchUi).toHaveBeenCalled();
  });
});
