import { expect } from "jsr:@std/expect";
import {
  createPendingVerification,
  deletePendingVerification,
  getPendingVerification,
} from "../../src/db/kv.ts";
import type { PendingVerification } from "../../schemas/pendingVerification.ts";
import { TOKEN_EXPIRY_MS } from "../../schemas/pendingVerification.ts";

function makePendingVerification(
  overrides?: Partial<PendingVerification>,
): PendingVerification {
  const now = Date.now();
  return {
    id: crypto.randomUUID(),
    username: "testuser",
    email: "test@example.com",
    token: crypto.randomUUID(),
    code: "123456",
    createdAt: now,
    expiresAt: now + TOKEN_EXPIRY_MS,
    ...overrides,
  };
}

Deno.test("#kv1 createPendingVerification stores and getPendingVerification retrieves", async () => {
  const verification = makePendingVerification();
  await createPendingVerification(verification);
  const result = await getPendingVerification(verification.token);
  expect(result).not.toBeNull();
  expect(result!.id).toBe(verification.id);
  expect(result!.token).toBe(verification.token);
  expect(result!.code).toBe(verification.code);
  expect(result!.email).toBe(verification.email);
  expect(result!.username).toBe(verification.username);
});

Deno.test("#kv2 getPendingVerification returns null for nonexistent token", async () => {
  const result = await getPendingVerification(crypto.randomUUID());
  expect(result).toBeNull();
});

Deno.test("#kv3 deletePendingVerification removes the entry", async () => {
  const verification = makePendingVerification();
  await createPendingVerification(verification);
  await deletePendingVerification(verification.token);
  const result = await getPendingVerification(verification.token);
  expect(result).toBeNull();
});

Deno.test("#kv4 getPendingVerification returns null for expired entry", async () => {
  const now = Date.now();
  const verification = makePendingVerification({
    createdAt: now - TOKEN_EXPIRY_MS - 1000,
    expiresAt: now - 1000,
  });
  await createPendingVerification(verification);
  const result = await getPendingVerification(verification.token);
  expect(result).toBeNull();
});
