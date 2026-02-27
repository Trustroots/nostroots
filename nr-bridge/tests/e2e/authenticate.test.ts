import { expect } from "jsr:@std/expect";
import { MongoClient } from "mongodb";
import { createApp } from "../../src/server.ts";
import { setKv, closeKv, createTokenRequest } from "../../src/db/kv.ts";
import type { TokenRequest } from "../../schemas/tokenRequest.ts";
import { TOKEN_EXPIRY_MS } from "../../schemas/tokenRequest.ts";

const MONGODB_URI =
  Deno.env.get("MONGODB_URI") ?? "mongodb://mongodb:27017/trustroots-dev";

async function seedUser(
  client: MongoClient,
  user: { username: string; email: string; firstName: string; lastName: string },
): Promise<void> {
  const dbName = new URL(MONGODB_URI).pathname.slice(1) || "trustroots-dev";
  const db = client.db(dbName);
  await db.collection("users").updateOne(
    { username: user.username },
    {
      $set: { ...user, nostrNpub: undefined },
      $setOnInsert: { created: new Date(), roles: ["user"], public: true },
    },
    { upsert: true },
  );
}

async function getUser(
  client: MongoClient,
  username: string,
): Promise<Record<string, unknown> | null> {
  const dbName = new URL(MONGODB_URI).pathname.slice(1) || "trustroots-dev";
  const db = client.db(dbName);
  return await db.collection("users").findOne({ username });
}

async function cleanupUser(
  client: MongoClient,
  username: string,
): Promise<void> {
  const dbName = new URL(MONGODB_URI).pathname.slice(1) || "trustroots-dev";
  const db = client.db(dbName);
  await db.collection("users").deleteOne({ username });
}

Deno.test({
  name: "#e2e2 POST /authenticate with valid code sets npub in MongoDB",
  async fn() {
    const client = new MongoClient(MONGODB_URI);
    const kv = await Deno.openKv(":memory:");
    await setKv(kv);

    try {
      await client.connect();
      await seedUser(client, {
        username: "e2eauthuser",
        email: "auth@test.example.com",
        firstName: "Auth",
        lastName: "Test",
      });

      const now = Date.now();
      const code = "987654";
      const token = crypto.randomUUID();
      const tokenRequest: TokenRequest = {
        id: crypto.randomUUID(),
        username: "e2eauthuser",
        email: "auth@test.example.com",
        code,
        token,
        createdAt: now,
        expiresAt: now + TOKEN_EXPIRY_MS,
      };
      await createTokenRequest(tokenRequest);

      const app = createApp();
      const npub = "npub1e2etestpubkey123";

      const res = await app.request("/authenticate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: "e2eauthuser",
          npub,
          code,
        }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);

      const user = await getUser(client, "e2eauthuser");
      expect(user).not.toBeNull();
      expect(user!.nostrNpub).toBe(npub);
    } finally {
      await cleanupUser(client, "e2eauthuser");
      await client.close();
      await closeKv();
    }
  },
  sanitizeOps: false,
  sanitizeResources: false,
});

Deno.test({
  name: "#e2e3 POST /authenticate with valid token sets npub in MongoDB",
  async fn() {
    const client = new MongoClient(MONGODB_URI);
    const kv = await Deno.openKv(":memory:");
    await setKv(kv);

    try {
      await client.connect();
      await seedUser(client, {
        username: "e2etokenuser",
        email: "token@test.example.com",
        firstName: "Token",
        lastName: "Test",
      });

      const now = Date.now();
      const token = crypto.randomUUID();
      const tokenRequest: TokenRequest = {
        id: crypto.randomUUID(),
        username: "e2etokenuser",
        email: "token@test.example.com",
        code: "111222",
        token,
        createdAt: now,
        expiresAt: now + TOKEN_EXPIRY_MS,
      };
      await createTokenRequest(tokenRequest);

      const app = createApp();
      const npub = "npub1tokentestpubkey456";

      const res = await app.request("/authenticate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: "e2etokenuser",
          npub,
          token,
        }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);

      const user = await getUser(client, "e2etokenuser");
      expect(user).not.toBeNull();
      expect(user!.nostrNpub).toBe(npub);
    } finally {
      await cleanupUser(client, "e2etokenuser");
      await client.close();
      await closeKv();
    }
  },
  sanitizeOps: false,
  sanitizeResources: false,
});

Deno.test({
  name: "#e2e4 POST /authenticate with expired token returns 401",
  async fn() {
    const client = new MongoClient(MONGODB_URI);
    const kv = await Deno.openKv(":memory:");
    await setKv(kv);

    try {
      await client.connect();
      await seedUser(client, {
        username: "e2eexpireduser",
        email: "expired@test.example.com",
        firstName: "Expired",
        lastName: "Test",
      });

      const now = Date.now();
      const tokenRequest: TokenRequest = {
        id: crypto.randomUUID(),
        username: "e2eexpireduser",
        email: "expired@test.example.com",
        code: "333444",
        token: crypto.randomUUID(),
        createdAt: now - TOKEN_EXPIRY_MS - 1000,
        expiresAt: now - 1000,
      };
      await createTokenRequest(tokenRequest);

      const app = createApp();
      const res = await app.request("/authenticate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: "e2eexpireduser",
          npub: "npub1expiredtest789",
          code: "333444",
        }),
      });

      expect(res.status).toBe(401);
    } finally {
      await cleanupUser(client, "e2eexpireduser");
      await client.close();
      await closeKv();
    }
  },
  sanitizeOps: false,
  sanitizeResources: false,
});
