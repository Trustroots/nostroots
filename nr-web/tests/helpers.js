/**
 * Helper functions for tests
 */

/**
 * Wait for a function to return truthy value or timeout
 */
export function waitFor(condition, timeout = 5000, interval = 100) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    
    const check = () => {
      if (condition()) {
        resolve();
      } else if (Date.now() - startTime > timeout) {
        reject(new Error(`Timeout waiting for condition after ${timeout}ms`));
      } else {
        setTimeout(check, interval);
      }
    };
    
    check();
  });
}

/**
 * Clear all app state (localStorage, global variables)
 */
export function clearAppState() {
  localStorage.clear();
  // Clear any global state variables if they exist
  if (window.currentPrivateKey) window.currentPrivateKey = null;
  if (window.currentPublicKey) window.currentPublicKey = null;
  if (window.usingNip07) window.usingNip07 = false;
}

/**
 * Get a test private key (deterministic for testing)
 */
export function getTestPrivateKey() {
  // This is a test key - never use in production!
  return 'nsec1test000000000000000000000000000000000000000000000000000000000000';
}

/**
 * Mock a Nostr event for testing
 */
export function createMockEvent(kind = 30397, content = 'Test note', tags = []) {
  return {
    id: 'test-event-id-' + Date.now(),
    kind,
    pubkey: 'test-pubkey',
    created_at: Math.floor(Date.now() / 1000),
    tags,
    content,
    sig: 'test-signature',
  };
}
