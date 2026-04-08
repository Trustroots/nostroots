import { expect } from "jsr:@std/expect";
import { MongoClient } from "mongodb";
import { createApp } from "../../src/server.ts";
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
      $set: user,
      $setOnInsert: { created: new Date(), roles: ["user"], public: true },
    },
    { upsert: true },
  );
}

async function cleanupUser(
  client: MongoClient,
  username: string,
): Promise<void> {
  const db = client.db(MONGODB_DB_NAME);
  await db.collection("users").deleteOne({ username });
}

Deno.test({
  name: "#e2e1 POST /request_token validation and 404 paths",
  async fn() {
    const client = new MongoClient(MONGODB_URI);

    try {
      await client.connect();
      await seedUser(client, {
        username: "e2etestuser",
        email: "e2e@test.example.com",
        firstName: "E2E",
        lastName: "Test",
      });

      const app = createApp();

      // Test: missing username returns 400
      const res400 = await app.request("/request_token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      expect(res400.status).toBe(400);

      // Test: nonexistent user returns 404
      const res404 = await app.request("/request_token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: "nonexistent_e2e_user_xyz" }),
      });
      expect(res404.status).toBe(404);
    } finally {
      await cleanupUser(client, "e2etestuser");
      await client.close();
    }
  },
  sanitizeOps: false,
  sanitizeResources: false,
});
