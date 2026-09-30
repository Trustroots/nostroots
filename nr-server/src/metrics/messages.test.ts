import { expect, nostrify, nrCommon } from "../../deps.ts";
import { fetchMessageCounts } from "./messages.ts";

const { MAP_NOTE_REPOST_KIND, OPEN_LOCATION_CODE_TAG_NAME } = nrCommon;

type ReqMessage =
  | nostrify.NostrRelayEVENT
  | nostrify.NostrRelayEOSE
  | nostrify.NostrRelayCLOSED;

function makeRepost(plusCode: string | undefined, createdAt: number) {
  const tags = plusCode
    ? [
      ["L", OPEN_LOCATION_CODE_TAG_NAME],
      ["l", plusCode, OPEN_LOCATION_CODE_TAG_NAME],
    ]
    : [];
  return {
    id: crypto.randomUUID(),
    pubkey: "a".repeat(64),
    sig: "",
    kind: MAP_NOTE_REPOST_KIND,
    created_at: createdAt,
    tags,
    content: "note",
  } as nostrify.NostrEvent;
}

/**
 * Mimics NPool.req: after EOSE the subscription stays open until the caller
 * stops iterating or the signal aborts.
 */
function fakePool(
  pages: nostrify.NostrEvent[][],
  end: ReqMessage = ["EOSE", "sub"],
) {
  const filters: nostrify.NostrFilter[] = [];
  let openSubscriptions = 0;

  const pool = {
    async *req(
      [filter]: nostrify.NostrFilter[],
      opts?: { signal?: AbortSignal },
    ): AsyncIterable<ReqMessage> {
      filters.push(filter);
      openSubscriptions++;
      try {
        for (const event of pages[filters.length - 1] ?? []) {
          yield ["EVENT", "sub", event];
        }
        yield end;
        await new Promise((_, reject) =>
          opts?.signal?.addEventListener(
            "abort",
            () => reject(new Error("aborted")),
          )
        );
      } finally {
        openSubscriptions--;
      }
    },
  };

  return {
    pool: pool as unknown as nostrify.NPool,
    filters,
    openSubscriptions: () => openSubscriptions,
  };
}

Deno.test("fetchMessageCounts counts reposts per plus code and closes the subscription at EOSE", async () => {
  const { pool, openSubscriptions } = fakePool([[
    makeRepost("9C3XGV00+", 100),
    makeRepost("9C3XGV00+", 99),
    makeRepost("8FVC9G8F+6W", 98),
    makeRepost(undefined, 97),
  ]]);

  const started = Date.now();
  const counts = await fetchMessageCounts(pool, "b".repeat(64));

  expect.expect(counts).toEqual({ "9C3XGV00+": 2, "8FVC9G8F+6W": 1 });
  expect.expect(Date.now() - started).toBeLessThan(1000);
  expect.expect(openSubscriptions()).toBe(0);
});

Deno.test("fetchMessageCounts pages backwards until a short page", async () => {
  const fullPage = Array.from(
    { length: 1000 },
    (_, index) => makeRepost("9C3XGV00+", 2000 - index),
  );
  const { pool, filters, openSubscriptions } = fakePool([
    fullPage,
    [makeRepost("8FVC9G8F+6W", 500)],
  ]);

  const counts = await fetchMessageCounts(pool, "b".repeat(64));

  expect.expect(counts).toEqual({ "9C3XGV00+": 1000, "8FVC9G8F+6W": 1 });
  expect.expect(filters.map((filter) => filter.until).slice(1)).toEqual([
    1000,
  ]);
  expect.expect(openSubscriptions()).toBe(0);
});

Deno.test("fetchMessageCounts fails instead of returning partial counts when relays close the subscription", async () => {
  const { pool, openSubscriptions } = fakePool(
    [[makeRepost("9C3XGV00+", 100)]],
    ["CLOSED", "sub", "rate-limited: slow down"],
  );

  await expect.expect(fetchMessageCounts(pool, "b".repeat(64))).rejects
    .toThrow("rate-limited: slow down");
  expect.expect(openSubscriptions()).toBe(0);
});
