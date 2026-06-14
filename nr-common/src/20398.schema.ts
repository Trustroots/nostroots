import { z } from "../deps.ts";
import { baseEventSchema, idSchema } from "./base.schema.ts";
import {
  SERVER_MESSAGE_KIND,
  SERVER_MESSAGE_TYPE_TAG_NAME,
  SERVER_MESSAGE_TYPES,
} from "../constants.ts";
import { getFirstTagValueFromTags, isHexKey } from "./utils.ts";

function isValidOptionalPubkey(tags: string[][]) {
  const pubkey = getFirstTagValueFromTags(tags, "p");
  const hasNoPTag = typeof pubkey === "undefined";
  const isValidPubkey = typeof pubkey === "string" && isHexKey(pubkey);
  return hasNoPTag || isValidPubkey;
}

function isValidOptionalEventId(tags: string[][]) {
  const eventId = getFirstTagValueFromTags(tags, "e");
  const hasNoETag = typeof eventId === "undefined";
  const isValidId =
    typeof eventId === "string" && idSchema.safeParse(eventId).success;
  return hasNoETag || isValidId;
}

function isValidOptionalMessageType(tags: string[][]) {
  const messageType = getFirstTagValueFromTags(
    tags,
    SERVER_MESSAGE_TYPE_TAG_NAME,
  );
  const hasNoMessageType = typeof messageType === "undefined";
  const isKnownType =
    typeof messageType === "string" &&
    (SERVER_MESSAGE_TYPES as readonly string[]).includes(messageType);
  return hasNoMessageType || isKnownType;
}

export const kind20398EventSchema = baseEventSchema.extend({
  kind: z.literal(SERVER_MESSAGE_KIND),
  content: z.string().min(1),
  tags: z
    .string()
    .array()
    .array()
    .refine(isValidOptionalPubkey, {
      message: "p tag must be a valid 64-char hex pubkey",
    })
    .refine(isValidOptionalEventId, {
      message: "e tag must be a valid 64-char hex event id",
    })
    .refine(isValidOptionalMessageType, {
      message: `serverMessageType tag must be one of: ${SERVER_MESSAGE_TYPES.join(
        ", ",
      )}`,
    }),
});

export type Kind20398Event = z.infer<typeof kind20398EventSchema>;
