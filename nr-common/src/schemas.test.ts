import { expect } from "jsr:@std/expect";
import {
  MAP_NOTE_KIND,
  MAP_NOTE_REPOST_KIND,
  NOSTROOTS_METRICS_KIND,
  NOTIFICATION_SERVER_PUBKEY,
  NOTIFICATION_SUBSCRIPTION_KIND,
  OPEN_LOCATION_CODE_TAG_NAME,
  PING_ACK_KIND,
  SERVER_MESSAGE_KIND,
  TRUSTROOTS_PROFILE_KIND,
  TRUSTROOTS_USERNAME_LABEL_NAMESPACE,
} from "../constants.ts";
import {
  createKind10390EventTemplate,
  kind10390EventSchema,
} from "./10390.schema.ts";
import {
  create10395EventTemplate,
  validate10395EventData,
} from "./10395.schema.ts";
import { kind20398EventSchema } from "./20398.schema.ts";
import { ackEventSchema, pingEventSchema } from "./20400.schema.ts";
import { kind30400EventSchema } from "./30400.schema.ts";
import type { Event } from "./base.schema.ts";
import { getAuthorFromEvent } from "./getAuthorFromEvent.ts";
import { isValidEvent } from "./isValidEvent.ts";
import { PlusCodeSchema } from "./plusCode.schema.ts";

const AUTHOR = "a".repeat(64);
const OTHER = "b".repeat(64);
const EVENT_ID = "c".repeat(64);
const PLUS_CODE = "8FVC9G8F+6W";

function makeEvent(overrides: Partial<Event> = {}): Event {
  return {
    id: "d".repeat(64),
    pubkey: AUTHOR,
    sig: "e".repeat(128),
    kind: 1,
    created_at: 1_700_000_000,
    tags: [],
    content: "hello",
    ...overrides,
  };
}

const plusCodeTags = [
  ["L", OPEN_LOCATION_CODE_TAG_NAME],
  ["l", PLUS_CODE, OPEN_LOCATION_CODE_TAG_NAME],
];

const usernameTags = [
  ["L", TRUSTROOTS_USERNAME_LABEL_NAMESPACE],
  ["l", "alice", TRUSTROOTS_USERNAME_LABEL_NAMESPACE],
];

function metricsEvent(tags: string[][], content: unknown): Event {
  return makeEvent({
    kind: NOSTROOTS_METRICS_KIND,
    tags,
    content: typeof content === "string" ? content : JSON.stringify(content),
  });
}

const metricsTags = [
  ["d", "2026-09"],
  ["t", "messages"],
];

Deno.test("isValidEvent accepts a generic event and rejects extra fields", () => {
  expect(isValidEvent(makeEvent())).toBe(true);
  expect(isValidEvent({ ...makeEvent(), extra: 1 } as Event)).toBe(false);
  expect(isValidEvent(makeEvent({ pubkey: "short" }))).toBe(false);
});

Deno.test("isValidEvent requires a plus code on map notes and reposts", () => {
  for (const kind of [MAP_NOTE_KIND, MAP_NOTE_REPOST_KIND]) {
    expect(isValidEvent(makeEvent({ kind, tags: plusCodeTags }))).toBe(true);
    expect(isValidEvent(makeEvent({ kind, tags: [] }))).toBe(false);
    expect(
      isValidEvent(makeEvent({ kind, tags: plusCodeTags, content: "hi" })),
    ).toBe(false);
  }
});

Deno.test("isValidEvent requires a trustroots username on profiles", () => {
  expect(
    isValidEvent(
      makeEvent({ kind: TRUSTROOTS_PROFILE_KIND, tags: usernameTags }),
    ),
  ).toBe(true);
  expect(isValidEvent(makeEvent({ kind: TRUSTROOTS_PROFILE_KIND }))).toBe(
    false,
  );
});

Deno.test("isValidEvent validates notification subscriptions and metrics", () => {
  expect(
    isValidEvent(makeEvent({ kind: NOTIFICATION_SUBSCRIPTION_KIND })),
  ).toBe(true);
  expect(isValidEvent(metricsEvent(metricsTags, { [PLUS_CODE]: 2 }))).toBe(
    true,
  );
  expect(isValidEvent(metricsEvent(metricsTags, "not json"))).toBe(false);
});

Deno.test("isValidEvent validates server messages", () => {
  const serverMessage = (tags: string[][]) =>
    makeEvent({ kind: SERVER_MESSAGE_KIND, tags, content: "Note rejected" });

  expect(isValidEvent(serverMessage([["p", OTHER]]))).toBe(true);
  expect(isValidEvent(serverMessage([["p", "not-a-key"]]))).toBe(false);
});

Deno.test("createKind10390EventTemplate produces a valid profile once signed", () => {
  const template = createKind10390EventTemplate("alice");

  expect(template.kind).toBe(TRUSTROOTS_PROFILE_KIND);
  expect(template.tags).toEqual(usernameTags);
  expect(
    kind10390EventSchema.safeParse({ ...makeEvent(), ...template }).success,
  ).toBe(true);
});

Deno.test("kind10390EventSchema rejects a too-short username", () => {
  const event = makeEvent({
    kind: TRUSTROOTS_PROFILE_KIND,
    tags: [
      ["L", TRUSTROOTS_USERNAME_LABEL_NAMESPACE],
      ["l", "ab", TRUSTROOTS_USERNAME_LABEL_NAMESPACE],
    ],
  });
  expect(kind10390EventSchema.safeParse(event).success).toBe(false);
});

Deno.test("create10395EventTemplate addresses the notification server", () => {
  const template = create10395EventTemplate("encrypted");

  expect(template.kind).toBe(NOTIFICATION_SUBSCRIPTION_KIND);
  expect(template.content).toBe("encrypted");
  expect(template.tags).toEqual([["p", NOTIFICATION_SERVER_PUBKEY]]);
});

Deno.test("validate10395EventData accepts tokens with filters and rejects bad filters", () => {
  const data = {
    tokens: [{ expoPushToken: "ExponentPushToken[abc]" }],
    filters: [{ filter: { kinds: [MAP_NOTE_REPOST_KIND], "#L": ["x"] } }],
  };
  expect(validate10395EventData(data)).toBe(data);

  expect(() =>
    validate10395EventData(
      {
        tokens: [],
        filters: [{ filter: { kinds: ["30398"] } }],
      } as unknown as typeof data,
    )
  ).toThrow();
});

Deno.test("kind30400EventSchema accepts per-plus-code counts", () => {
  const event = metricsEvent(metricsTags, { [PLUS_CODE]: 0, "9C3XGV00+": 5 });
  expect(kind30400EventSchema.safeParse(event).success).toBe(true);
});

Deno.test("kind30400EventSchema rejects missing, duplicate or blank d tags", () => {
  for (
    const tags of [
      [["t", "messages"]],
      [["d", "a"], ["d", "b"], ["t", "messages"]],
      [["d", "  "], ["t", "messages"]],
    ]
  ) {
    expect(
      kind30400EventSchema.safeParse(metricsEvent(tags, { [PLUS_CODE]: 1 }))
        .success,
    ).toBe(false);
  }
});

Deno.test("kind30400EventSchema rejects unknown or repeated metrics types", () => {
  for (
    const tags of [
      [["d", "x"], ["t", "pageviews"]],
      [["d", "x"], ["t", "messages"], ["t", "messages"]],
    ]
  ) {
    expect(
      kind30400EventSchema.safeParse(metricsEvent(tags, { [PLUS_CODE]: 1 }))
        .success,
    ).toBe(false);
  }
});

Deno.test("kind30400EventSchema rejects non-object content, bad keys and bad counts", () => {
  for (
    const content of [
      "[]",
      "null",
      { "not-a-plus-code": 1 },
      { [PLUS_CODE]: -1 },
      { [PLUS_CODE]: 1.5 },
      { [PLUS_CODE]: "1" },
    ]
  ) {
    expect(
      kind30400EventSchema.safeParse(metricsEvent(metricsTags, content))
        .success,
    ).toBe(false);
  }
});

Deno.test("kind20398EventSchema validates optional p, e and message type tags", () => {
  const withTags = (tags: string[][]) =>
    kind20398EventSchema.safeParse(
      makeEvent({ kind: SERVER_MESSAGE_KIND, tags, content: "msg" }),
    ).success;

  expect(withTags([])).toBe(true);
  expect(
    withTags([["p", OTHER], ["e", EVENT_ID], ["serverMessageType", "error"]]),
  ).toBe(true);
  expect(withTags([["e", "short"]])).toBe(false);
  expect(withTags([["serverMessageType", "warning"]])).toBe(false);
  expect(
    kind20398EventSchema.safeParse(
      makeEvent({ kind: SERVER_MESSAGE_KIND, content: "" }),
    ).success,
  ).toBe(false);
});

Deno.test("pingEventSchema needs at least one valid p tag", () => {
  const ping = (tags: string[][]) =>
    pingEventSchema.safeParse(
      makeEvent({ kind: PING_ACK_KIND, content: "ping", tags }),
    ).success;

  expect(ping([["p", OTHER]])).toBe(true);
  expect(ping([])).toBe(false);
  expect(ping([["p", OTHER], ["p", "nope"]])).toBe(false);
});

Deno.test("ackEventSchema needs valid e and p tags", () => {
  const ack = (tags: string[][]) =>
    ackEventSchema.safeParse(
      makeEvent({ kind: PING_ACK_KIND, content: "ack", tags }),
    ).success;

  expect(ack([["e", EVENT_ID], ["p", OTHER]])).toBe(true);
  expect(ack([["p", OTHER]])).toBe(false);
  expect(ack([["e", EVENT_ID]])).toBe(false);
  expect(
    ackEventSchema.safeParse(
      makeEvent({
        kind: PING_ACK_KIND,
        content: "ping",
        tags: [["e", EVENT_ID], ["p", OTHER]],
      }),
    ).success,
  ).toBe(false);
});

Deno.test("getAuthorFromEvent returns the original author of a repost", () => {
  const repost = makeEvent({
    kind: MAP_NOTE_REPOST_KIND,
    tags: [...plusCodeTags, ["p", OTHER]],
  });
  expect(getAuthorFromEvent(repost)).toBe(OTHER);
});

Deno.test("getAuthorFromEvent returns the signer for other kinds", () => {
  expect(getAuthorFromEvent(makeEvent())).toBe(AUTHOR);
  expect(
    getAuthorFromEvent(makeEvent({ kind: MAP_NOTE_KIND, tags: plusCodeTags })),
  ).toBe(AUTHOR);
});

Deno.test("getAuthorFromEvent returns undefined for malformed events", () => {
  expect(getAuthorFromEvent(makeEvent({ pubkey: "short" }))).toBeUndefined();
});

Deno.test("PlusCodeSchema accepts full and padded codes and rejects junk", () => {
  expect(PlusCodeSchema.safeParse(PLUS_CODE).success).toBe(true);
  expect(PlusCodeSchema.safeParse("9C3XGV00+").success).toBe(true);
  expect(PlusCodeSchema.safeParse("9C3X+").success).toBe(false);
  expect(PlusCodeSchema.safeParse("8FVC9G8F+6").success).toBe(false);
  expect(PlusCodeSchema.safeParse("9C00GV00+").success).toBe(false);
  expect(PlusCodeSchema.safeParse("hello world").success).toBe(false);
});
