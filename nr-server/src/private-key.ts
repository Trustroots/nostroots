import { generateSecretKey, getPublicKey, nip19 } from "nostr-tools";

export function resolvePrivateKey(
  maybePrivateKeyNsec: string | undefined,
  isDev: boolean,
): { key: Uint8Array; generatedForDevelopment: boolean } {
  const configuredKey = maybePrivateKeyNsec?.trim();
  if (configuredKey) {
    // Report configuration errors without including the supplied secret.
    try {
      const decoded = nip19.decode(configuredKey);
      if (decoded.type !== "nsec") throw new Error("Expected nsec");
      // A valid checksum alone does not guarantee a valid secp256k1 scalar.
      getPublicKey(decoded.data);
      return { key: decoded.data, generatedForDevelopment: false };
    } catch {
      throw new Error("PRIVATE_KEY_NSEC must be a valid private nsec key.");
    }
  }

  if (!isDev) {
    throw new Error(
      "PRIVATE_KEY_NSEC is required outside development; refusing to generate an ephemeral signing identity.",
    );
  }

  return { key: generateSecretKey(), generatedForDevelopment: true };
}
