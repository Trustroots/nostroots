import { nostrTools } from "../deps.ts";

export type ResolvedPrivateKey = {
  key: Uint8Array;
  generatedForDevelopment: boolean;
};

export function resolvePrivateKey(
  maybePrivateKeyNsec: string | undefined,
  isDev: boolean,
): ResolvedPrivateKey {
  if (typeof maybePrivateKeyNsec === "string" && maybePrivateKeyNsec.trim()) {
    const decoded = nostrTools.nip19.decode(maybePrivateKeyNsec.trim());
    if (decoded.type !== "nsec") {
      throw new Error("#5jLJ2W Invalid nsec");
    }

    // Decoding proves the NIP-19 checksum, while getPublicKey also proves that
    // the 32-byte payload is a valid secp256k1 scalar.
    nostrTools.getPublicKey(decoded.data);
    return { key: decoded.data, generatedForDevelopment: false };
  }

  if (!isDev) {
    throw new Error(
      "PRIVATE_KEY_NSEC is required outside development; refusing to generate an ephemeral signing identity.",
    );
  }

  return {
    key: nostrTools.generateSecretKey(),
    generatedForDevelopment: true,
  };
}
