import { installSecureRandom } from "./secureRandom";

describe("secure random bootstrap", () => {
  const originalCrypto = globalThis.crypto;
  const originalGetRandomValues = originalCrypto?.getRandomValues;

  afterEach(() => {
    if (originalCrypto && originalGetRandomValues) {
      originalCrypto.getRandomValues = originalGetRandomValues;
    }
    globalThis.crypto = originalCrypto;
    jest.resetModules();
  });

  it("replaces the captured random function on the existing crypto object", () => {
    const capturedCrypto = {
      getRandomValues: jest.fn(),
    } as unknown as Crypto;
    globalThis.crypto = capturedCrypto;
    const secureGetRandomValues = jest.fn(
      (array) => array,
    ) as unknown as Crypto["getRandomValues"];

    installSecureRandom(secureGetRandomValues);

    expect(globalThis.crypto).toBe(capturedCrypto);
    expect(capturedCrypto.getRandomValues).toBe(secureGetRandomValues);
  });

  it("requests 128 bits and propagates generator failures without fallback", () => {
    const byteLengths: number[] = [];
    const secureGetRandomValues = jest.fn((array: ArrayBufferView) => {
      byteLengths.push(array.byteLength);
      new Uint8Array(array.buffer, array.byteOffset, array.byteLength).fill(7);
      return array;
    }) as unknown as Crypto["getRandomValues"];
    installSecureRandom(secureGetRandomValues);

    let generateSeedWords!: typeof import("nip06")["generateSeedWords"];
    jest.isolateModules(() => {
      ({ generateSeedWords } = require("nip06") as typeof import("nip06"));
      expect(generateSeedWords().mnemonic.split(" ")).toHaveLength(12);
    });
    expect(byteLengths).toEqual([16]);

    const unavailable = jest.fn(() => {
      throw new Error("native CSPRNG unavailable");
    }) as unknown as Crypto["getRandomValues"];
    installSecureRandom(unavailable);
    expect(() => generateSeedWords()).toThrow("native CSPRNG unavailable");
  });
});
