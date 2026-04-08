import { expect } from "jsr:@std/expect";
import { MongoClient } from "mongodb";
import { createApp } from "../../src/server.ts";
import { createPendingVerification } from "../../src/db/kv.ts";
import type { PendingVerification } from "../../schemas/pendingVerification.ts";
import { TOKEN_EXPIRY_MS } from "../../schemas/pendingVerification.ts";
import { MONGODB_DB_NAME, MONGODB_URI } from "../../src/config.ts";

async function seedUser(
  client: MongoClient,
  user: {
    username: string;
    email: string;
    firstName: string;
    lastName: string;
  },
): Promise<void> {
  const db = client.db(MONGODB_DB_NAME);
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
  const db = client.db(MONGODB_DB_NAME);
  return await db.collection("users").findOne({ username });
}

async function cleanupUser(
  client: MongoClient,
  username: string,
): Promise<void> {
  const db = client.db(MONGODB_DB_NAME);
  await db.collection("users").deleteOne({ username });
}

Deno.test({
  name: "#e2e2 POST /verify_code with valid token+code sets npub in MongoDB",
  async fn() {
    const client = new MongoClient(MONGODB_URI);

    try {
      await client.connect();
      await seedUser(client, {
        username: "e2eauthuser",
        email: "auth@test.example.com",
        firstName: "Auth",
        lastName: "Test",
      });

      const now = Date.now();
      const token = crypto.randomUUID();
      const code = "987654";
      const verification: PendingVerification = {
        id: crypto.randomUUID(),
        username: "e2eauthuser",
        email: "auth@test.example.com",
        token,
        code,
        createdAt: now,
        expiresAt: now + TOKEN_EXPIRY_MS,
        attempts: 0,
      };
      await createPendingVerification(verification);

      const app = createApp();
      const npub = "npub1e2etestpubkey123";

      const res = await app.request("/verify_code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ npub, token, code }),
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
    }
  },
  sanitizeOps: false,
  sanitizeResources: false,
});

Deno.test({
  name: "#e2e3 POST /verify_code with wrong code returns 401",
  async fn() {
    const client = new MongoClient(MONGODB_URI);

    try {
      await client.connect();
      await seedUser(client, {
        username: "e2ewrongcode",
        email: "wrongcode@test.example.com",
        firstName: "Wrong",
        lastName: "Code",
      });

      const now = Date.now();
      const token = crypto.randomUUID();
      const verification: PendingVerification = {
        id: crypto.randomUUID(),
        username: "e2ewrongcode",
        email: "wrongcode@test.example.com",
        token,
        code: "111222",
        createdAt: now,
        expiresAt: now + TOKEN_EXPIRY_MS,
        attempts: 0,
      };
      await createPendingVerification(verification);

      const app = createApp();
      const res = await app.request("/verify_code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          npub: "npub1wrongcode",
          token,
          code: "999999",
        }),
      });

      expect(res.status).toBe(401);
    } finally {
      await cleanupUser(client, "e2ewrongcode");
      await client.close();
    }
  },
  sanitizeOps: false,
  sanitizeResources: false,
});

Deno.test({
  name: "#e2e4 POST /verify_code with expired token returns 401",
  async fn() {
    const client = new MongoClient(MONGODB_URI);

    try {
      await client.connect();
      await seedUser(client, {
        username: "e2eexpireduser",
        email: "expired@test.example.com",
        firstName: "Expired",
        lastName: "Test",
      });

      const now = Date.now();
      const token = crypto.randomUUID();
      const verification: PendingVerification = {
        id: crypto.randomUUID(),
        username: "e2eexpireduser",
        email: "expired@test.example.com",
        token,
        code: "333444",
        createdAt: now - TOKEN_EXPIRY_MS - 1000,
        expiresAt: now - 1000,
        attempts: 0,
      };
      await createPendingVerification(verification);

      const app = createApp();
      const res = await app.request("/verify_code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          npub: "npub1expiredtest789",
          token,
          code: "333444",
        }),
      });

      expect(res.status).toBe(401);
    } finally {
      await cleanupUser(client, "e2eexpireduser");
      await client.close();
    }
  },
  sanitizeOps: false,
  sanitizeResources: false,
});
