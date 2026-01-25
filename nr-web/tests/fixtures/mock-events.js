/**
 * Mock Nostr events for testing
 */

export function createMockMapNoteEvent(overrides = {}) {
  return {
    id: 'test-event-id-' + Date.now(),
    kind: 30397,
    pubkey: 'test-pubkey-' + Math.random().toString(36).substring(7),
    created_at: Math.floor(Date.now() / 1000),
    tags: [
      ['l', 'CC000000+', 'open-location-code'],
      ['L', 'open-location-code'],
    ],
    content: 'Test note content',
    sig: 'test-signature',
    ...overrides,
  };
}

export function createMockProfileEvent(overrides = {}) {
  return {
    id: 'test-profile-id-' + Date.now(),
    kind: 10390,
    pubkey: 'test-pubkey',
    created_at: Math.floor(Date.now() / 1000),
    tags: [
      ['l', 'testuser', 'org.trustroots:username'],
      ['L', 'org.trustroots:username'],
    ],
    content: JSON.stringify({ name: 'Test User' }),
    sig: 'test-signature',
    ...overrides,
  };
}

export function createMockRepostEvent(overrides = {}) {
  return {
    id: 'test-repost-id-' + Date.now(),
    kind: 30398,
    pubkey: 'test-pubkey',
    created_at: Math.floor(Date.now() / 1000),
    tags: [
      ['e', 'original-event-id'],
      ['l', 'CC000000+', 'open-location-code'],
    ],
    content: '',
    sig: 'test-signature',
    ...overrides,
  };
}
