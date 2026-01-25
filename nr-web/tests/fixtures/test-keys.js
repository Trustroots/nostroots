/**
 * Test fixtures for keys and test data
 * These are safe test keys - never use in production!
 */

export const TEST_NSEC = 'nsec1test000000000000000000000000000000000000000000000000000000000000';
export const TEST_PRIVATE_KEY_HEX = 'a'.repeat(64); // 64 character hex string
export const TEST_PUBLIC_KEY_HEX = 'b'.repeat(64);

export const TEST_RELAYS = [
  'wss://relay.trustroots.org',
  'wss://relay.nomadwiki.org',
  'wss://test-relay.example.com',
];

export const INVALID_NSEC_FORMATS = [
  'not-nsec1',
  'nsec',
  'nsec1',
  'nsec1invalid',
  '',
  'nsec2test',
];

export const VALID_NSEC_PREFIX = 'nsec1';
