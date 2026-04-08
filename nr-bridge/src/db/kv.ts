/**
 * @module kv
 *
 * Deno KV operations for storing and retrieving pending email verifications.
 *
 * Records are stored under `[KV_KEYS.pendingVerifications, token]` and
 * automatically expire via the KV `expireIn` option. An additional
 * application-level check on `expiresAt` guards against clock drift.
 */
import type { PendingVerification } from "../../schemas/pendingVerification.ts";
import { DENO_KV_PATH } from "../config.ts";

/**
 * KV key prefixes. Defined as constants so the strings are not repeated across
 * the codebase.
 */
export const KV_KEYS = {
  pendingVerifications: "pendingVerifications",
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
