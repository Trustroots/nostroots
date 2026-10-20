import { expect } from "jsr:@std/expect";
import {
  NOTIFICATION_SERVER_PUBKEY,
  NOTIFICATION_SUBSCRIPTION_KIND,
} from "../constants.ts";
import {
  create10395EventTemplate,
  kind10395ContentDecryptedDecodedSchema,
  kind10395EventSchema,
  kind10395EventTemplateSchema,
  validate10395EventData,
} from "./10395.schema.ts";
import { makeEvent, makeSubscription } from "./testEvents.ts";

const validData = {
  tokens: [{ expoPushToken: "ExponentPushToken[abc]" }],
  filters: [{ filter: { kinds: [30397], limit: 10 } }],
};

Deno.test("kind 10395 accepts a finalized subscription event", () => {
  expect(kind10395EventSchema.safeParse(makeSubscription()).success).toBe(true);
});

Deno.test("kind 10395 accepts empty content and no tags", () => {
  const event = makeSubscription({ content: "", tags: [] });
  expect(kind10395EventSchema.safeParse(event).success).toBe(true);
});

Deno.test("kind 10395 rejects another kind", () => {
  expect(kind10395EventSchema.safeParse(makeEvent()).success).toBe(false);
});

Deno.test("kind 10395 rejects non-string content and malformed tags", () => {
  expect(
    kind10395EventSchema.safeParse(makeSubscription({ content: 5 })).success,
  )
    .toBe(false);
  expect(
    kind10395EventSchema.safeParse(makeSubscription({ tags: [[1]] })).success,
  ).toBe(false);
});

Deno.test("kind 10395 rejects an event that is not finalized", () => {
  const { sig: _sig, ...withoutSig } = makeSubscription();
  expect(kind10395EventSchema.safeParse(withoutSig).success).toBe(false);
  expect(kind10395EventSchema.safeParse(makeSubscription({ id: "x" })).success)
    .toBe(false);
});

Deno.test("kind 10395 template does not need id, pubkey or sig", () => {
  const { id: _id, pubkey: _pubkey, sig: _sig, ...template } =
    makeSubscription();
  expect(kind10395EventTemplateSchema.safeParse(template).success).toBe(true);
});

Deno.test("create10395EventTemplate addresses the notification server", () => {
  const template = create10395EventTemplate("cipher");
  expect(template.kind).toBe(NOTIFICATION_SUBSCRIPTION_KIND);
  expect(template.content).toBe("cipher");
  expect(template.tags).toEqual([["p", NOTIFICATION_SERVER_PUBKEY]]);
  expect(kind10395EventTemplateSchema.safeParse(template).success).toBe(true);
});

Deno.test("kind 10395 decrypted content accepts tokens and filters", () => {
  expect(
    kind10395ContentDecryptedDecodedSchema.safeParse(validData).success,
  ).toBe(true);
  expect(validate10395EventData(validData)).toEqual(validData);
});

Deno.test("kind 10395 decrypted content rejects missing or malformed parts", () => {
  expect(
    kind10395ContentDecryptedDecodedSchema.safeParse({ tokens: [] }).success,
  ).toBe(false);
  expect(
    kind10395ContentDecryptedDecodedSchema.safeParse({
      ...validData,
      tokens: [{ expoPushToken: 1 }],
    }).success,
  ).toBe(false);
  expect(() => validate10395EventData({ tokens: "nope", filters: [] } as never))
    .toThrow();
});
