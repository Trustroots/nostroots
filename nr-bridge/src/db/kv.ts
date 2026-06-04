/**
 * @module kv
 *
 * Deno KV operations for the email-verification flow:
 *
 * - Pending verification CRUD (`createPendingVerification`,
 *   `getPendingVerification`, `deletePendingVerification`).
 * - Per-token wrong-code lockout (`incrementVerifyAttempts`).
 * - Per-user request_token throttle, in two namespaces
 *   (`tryReserveRequestTokenSlotByUserId`,
 *   `tryReserveRequestTokenSlotByInput`).
 *
 * Pending verifications are stored under `[KV_KEYS.pendingVerifications,
 * token]` and automatically expire via the KV `expireIn` option. An additional
 * application-level check on `expiresAt` guards against clock drift.
 *
 * Rate-limit counters are stored under `[KV_KEYS.requestTokenRate, "uid",
 * userId]` for known users and `[KV_KEYS.requestTokenRate, "input",
 * normalizedInput]` for the unknown-user (throwaway) branch. The two
 * namespaces are disjoint by key construction so the counters cannot
 * collide. Both namespaces use the same threshold and window so a 429
 * response is observably identical regardless of which branch produced it,
 * preserving the username-enumeration prevention from the request_token
 * route.
 */
import {
  MAX_REQUEST_TOKEN_PER_WINDOW,
  MAX_VERIFY_ATTEMPTS,
  type PendingVerification,
  REQUEST_TOKEN_WINDOW_MS,
} from "../../schemas/pendingVerification.ts";
import { DENO_KV_PATH } from "../config.ts";

/**
 * KV key prefixes. Defined as constants so the strings are not repeated across
 * the codebase.
 */
export const KV_KEYS = {
  pendingVerifications: "pendingVerifications",
  requestTokenRate: "requestTokenRate",
} as const;

/**
 * Shared Deno KV store. Opened at module load using {@link DENO_KV_PATH}
 * (set `:memory:` for tests, leave unset for the Deno default location).
 */
export const kv = await Deno.openKv(DENO_KV_PATH);

/**
 * Persist a new pending verification in Deno KV with an automatic TTL derived
 * from `expiresAt - createdAt`.
 *
 * @param verification - The fully-populated {@link PendingVerification}.
 */
export async function createPendingVerification(
  verification: PendingVerification,
): Promise<void> {
  await kv.set(
    [KV_KEYS.pendingVerifications, verification.token],
    verification,
    { expireIn: verification.expiresAt - verification.createdAt },
  );
}

/**
 * Retrieve a pending verification by its token, returning `null` when none
 * exists or the entry has expired.
 *
 * @param token - The UUID token used as the KV key.
 * @returns The stored {@link PendingVerification}, or `null`.
 */
export async function getPendingVerification(
  token: string,
): Promise<PendingVerification | null> {
  const entry = await kv.get<PendingVerification>([
    KV_KEYS.pendingVerifications,
    token,
  ]);
  if (!entry.value) return null;
  if (entry.value.expiresAt < Date.now()) {
    await deletePendingVerification(token);
    return null;
  }
  return entry.value;
}

/**
 * Remove a pending verification from Deno KV. Called after the code has been
 * successfully verified.
 *
 * @param token - The token whose verification entry should be deleted.
 */
export async function deletePendingVerification(token: string): Promise<void> {
  await kv.delete([KV_KEYS.pendingVerifications, token]);
}

/**
 * Increment the wrong-code attempts counter on a pending verification.
 *
 * Used by the `/verify_code` route on the wrong-code branch to enforce the
 * per-token brute-force lockout. When the new count reaches
 * {@link MAX_VERIFY_ATTEMPTS} the record is deleted, so the attacker's *next*
 * call returns the same generic "No pending verification or token expired"
 * response as a naturally expired token (no observable lockout signal on the
 * triggering call — the route still returns "Invalid code" there).
 *
 * Reads via raw `kv.get` (not {@link getPendingVerification}) to avoid
 * double-deleting on the clock-drift path inside that helper. The remaining
 * TTL is preserved on the re-set so wrong-code submissions cannot extend a
 * token's life.
 *
 * Race tolerance: plain read-modify-write, no optimistic concurrency. A
 * handful of concurrent wrong-code requests can over-increment by 1–2; the
 * 5-attempt threshold is a deliberate round number with margin to spare.
 *
 * @param token - The token whose pending verification should have its
 *                attempts counter incremented.
 * @returns `null` if the token has no live pending verification (unknown,
 *          already expired, or already deleted by a concurrent caller).
 *          Otherwise an object describing the new attempts count and whether
 *          this increment crossed the threshold and deleted the record.
 */
export async function incrementVerifyAttempts(
  token: string,
): Promise<{ attempts: number; deleted: boolean } | null> {
  const entry = await kv.get<PendingVerification>([
    KV_KEYS.pendingVerifications,
    token,
  ]);
  if (!entry.value) return null;

  const now = Date.now();
  if (entry.value.expiresAt <= now) {
    await deletePendingVerification(token);
    return null;
  }

  const nextAttempts = (entry.value.attempts ?? 0) + 1;

  if (nextAttempts >= MAX_VERIFY_ATTEMPTS) {
    await deletePendingVerification(token);
    console.warn("verify attempts limit reached", {
      username: entry.value.username,
      tokenPrefix: token.slice(0, 8),
    });
    return { attempts: nextAttempts, deleted: true };
  }

  const remainingMs = entry.value.expiresAt - now;
  await kv.set(
    [KV_KEYS.pendingVerifications, token],
    { ...entry.value, attempts: nextAttempts },
    { expireIn: remainingMs },
  );
  return { attempts: nextAttempts, deleted: false };
}

/**
 * Atomically check-and-increment a request_token rate-limit counter under a
 * given KV key, with bounded optimistic-concurrency retries.
 *
 * Used by both `tryReserveRequestTokenSlotByUserId` and
 * `tryReserveRequestTokenSlotByInput`; not exported.
 *
 * Optimistic concurrency is required here (unlike the verify lockout) because
 * the attack model is precisely a burst of parallel requests trying to slip
 * past the counter. After 3 lost OCC commits we conservatively reject — under
 * adversarial contention, a false negative (one extra 429) is preferable to a
 * false positive (one extra email).
 */
/** Number of OCC retries `reserveRequestTokenSlotByKey` will attempt. */
const RESERVE_SLOT_OCC_RETRIES = 3;

async function reserveRequestTokenSlotByKey(
  key: Deno.KvKey,
): Promise<{ allowed: boolean; count: number }> {
  for (const _attempt of Array(RESERVE_SLOT_OCC_RETRIES).keys()) {
    const entry = await kv.get<{ count: number }>(key);
    const currentCount = entry.value?.count ?? 0;

    if (currentCount >= MAX_REQUEST_TOKEN_PER_WINDOW) {
      return { allowed: false, count: currentCount };
    }

    const nextCount = currentCount + 1;
    const result = await kv.atomic()
      .check({ key, versionstamp: entry.versionstamp })
      .set(key, { count: nextCount }, { expireIn: REQUEST_TOKEN_WINDOW_MS })
      .commit();

    if (result.ok) {
      return { allowed: true, count: nextCount };
    }
  }

  // Three lost commits in a row → high contention. Reject conservatively.
  return { allowed: false, count: MAX_REQUEST_TOKEN_PER_WINDOW };
}

/**
 * Try to reserve a request_token slot for a known Mongo user, keyed on the
 * canonical stringified `_id`. Used by the real-user branch of
 * `/request_token`. The same user looked up by username or (in the future) by
 * email hits the same counter, so an attacker cannot double their throttle
 * by alternating lookup methods.
 *
 * @param userId - Stringified Mongo `_id` of the user.
 * @returns `{ allowed: true, count }` if the slot was reserved (the count
 *          reflects the new value); `{ allowed: false, count }` if the limit
 *          has already been reached for this user in the current window.
 */
export function tryReserveRequestTokenSlotByUserId(
  userId: string,
): Promise<{ allowed: boolean; count: number }> {
  return reserveRequestTokenSlotByKey([
    KV_KEYS.requestTokenRate,
    "uid",
    userId,
  ]);
}

/**
 * Try to reserve a request_token slot for the unknown-user (throwaway) branch
 * of `/request_token`, keyed on the lowercased input string the client
 * supplied. Throttling this branch is what preserves the username-enumeration
 * prevention: without it, the throttle on the real branch would itself
 * become an enumeration oracle (real → 429 after 3 calls; unknown →
 * unlimited 200s). The disjoint key namespace ("input" vs "uid") prevents
 * any cross-contamination with the real-user counter.
 *
 * The caller is responsible for normalizing (lowercasing) the input; this
 * helper does not transform its argument.
 *
 * @param normalizedInput - Lowercased identifier the client supplied (today
 *                          a username; in the future possibly an email).
 * @returns `{ allowed: true, count }` if the slot was reserved;
 *          `{ allowed: false, count }` if the limit has already been reached.
 */
export function tryReserveRequestTokenSlotByInput(
  normalizedInput: string,
): Promise<{ allowed: boolean; count: number }> {
  return reserveRequestTokenSlotByKey([
    KV_KEYS.requestTokenRate,
    "input",
    normalizedInput,
  ]);
}
