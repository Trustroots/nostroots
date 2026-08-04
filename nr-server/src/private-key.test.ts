import { nostrTools } from "../deps.ts";
import { resolvePrivateKey } from "./private-key.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

Deno.test(
  "private key configuration requires an explicit production key",
  () => {
    let thrown: unknown;
    try {
      resolvePrivateKey(undefined, false);
    } catch (error) {
      thrown = error;
    }
    assert(thrown instanceof Error, "expected missing production key to throw");
    assert(thrown.message.includes("required"), "expected actionable error");
  },
);

Deno.test(
  "private key configuration may create an ephemeral development key",
  () => {
    const resolved = resolvePrivateKey(undefined, true);
    assert(resolved.generatedForDevelopment, "expected development marker");
    assert(resolved.key.length === 32, "expected 32-byte secret key");
    assert(
      nostrTools.getPublicKey(resolved.key).length === 64,
      "expected valid scalar",
    );
  },
);

Deno.test("private key configuration preserves a configured nsec", () => {
  const expected = nostrTools.generateSecretKey();
  const nsec = nostrTools.nip19.nsecEncode(expected);
  const resolved = resolvePrivateKey(nsec, false);
  assert(
    !resolved.generatedForDevelopment,
    "configured keys are not ephemeral",
  );
  assert(
    resolved.key.every((byte, index) => byte === expected[index]),
    "expected configured secret bytes",
  );
});
