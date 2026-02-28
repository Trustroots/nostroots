/**
 * @module kv
 *
 * Deno KV operations for storing and retrieving token requests.
 *
 * Token requests are stored under the key `["tokenRequests", username]` and
 * automatically expire via the KV `expireIn` option. An additional
 * application-level check on `expiresAt` guards against clock drift.
 */
import type { TokenRequest } from "../../schemas/tokenRequest.ts";
import { TOKEN_EXPIRY_MS } from "../../schemas/tokenRequest.ts";

let kv: Deno.Kv | null = null;

/**
 * Return the shared Deno KV store, opening it on first call.
 *
 * The store path is read from the `DENO_KV_PATH` env var; when unset Deno uses
 * its default location.
 *
 * @returns The open {@link Deno.Kv} instance.
 */
export async function getKv(): Promise<Deno.Kv> {
  if (kv) return kv;
  const path = Deno.env.get("DENO_KV_PATH");
  kv = await Deno.openKv(path);
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
