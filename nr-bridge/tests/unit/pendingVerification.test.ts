import { expect } from "jsr:@std/expect";
import {
  createPendingVerification,
  deletePendingVerification,
  getPendingVerification,
  incrementVerifyAttempts,
  tryReserveRequestTokenSlotByInput,
  tryReserveRequestTokenSlotByUserId,
} from "../../src/db/kv.ts";
import type { PendingVerification } from "../../schemas/pendingVerification.ts";
import {
  MAX_REQUEST_TOKEN_PER_WINDOW,
  MAX_VERIFY_ATTEMPTS,
  TOKEN_EXPIRY_MS,
} from "../../schemas/pendingVerification.ts";

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
    attempts: 0,
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
  expect(result!.attempts).toBe(0);
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

Deno.test("#kv5 incrementVerifyAttempts increments once and preserves other fields", async () => {
  const verification = makePendingVerification();
  await createPendingVerification(verification);

  const result = await incrementVerifyAttempts(verification.token);
  expect(result).toEqual({ attempts: 1, deleted: false });

  const reread = await getPendingVerification(verification.token);
  expect(reread).not.toBeNull();
  expect(reread!.attempts).toBe(1);
  expect(reread!.id).toBe(verification.id);
  expect(reread!.code).toBe(verification.code);
  expect(reread!.username).toBe(verification.username);
  expect(reread!.expiresAt).toBe(verification.expiresAt);
});

Deno.test("#kv6 incrementVerifyAttempts deletes the record at MAX_VERIFY_ATTEMPTS", async () => {
  const verification = makePendingVerification();
  await createPendingVerification(verification);

  const results = [];
  for (const _attempt of Array(MAX_VERIFY_ATTEMPTS).keys()) {
    results.push(await incrementVerifyAttempts(verification.token));
  }

  // Earlier calls should be non-deleting; the last one crosses the threshold.
  expect(results[results.length - 1]).toEqual({
    attempts: MAX_VERIFY_ATTEMPTS,
    deleted: true,
  });

  const reread = await getPendingVerification(verification.token);
  expect(reread).toBeNull();
});

Deno.test("#kv7 incrementVerifyAttempts returns null for an unknown token", async () => {
  const result = await incrementVerifyAttempts(crypto.randomUUID());
  expect(result).toBeNull();
});

Deno.test("#kv8 incrementVerifyAttempts returns null for an already-expired record", async () => {
  const now = Date.now();
  const verification = makePendingVerification({
    createdAt: now - TOKEN_EXPIRY_MS - 1000,
    expiresAt: now - 1000,
  });
  await createPendingVerification(verification);

  const result = await incrementVerifyAttempts(verification.token);
  expect(result).toBeNull();
});

Deno.test("#kv9 tryReserveRequestTokenSlotByUserId allows MAX then rejects", async () => {
  const userId = `rl_uid_${crypto.randomUUID()}`;

  for (const attempt of Array(MAX_REQUEST_TOKEN_PER_WINDOW).keys()) {
    const result = await tryReserveRequestTokenSlotByUserId(userId);
    expect(result).toEqual({ allowed: true, count: attempt + 1 });
  }

  const denied = await tryReserveRequestTokenSlotByUserId(userId);
  expect(denied.allowed).toBe(false);
  expect(denied.count).toBe(MAX_REQUEST_TOKEN_PER_WINDOW);
});

Deno.test("#kv10 tryReserveRequestTokenSlotByInput allows MAX then rejects", async () => {
  const input = `rl_input_${crypto.randomUUID()}`;

  for (const attempt of Array(MAX_REQUEST_TOKEN_PER_WINDOW).keys()) {
    const result = await tryReserveRequestTokenSlotByInput(input);
    expect(result).toEqual({ allowed: true, count: attempt + 1 });
  }

  const denied = await tryReserveRequestTokenSlotByInput(input);
  expect(denied.allowed).toBe(false);
  expect(denied.count).toBe(MAX_REQUEST_TOKEN_PER_WINDOW);
});

Deno.test("#kv11 tryReserveRequestTokenSlotByUserId and ByInput use disjoint namespaces", async () => {
  // Same string used as both a user ID and as an input — the two helpers
  // must not see each other's writes.
  const sharedString = `rl_isolation_${crypto.randomUUID()}`;

  // Burn the limit on the input namespace.
  for (const _attempt of Array(MAX_REQUEST_TOKEN_PER_WINDOW).keys()) {
    await tryReserveRequestTokenSlotByInput(sharedString);
  }
  const inputDenied = await tryReserveRequestTokenSlotByInput(sharedString);
  expect(inputDenied.allowed).toBe(false);

  // The uid namespace should still have a fresh allowance.
  const uidFirst = await tryReserveRequestTokenSlotByUserId(sharedString);
  expect(uidFirst).toEqual({ allowed: true, count: 1 });
});
