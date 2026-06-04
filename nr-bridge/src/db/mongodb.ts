/**
 * @module mongodb
 *
 * MongoDB client and query helpers for the Trustroots `users` collection.
 *
 * The shared {@link MongoClient} is constructed at module load. Connections
 * are established lazily by the driver on the first query.
 */
import { type Collection, MongoClient } from "mongodb";
import { MONGODB_DB_NAME, MONGODB_URI } from "../config.ts";

const mongoClient = new MongoClient(MONGODB_URI);
const usersCollection: Collection = mongoClient
  .db(MONGODB_DB_NAME)
  .collection("users");

/**
 * Look up a Trustroots user by their username.
 *
 * @param username - Case-insensitive Trustroots username.
 * @returns The user's stringified Mongo `_id` (as `id`), `email`, `username`,
 *          and optional `nostrNpub`, or `null` if no matching user exists.
 *          The returned `id` is the canonical user identifier — stable across
 *          username changes and the same regardless of whether the user was
 *          looked up by username or (in the future) by email. It is the
 *          correct key for per-user rate limiting.
 */
export async function findUserByUsername(
  username: string,
): Promise<
  { id: string; email: string; username: string; nostrNpub?: string } | null
> {
  const user = await usersCollection.findOne(
    { username: username.toLowerCase() },
    { projection: { _id: 1, email: 1, username: 1, nostrNpub: 1 } },
  );
  if (!user) return null;
  return {
    id: user._id.toString(),
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
  const result = await usersCollection.updateOne(
    { username: username.toLowerCase() },
    { $set: { nostrNpub: npub, updated: new Date() } },
  );
  return result.modifiedCount === 1;
}
