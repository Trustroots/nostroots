import { z } from "../deps.ts";
import { baseEventSchema, idSchema } from "./base.schema.ts";
import { PING_ACK_KIND } from "../constants.ts";
import { isHexKey } from "./utils.ts";

function getTagValues(tags: string[][], tagName: string): string[] {
  return tags.filter(([name]) => name === tagName).map((tag) => tag[1]);
}

function isValidPingTags(tags: string[][]) {
  const pValues = getTagValues(tags, "p");
  return pValues.length >= 1 && pValues.every(isHexKey);
}

function isValidAckTags(tags: string[][]) {
  const eValues = getTagValues(tags, "e");
  const pValues = getTagValues(tags, "p");
  return (
    eValues.length >= 1 &&
    eValues.every((v) => idSchema.safeParse(v).success) &&
    pValues.length >= 1 &&
    pValues.every(isHexKey)
  );
}

export const pingEventSchema = baseEventSchema.extend({
  kind: z.literal(PING_ACK_KIND),
  content: z.literal("ping"),
  tags: z
    .string()
    .array()
    .array()
    .refine(isValidPingTags, {
      message:
        "ping event must have at least one valid p tag targeting a service",
    }),
});

export const ackEventSchema = baseEventSchema.extend({
  kind: z.literal(PING_ACK_KIND),
  content: z.literal("ack"),
  tags: z
    .string()
    .array()
    .array()
    .refine(isValidAckTags, {
      message:
        "ack event must have at least one valid e tag and one valid p tag",
    }),
});

export type PingEvent = z.infer<typeof pingEventSchema>;
export type AckEvent = z.infer<typeof ackEventSchema>;
