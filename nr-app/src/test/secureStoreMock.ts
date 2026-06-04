const secureStore = new Map<string, string>();

export function resetSecureStoreMock() {
  secureStore.clear();
}

export function seedSecureStoreMock(values: Record<string, string>) {
  Object.entries(values).forEach(([key, value]) => {
    secureStore.set(key, value);
  });
}

export function createSecureStoreMock() {
  return {
    AFTER_FIRST_UNLOCK: "AFTER_FIRST_UNLOCK",
    deleteItemAsync: jest.fn(async (key: string) => {
      secureStore.delete(key);
    }),
    getItemAsync: jest.fn(async (key: string) => secureStore.get(key) ?? null),
    setItemAsync: jest.fn(async (key: string, value: string) => {
      secureStore.set(key, value);
    }),
  };
}
