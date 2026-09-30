import { expect, nostrify, nrCommon } from "../../deps.ts";
import { validateEvent } from "./validate.ts";

const {
  MAP_NOTE_KIND,
  TRUSTROOTS_PROFILE_KIND,
  TRUSTROOTS_USERNAME_LABEL_NAMESPACE,
} = nrCommon;

const author = "a".repeat(64);

function event(
  kind: number,
  tags: string[][] = [],
  content = "",
): nostrify.NostrEvent {
  return {
    id: `${kind}`.padEnd(64, "0"),
    pubkey: author,
    created_at: 1,
    kind,
    tags,
    content,
    sig: "0".repeat(128),
  };
}

const note = event(MAP_NOTE_KIND);
const trustrootsProfile = (username: string) =>
  event(TRUSTROOTS_PROFILE_KIND, [
    ["L", TRUSTROOTS_USERNAME_LABEL_NAMESPACE],
    ["l", username, TRUSTROOTS_USERNAME_LABEL_NAMESPACE],
  ]);
const kindZeroProfile = (content: string) => event(0, [], content);

function fakePool(events: nostrify.NostrEvent[]) {
  const queriedKinds: number[] = [];
  const pool = {
    query(filters: nostrify.NostrFilter[]) {
      const kinds = filters.flatMap((filter) => filter.kinds ?? []);
      queriedKinds.push(...kinds);
      return Promise.resolve(
        events.filter((candidate) => kinds.includes(candidate.kind)),
      );
    },
  } as unknown as nostrify.NPool;
  return { pool, queriedKinds };
}

async function withNip5(
  names: Record<string, string>,
  fn: () => Promise<void>,
) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (input) => {
    const name = new URL(String(input)).searchParams.get("name") ?? "";
    const pubkey = names[name];
    return Promise.resolve(
      Response.json({ names: pubkey ? { [name]: pubkey } : {} }),
    );
  };
  try {
    await fn();
  } finally {
    globalThis.fetch = originalFetch;
  }
}

Deno.test("validateEvent rejects kinds other than map notes without querying", async () => {
  const { pool, queriedKinds } = fakePool([]);
  const result = await validateEvent(pool, event(1));
  expect.expect(result).toEqual({
    valid: false,
    reason: "Event kind 1 is not supported.",
  });
  expect.expect(queriedKinds).toEqual([]);
});

Deno.test("validateEvent accepts a note whose Trustroots profile passes NIP-5", async () => {
  const { pool } = fakePool([trustrootsProfile("alice")]);
  await withNip5({ alice: author }, async () => {
    expect.expect(await validateEvent(pool, note)).toEqual({ valid: true });
  });
});

Deno.test("validateEvent prefers the Trustroots profile over kind 0", async () => {
  const { pool } = fakePool([
    trustrootsProfile("alice"),
    kindZeroProfile(JSON.stringify({ trustrootsUsername: "mallory" })),
  ]);
  await withNip5({ alice: author }, async () => {
    expect.expect(await validateEvent(pool, note)).toEqual({ valid: true });
  });
});

Deno.test("validateEvent falls back to the kind 0 trustrootsUsername", async () => {
  const { pool } = fakePool([
    kindZeroProfile(JSON.stringify({ trustrootsUsername: "bob" })),
  ]);
  await withNip5({ bob: author }, async () => {
    expect.expect(await validateEvent(pool, note)).toEqual({ valid: true });
  });
});

Deno.test("validateEvent rejects missing, short or unparsable usernames", async () => {
  const noUsername = {
    valid: false,
    reason: "No Trustroots username found in your Nostr profile.",
  };
  for (
    const events of [
      [],
      [kindZeroProfile(JSON.stringify({ trustrootsUsername: "ab" }))],
      [kindZeroProfile("not json")],
    ]
  ) {
    const { pool } = fakePool(events);
    expect.expect(await validateEvent(pool, note)).toEqual(noUsername);
  }
});

Deno.test("validateEvent rejects usernames that fail NIP-5", async () => {
  const { pool } = fakePool([trustrootsProfile("carol")]);
  await withNip5({}, async () => {
    expect.expect(await validateEvent(pool, note)).toEqual({
      valid: false,
      reason: 'NIP-05 verification failed for username "carol".',
    });
  });
  await withNip5({ carol: "b".repeat(64) }, async () => {
    expect.expect(await validateEvent(pool, note)).toEqual({
      valid: false,
      reason: 'NIP-05 public key mismatch for username "carol".',
    });
  });
});
