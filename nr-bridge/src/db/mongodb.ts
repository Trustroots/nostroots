/**
 * @module mongodb
 *
 * Lazily-initialised MongoDB client and query helpers for the Trustroots
 * `users` collection.
 */
import { MongoClient, type Db, type Collection } from "mongodb";
import { MONGODB_DB_NAME, MONGODB_URI } from "../config.ts";

let client: MongoClient | null = null;
let db: Db | null = null;

/**
 * Return a connected {@link MongoClient}, creating one on the first call.
 *
 * @returns The shared MongoClient instance.
 */
export async function getMongoClient(): Promise<MongoClient> {
  if (client) return client;
  client = new MongoClient(MONGODB_URI);
  await client.connect();
  return client;
}

/**
 * Return the application {@link Db} handle, deriving the database name from
 * `MONGODB_URI`.
 *
 * @returns The Mongo database instance.
 */
export async function getDb(): Promise<Db> {
  if (db) return db;
  const c = await getMongoClient();
  db = c.db(MONGODB_DB_NAME);
  return db;
}

/**
 * Convenience accessor for the `users` collection.
 *
 * @returns A promise resolving to the `users` {@link Collection}.
 */
export function getUsersCollection(): Promise<Collection> {
  return getDb().then((d) => d.collection("users"));
}

/**
 * Look up a Trustroots user by their username.
 *
 * @param username - Case-insensitive Trustroots username.
 * @returns The user's `email`, `username`, and optional `nostrNpub`, or `null`
 *          if no matching user exists.
 */
export async function findUserByUsername(
  username: string,
): Promise<{ email: string; username: string; nostrNpub?: string } | null> {
  const users = await getUsersCollection();
  const user = await users.findOne(
    { username: username.toLowerCase() },
    { projection: { email: 1, username: 1, nostrNpub: 1 } },
  );
  if (!user) return null;
  return {
    email: user.email as string,
    username: user.username as string,
    nostrNpub: (user.nostrNpub as string) ?? undefined,
  };
}

/**
 * Set the `nostrNpub` field on a user document and update the `updated`
 * timestamp.
 *
 * @param username - The Trustroots username to update.
 * @param npub    - The Nostr public key (`npub1...`) to store.
 * @returns `true` if exactly one document was modified, `false` otherwise.
 */
export async function setNpubForUsername(
  username: string,
  npub: string,
): Promise<boolean> {
  const users = await getUsersCollection();
  const result = await users.updateOne(
    { username: username.toLowerCase() },
    { $set: { nostrNpub: npub, updated: new Date() } },
  );
  return result.modifiedCount === 1;
}

/**
 * Close the shared MongoDB client and reset internal state. Safe to call even
 * if no client has been created.
 */
export async function closeMongoClient(): Promise<void> {
  if (client) {
    await client.close();
    client = null;
    db = null;
  }
}
