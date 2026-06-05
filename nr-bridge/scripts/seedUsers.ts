/**
 * Development seed utilities for the Trustroots MongoDB `users` collection.
 *
 * Commands:
 * - `deno task seed:dev-users` inserts two stable dev users if missing.
 * - `deno task seed:fake-user` inserts one newly generated faker user.
 */
import { faker } from "@faker-js/faker";
import {
  type NrBridgeUser,
  NrBridgeUserSchema,
} from "../schemas/nrBridgeUser.ts";
import { closeMongoClient, getUsersCollection } from "../src/db/mongodb.ts";

const FIXED_DEV_USERS: NrBridgeUser[] = [
  NrBridgeUserSchema.parse({
    username: "alice",
    email: "alice@example.test",
    created: new Date("2026-01-01T00:00:00.000Z"),
    updated: new Date("2026-01-01T00:00:00.000Z"),
  }),
  NrBridgeUserSchema.parse({
    username: "bob",
    email: "bob@example.test",
    created: new Date("2026-01-01T00:00:00.000Z"),
    updated: new Date("2026-01-01T00:00:00.000Z"),
  }),
];

function printUsage(): never {
  console.error(`Usage:
  deno task seed:dev-users
  deno task seed:fake-user

Direct script usage:
  deno run --allow-net --allow-env scripts/seedUsers.ts dev-users
  deno run --allow-net --allow-env scripts/seedUsers.ts fake-user`);
  Deno.exit(1);
}

function normalizeUsername(input: string): string {
  const username = input
    .trim()
    .toLowerCase()
    .replace(/[^0-9a-z.\-_]/g, "-")
    .replace(/\.+/g, ".")
    .replace(/^[^0-9a-z]+/, "")
    .replace(/[^0-9a-z]+$/, "")
    .slice(0, 28);

  return username.length >= 3
    ? username
    : `user-${faker.string.alphanumeric(8).toLowerCase()}`;
}

async function seedFixedDevUsers(): Promise<void> {
  const users = await getUsersCollection();
  let insertedCount = 0;
  let existingCount = 0;

  for (const user of FIXED_DEV_USERS) {
    const result = await users.updateOne(
      { username: user.username },
      { $setOnInsert: user },
      { upsert: true },
    );

    if (result.upsertedCount === 1) {
      insertedCount += 1;
      console.log(`Created dev user ${user.username} <${user.email}>`);
    } else {
      existingCount += 1;
      console.log(`Skipped existing dev user ${user.username}`);
    }
  }

  console.log(
    `Seeded fixed dev users: ${insertedCount} created, ${existingCount} already existed.`,
  );
}

async function buildUniqueFakeUser(): Promise<NrBridgeUser> {
  const users = await getUsersCollection();
  const firstName = faker.person.firstName();
  const lastName = faker.person.lastName();
  const baseUsername = normalizeUsername(
    faker.internet.username({ firstName, lastName }),
  );

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const suffix = attempt === 0
      ? ""
      : `-${faker.string.alphanumeric(6).toLowerCase()}`;
    const username = `${baseUsername}${suffix}`.slice(0, 34);
    const existing = await users.findOne({ username });

    if (!existing) {
      return NrBridgeUserSchema.parse({
        username,
        email: faker.internet.email({ firstName, lastName }).toLowerCase(),
        created: new Date(),
        updated: new Date(),
      });
    }
  }

  throw new Error("Could not generate a unique fake username.");
}

async function seedFakeUser(): Promise<void> {
  const users = await getUsersCollection();
  const user = await buildUniqueFakeUser();
  await users.insertOne(user);
  console.log(`Created fake user ${user.username} <${user.email}>`);
}

async function main(): Promise<void> {
  const command = Deno.args[0];

  try {
    if (command === "dev-users") {
      await seedFixedDevUsers();
      return;
    }

    if (command === "fake-user") {
      await seedFakeUser();
      return;
    }

    printUsage();
  } finally {
    await closeMongoClient();
  }
}

if (import.meta.main) {
  await main();
}
