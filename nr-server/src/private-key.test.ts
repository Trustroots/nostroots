import { getPublicKey, nip19 } from "nostr-tools";
import { resolvePrivateKey } from "./private-key.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function expectError(action: () => unknown, expectedMessage: string): Error {
  let thrown: unknown;
  try {
    action();
  } catch (error) {
    thrown = error;
  }
  assert(thrown instanceof Error, "expected configuration to fail");
  assert(thrown.message.includes(expectedMessage), "expected actionable error");
  return thrown;
}

Deno.test("production requires an explicit non-blank signing key", () => {
  for (const input of [undefined, "", "   "]) {
    expectError(() => resolvePrivateKey(input, false), "required");
  }
});

Deno.test("development may generate a valid ephemeral signing key", () => {
  for (const input of [undefined, "", "   "]) {
    const resolved = resolvePrivateKey(input, true);
    assert(resolved.generatedForDevelopment, "expected ephemeral key marker");
    assert(resolved.key.length === 32, "expected 32-byte secret key");
    assert(getPublicKey(resolved.key).length === 64, "expected valid scalar");
  }
});

Deno.test("configured signing keys are preserved in every environment", () => {
  const expected = new Uint8Array(32).fill(7);
  const nsec = nip19.nsecEncode(expected);
  for (const isDev of [false, true]) {
    const resolved = resolvePrivateKey(`  ${nsec}  `, isDev);
    assert(
      !resolved.generatedForDevelopment,
      "configured key is not ephemeral",
    );
    assert(
      resolved.key.every((byte, index) => byte === expected[index]),
      "expected configured secret bytes",
    );
  }
});

Deno.test("public keys cannot be used as the server signing key", () => {
  const npub = nip19.npubEncode(getPublicKey(new Uint8Array(32).fill(7)));
  expectError(() => resolvePrivateKey(npub, false), "valid private nsec");
});

Deno.test("malformed configured keys fail without disclosing their value", () => {
  const malformed = "nsec1-secret-configuration-value";
  for (const isDev of [false, true]) {
    const error = expectError(
      () => resolvePrivateKey(malformed, isDev),
      "valid private nsec",
    );
    assert(!error.message.includes(malformed), "must not disclose input");
  }
});

Deno.test("checksummed nsecs still require a valid secp256k1 scalar", () => {
  for (const byte of [0, 255]) {
    const invalidScalar = nip19.nsecEncode(new Uint8Array(32).fill(byte));
    expectError(
      () => resolvePrivateKey(invalidScalar, false),
      "valid private nsec",
    );
  }
});
