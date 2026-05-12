import { readFileSync } from 'fs';
import { JSDOM, VirtualConsole } from 'jsdom';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const htmlPath = resolve(__dirname, '..', 'index.html');

// Load HTML file
const html = readFileSync(htmlPath, 'utf-8');

// Mock CDN dependencies BEFORE creating JSDOM
// This prevents errors when scripts try to import from CDN
global.maplibregl = {
  Map: class MockMap {
    constructor() {
      this.loaded = () => true;
      this.getSource = () => ({});
      this.on = () => {};
      this.off = () => {};
      this.remove = () => {};
    }
  },
  Marker: class MockMarker {},
  Popup: class MockPopup {},
};

// Suppress console errors from failed CDN imports (expected in test environment)
const originalError = console.error;
console.error = (...args) => {
  const message = args.join(' ');
  // Suppress known errors from CDN imports and module loading
  if (
    message.includes('Failed to fetch') ||
    message.includes('Failed to load resource') ||
    message.includes('import') ||
    message.includes('CORS')
  ) {
    return; // Suppress these expected errors
  }
  originalError.apply(console, args);
};

const isKnownJSDOMResourceNoise = (message) => (
  message.includes('Could not load link: "https://fonts.googleapis.com/') ||
  message.includes('Could not load link: "https://unpkg.com/') ||
  message.includes('Could not load script: "https://unpkg.com/') ||
  message.includes('Could not load script: "https://1p.trustroots.org/script.js"')
);

const virtualConsole = new VirtualConsole();
virtualConsole.sendTo(console, { omitJSDOMErrors: true });
virtualConsole.on('jsdomError', (error) => {
  const message = String(error?.message || error);
  if (isKnownJSDOMResourceNoise(message)) return;
  originalError(error);
});

// Create JSDOM instance
// Note: Module scripts with CDN imports will fail, but that's expected
// Non-module scripts will execute and functions will be available on window
const dom = new JSDOM(html, {
  url: 'http://localhost',
  runScripts: 'dangerously',
  resources: 'usable',
  pretendToBeVisual: true,
  virtualConsole,
  beforeParse(window) {
    // Inject mocks into window before scripts run
    window.maplibregl = global.maplibregl;
    if (window.HTMLCanvasElement) {
      window.HTMLCanvasElement.prototype.getContext = () => null;
    }
  },
});

// Restore console.error after DOM is created
console.error = originalError;

// Keys + Settings modals are inlined in index.html

// Make globals available to tests
global.window = dom.window;
global.document = dom.window.document;
global.localStorage = dom.window.localStorage;
global.navigator = dom.window.navigator;
global.HTMLElement = dom.window.HTMLElement;
global.Element = dom.window.Element;

// Ensure maplibregl is available on window (in case scripts need it)
dom.window.maplibregl = global.maplibregl;

// Mock crypto.getRandomValues if needed (jsdom should provide it, but ensure it exists)
if (!global.crypto) {
  global.crypto = {
    getRandomValues: (arr) => {
      // Simple mock - in real tests you might want deterministic values
      for (let i = 0; i < arr.length; i++) {
        arr[i] = Math.floor(Math.random() * 256);
      }
      return arr;
    },
  };
}

// Mock navigator.clipboard
global.navigator.clipboard = {
  writeText: async (text) => {
    // Mock implementation
    return Promise.resolve();
  },
  readText: async () => {
    return Promise.resolve('');
  },
};

// Clear localStorage before each test suite
beforeEach(() => {
  localStorage.clear();
});
