import { expect } from "jsr:@std/expect";
import {
  createTokenRequest,
  getTokenRequest,
  deleteTokenRequest,
  setKv,
  closeKv,
} from "../../src/db/kv.ts";
import type { TokenRequest } from "../../schemas/tokenRequest.ts";
import { TOKEN_EXPIRY_MS } from "../../schemas/tokenRequest.ts";

async function withTestKv(
  fn: (kv: Deno.Kv) => Promise<void>,
): Promise<void> {
  const kv = await Deno.openKv(":memory:");
  await setKv(kv);
  try {
    await fn(kv);
  } finally {
    await closeKv();
  }
}

function makeTokenRequest(
  overrides?: Partial<TokenRequest>,
): TokenRequest {
  const now = Date.now();
  return {
    id: crypto.randomUUID(),
    username: "testuser",
    email: "test@example.com",
    code: "123456",
    token: crypto.randomUUID(),
    createdAt: now,
    expiresAt: now + TOKEN_EXPIRY_MS,
    ...overrides,
  };
}

Deno.test("#kv1 createTokenRequest stores and getTokenRequest retrieves", async () => {
  await withTestKv(async () => {
    const req = makeTokenRequest();
    await createTokenRequest(req);
    const result = await getTokenRequest("testuser");
    expect(result).not.toBeNull();
    expect(result!.id).toBe(req.id);
    expect(result!.code).toBe(req.code);
    expect(result!.token).toBe(req.token);
    expect(result!.email).toBe(req.email);
  });
});

Deno.test("#kv2 getTokenRequest returns null for nonexistent username", async () => {
  await withTestKv(async () => {
    const result = await getTokenRequest("nonexistent");
    expect(result).toBeNull();
  });
});

Deno.test("#kv3 deleteTokenRequest removes the entry", async () => {
  await withTestKv(async () => {
    const req = makeTokenRequest();
    await createTokenRequest(req);
    await deleteTokenRequest("testuser");
    const result = await getTokenRequest("testuser");
    expect(result).toBeNull();
  });
});

Deno.test("#kv4 getTokenRequest returns null for expired entry", async () => {
  await withTestKv(async () => {
    const now = Date.now();
    const req = makeTokenRequest({
      createdAt: now - TOKEN_EXPIRY_MS - 1000,
      expiresAt: now - 1000,
    });
    await createTokenRequest(req);
    const result = await getTokenRequest("testuser");
    expect(result).toBeNull();
  });
});
