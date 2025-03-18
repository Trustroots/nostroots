import {
  CONTENT_MAXIMUM_LENGTH,
  CONTENT_MINIMUM_LENGTH,
  OPEN_LOCATION_CODE_TAG_NAME,
} from "../constants.js";
import { z } from "../deps.js";
import { getFirstLabelValueFromTags, isPlusCode } from "./utils.js";

export const baseEventSchema = z
  .object({
    id: z.string().length(64),
    pubkey: z.string().length(64),
    kind: z.number(),
    created_at: z.number(),
    tags: z.string().array().array(),
    content: z.string(),
    sig: z.string(),
  })
  .strict();

export type Event = z.infer<typeof baseEventSchema>;

export const tagsIncludingPlusCodeSchema = z
  .string()
  .array()
  .array()
  .refine(
    (tags) => {
      const plusCode = getFirstLabelValueFromTags(
        tags,
        OPEN_LOCATION_CODE_TAG_NAME
      );
      if (typeof plusCode === "undefined" || !isPlusCode(plusCode)) {
        return false;
      }
      return true;
    },
    { message: "Tags have invalid or missing plus code" }
  );

export const contentSchema = z
  .string()
  .max(
    CONTENT_MAXIMUM_LENGTH,
    `content is above max length of ${CONTENT_MAXIMUM_LENGTH}`
  )
  .min(
    CONTENT_MINIMUM_LENGTH,
    `content is below min length of ${CONTENT_MINIMUM_LENGTH}`
  );
