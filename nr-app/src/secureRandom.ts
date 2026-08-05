export function installSecureRandom(
  getRandomValues: Crypto["getRandomValues"],
): void {
  const crypto = globalThis.crypto ?? ({} as Crypto);

  // Mutate the existing object so crypto libraries that captured its reference
  // during module loading also receive the secure implementation.
  crypto.getRandomValues = getRandomValues;
  globalThis.crypto = crypto;
}
