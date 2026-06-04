import type { Event, EventTemplate, Filter, VerifiedEvent } from "nostr-tools";

export function createMockVerifiedEvent(
  overrides: Partial<VerifiedEvent> = {},
): VerifiedEvent {
  return {
    content: "",
    created_at: 1,
    id: "0".repeat(64),
    kind: 1,
    pubkey: "1".repeat(64),
    sig: "2".repeat(128),
    tags: [],
    ...overrides,
  };
}

export function createMockRelay() {
  return {
    close: jest.fn(),
    connect: jest.fn(async () => undefined),
    publish: jest.fn(async () => "ok"),
    subscribe: jest.fn(
      (
        _filters: Filter[],
        callbacks?: {
          oneose?: () => void;
          onevent?: (event: Event) => void;
        },
      ) => {
        callbacks?.oneose?.();
        return {
          close: jest.fn(),
        };
      },
    ),
  };
}

export function createMockRelayModule(relay = createMockRelay()) {
  return {
    getAllRelays: jest.fn(() => [relay]),
    getRelay: jest.fn(async () => relay),
  };
}

export function createMockPublishModule() {
  return {
    publishVerifiedEventToRelay: jest.fn(async () => "ok"),
  };
}

export function createMockSubscriptionsModule() {
  const subscription = { close: jest.fn() };
  return {
    getSubscription: jest.fn(() => subscription),
    injectStore: jest.fn(),
    stopSubscription: jest.fn(),
    subscribeToFilter: jest.fn(async () => "test-subscription-id"),
  };
}

export function createMockKeystoreModule() {
  return {
    derivePublicKeyHexFromMnemonic: jest.fn(() => "1".repeat(64)),
    getHasPrivateKeyHexInSecureStorage: jest.fn(async () => false),
    getHasPrivateKeyInSecureStorage: jest.fn(async () => false),
    getHasPrivateKeyMnemonicInSecureStorage: jest.fn(async () => false),
    getPrivateKeyHexFromSecureStorage: jest.fn(async () => "3".repeat(64)),
    getPrivateKeyMnemonicFromSecureStorage: jest.fn(
      async () =>
        "romance slim fame pipe puzzle priority actress must impulse tape super bike",
    ),
    getPublicKeyHexFromSecureStorage: jest.fn(async () => undefined),
    setPrivateKeyInSecureStorage: jest.fn(async () => "1".repeat(64)),
    signEventTemplate: jest.fn(async (template: EventTemplate) =>
      createMockVerifiedEvent(template),
    ),
  };
}

export function createMockNrCommonNetworkModule() {
  return {
    getNip5PubKey: jest.fn(async () => "1".repeat(64)),
  };
}
