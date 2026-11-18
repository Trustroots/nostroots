describe("secure random bootstrap", () => {
  const originalCrypto = globalThis.crypto;
  const originalGetRandomValues = originalCrypto?.getRandomValues;

  afterEach(() => {
    if (originalCrypto && originalGetRandomValues) {
      originalCrypto.getRandomValues = originalGetRandomValues;
    }
    globalThis.crypto = originalCrypto;
    jest.dontMock("expo-crypto");
    jest.resetModules();
  });

  it("replaces the random function while preserving the existing crypto object", () => {
    const capturedCrypto = { getRandomValues: jest.fn() } as unknown as Crypto;
    globalThis.crypto = capturedCrypto;
    const nativeGetRandomValues = jest.fn();
    jest.doMock("expo-crypto", () => ({
      getRandomValues: nativeGetRandomValues,
    }));

    jest.isolateModules(() => {
      require("./secureRandom.bootstrap");
    });

    expect(globalThis.crypto).toBe(capturedCrypto);
    expect(capturedCrypto.getRandomValues).toBe(nativeGetRandomValues);
  });

  it("creates the crypto object when the runtime does not provide one", () => {
    globalThis.crypto = undefined as unknown as Crypto;
    const nativeGetRandomValues = jest.fn();
    jest.doMock("expo-crypto", () => ({
      getRandomValues: nativeGetRandomValues,
    }));

    jest.isolateModules(() => {
      require("./secureRandom.bootstrap");
    });

    expect(globalThis.crypto.getRandomValues).toBe(nativeGetRandomValues);
  });

  it("uses 128 native entropy bits for a mnemonic and propagates native failures", () => {
    const nativeGetRandomValues = jest.fn((array: Uint8Array) => array.fill(7));
    jest.doMock("expo-crypto", () => ({
      getRandomValues: nativeGetRandomValues,
    }));

    jest.isolateModules(() => {
      require("./secureRandom.bootstrap");
      const { generateSeedWords } = require("nip06") as typeof import("nip06");
      const { generateSecretKey } =
        require("nostr-tools") as typeof import("nostr-tools");
      expect(generateSeedWords().mnemonic.split(" ")).toHaveLength(12);
      expect(nativeGetRandomValues).toHaveBeenCalledTimes(1);
      expect(nativeGetRandomValues.mock.calls[0][0].byteLength).toBe(16);
      expect(generateSecretKey()).toHaveLength(32);

      nativeGetRandomValues.mockImplementation(() => {
        throw new Error("native CSPRNG unavailable");
      });
      expect(() => generateSeedWords()).toThrow("native CSPRNG unavailable");
      expect(() => generateSecretKey()).toThrow("native CSPRNG unavailable");
    });
  });
});
