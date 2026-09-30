/**
 * @module kv
 *
 * Deno KV operations for storing and retrieving token requests.
 *
 * Token requests are stored under the key `["tokenRequests", username]` and
 * automatically expire via the KV `expireIn` option. An additional
 * application-level check on `expiresAt` guards against clock drift.
 *
 * Rate-limit counters live under `["verifyTokenRate", "user", userId, window]`,
 * `["verifyTokenRate", "global", window]` and
 * `["verifyAttemptRate", "global", window]`.
 */
import {
  MAX_VERIFY_ATTEMPTS,
  MAX_VERIFY_ATTEMPTS_GLOBAL_PER_WINDOW,
  MAX_VERIFY_TOKEN_GLOBAL_PER_WINDOW,
  MAX_VERIFY_TOKEN_PER_WINDOW,
  type TokenRequest,
  VERIFY_TOKEN_WINDOW_MS,
} from "../../schemas/tokenRequest.ts";
import { DENO_KV_PATH } from "../config.ts";

let kv: Deno.Kv | null = null;

/**
 * Return the shared Deno KV store, opening it on first call.
 *
 * @returns The open {@link Deno.Kv} instance.
 */
export async function getKv(): Promise<Deno.Kv> {
  if (kv) return kv;
  kv = await Deno.openKv(DENO_KV_PATH);
  return kv;
}

/**
 * Replace the internal KV handle — used in tests to inject an in-memory
 * (`:memory:`) store.
 *
 * @param instance - The KV instance to use going forward.
 */
export async function setKv(instance: Deno.Kv): Promise<void> {
  kv = instance;
}

/**
 * Persist a new token request in Deno KV with an automatic TTL derived from
 * `expiresAt - createdAt`.
 *
 * @param request - The fully-populated {@link TokenRequest} to store.
 */
export async function createTokenRequest(
  request: TokenRequest,
): Promise<void> {
  const store = await getKv();
  await store.set(["tokenRequests", request.username], request, {
    expireIn: request.expiresAt - request.createdAt,
  });
}

/**
 * Retrieve a token request by username, returning `null` when none exists or
 * the entry has expired.
 *
 * @param username - The Trustroots username that was used as the KV key.
 * @returns The stored {@link TokenRequest}, or `null`.
 */
export async function getTokenRequest(
  username: string,
): Promise<TokenRequest | null> {
  const store = await getKv();
  const entry = await store.get<TokenRequest>([
    "tokenRequests",
    username,
  ]);
  if (!entry.value) return null;
  if (entry.value.expiresAt < Date.now()) {
    await deleteTokenRequest(username);
    return null;
  }
  return entry.value;
}

/**
 * Remove a token request from Deno KV. Called after successful authentication.
 *
 * @param username - The username whose token request should be deleted.
 */
export async function deleteTokenRequest(username: string): Promise<void> {
  const store = await getKv();
  await store.delete(["tokenRequests", username]);
}

const OCC_RETRIES = 3;

/**
 * Atomically count one code/token submission against a user's token request
 * and return the request so the caller can compare the submission with it.
 *
 * Counting before comparing is what makes the lockout hold under a parallel
 * burst of guesses: each comparison has to win its own compare-and-set. Once
 * {@link MAX_VERIFY_ATTEMPTS} submissions have been counted the request is
 * deleted, so later submissions fail like an expired request. The remaining
 * TTL is preserved so submissions cannot extend a request's life.
 *
 * @param username - The username the token request is keyed by.
 * @returns The token request, or `null` if there is none, it has expired,
 *          its attempts are used up, or the counter stayed contended.
 */
export async function reserveVerifyAttempt(
  username: string,
): Promise<TokenRequest | null> {
  const store = await getKv();
  const key = ["tokenRequests", username];

  for (let attempt = 0; attempt < OCC_RETRIES; attempt++) {
    const entry = await store.get<TokenRequest>(key);
    if (!entry.value) return null;

    const remainingMs = entry.value.expiresAt - Date.now();
    const attempts = entry.value.attempts ?? 0;
    if (remainingMs <= 0 || attempts >= MAX_VERIFY_ATTEMPTS) {
      await store.atomic().check(entry).delete(key).commit();
      if (attempts >= MAX_VERIFY_ATTEMPTS) {
        console.warn("verify attempts limit reached", { username });
      }
      return null;
    }

    const reserved = { ...entry.value, attempts: attempts + 1 };
    const result = await store.atomic()
      .check(entry)
      .set(key, reserved, { expireIn: remainingMs })
      .commit();
    if (result.ok) return reserved;
  }

  return null;
}

export interface SlotReservation {
  allowed: boolean;
  count: number;
  retryAfterSeconds: number;
}

/**
 * Atomically check and increment a fixed-window counter. The window number is
 * part of the key, so a new window starts from zero without relying on
 * `expireIn`, which only cleans up old counters.
 *
 * Uses optimistic concurrency because the threat is a parallel burst trying
 * to slip past the counter; after repeated lost commits it rejects rather
 * than risk going over the limit.
 */
async function reserveSlot(
  name: Deno.KvKey,
  limit: number,
  retries = OCC_RETRIES,
): Promise<SlotReservation> {
  const store = await getKv();
  const now = Date.now();
  const windowIndex = Math.floor(now / VERIFY_TOKEN_WINDOW_MS);
  const key = [...name, windowIndex];
  const retryAfterSeconds = Math.ceil(
    ((windowIndex + 1) * VERIFY_TOKEN_WINDOW_MS - now) / 1000,
  );

  for (let attempt = 0; attempt < retries; attempt++) {
    const entry = await store.get<{ count: number }>(key);
    const count = entry.value?.count ?? 0;
    if (count >= limit) {
      return { allowed: false, count, retryAfterSeconds };
    }

    const result = await store.atomic()
      .check(entry)
      .set(key, { count: count + 1 }, {
        expireIn: 2 * VERIFY_TOKEN_WINDOW_MS,
      })
      .commit();
    if (result.ok) {
      return { allowed: true, count: count + 1, retryAfterSeconds };
    }
  }

  return { allowed: false, count: limit, retryAfterSeconds };
}

// The global counters are shared by every request, so allow more lost races
// before rejecting a legitimate one.
const GLOBAL_OCC_RETRIES = 10;

/**
 * Reserve one of a user's `POST /verify_token` calls for this window. Keyed on
 * the Mongo `_id` so a username change doesn't reset it.
 */
export function tryReserveVerifyTokenSlot(
  userId: string,
): Promise<SlotReservation> {
  return reserveSlot(
    ["verifyTokenRate", "user", userId],
    MAX_VERIFY_TOKEN_PER_WINDOW,
  );
}

/** Reserve one verification email from the cap shared by all users. */
export function tryReserveGlobalVerifyTokenSlot(): Promise<SlotReservation> {
  return reserveSlot(
    ["verifyTokenRate", "global"],
    MAX_VERIFY_TOKEN_GLOBAL_PER_WINDOW,
    GLOBAL_OCC_RETRIES,
  );
}

/** Reserve one code/token comparison from the cap shared by all users. */
export function tryReserveGlobalVerifyAttemptSlot(): Promise<
  SlotReservation
> {
  return reserveSlot(
    ["verifyAttemptRate", "global"],
    MAX_VERIFY_ATTEMPTS_GLOBAL_PER_WINDOW,
    GLOBAL_OCC_RETRIES,
  );
}

/**
 * Close the shared KV store and reset internal state. Safe to call even if no
 * store has been opened.
 */
export async function closeKv(): Promise<void> {
  if (kv) {
    kv.close();
    kv = null;
  }
}
