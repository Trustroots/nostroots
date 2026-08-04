import {
  CONTENT_MAXIMUM_LENGTH,
  CONTENT_MINIMUM_LENGTH,
} from "../constants.ts";
import { z } from "../deps.ts";
import {
  baseEventSchema,
  contentSchema,
  tagsIncludingPlusCodeSchema,
} from "./base.schema.ts";

export const kind30398EventSchema = baseEventSchema
  .extend({
    kind: z.literal(30398),
    // TODO Enable version check
    tags: tagsIncludingPlusCodeSchema,
    // tags: tagsIncludingPlusCodeSchema.refine(hasVersion, {
    //   message: "no valid kind30398_version",
    // }),
    content: z.string().max(CONTENT_MAXIMUM_LENGTH),
  })
  .refine(
    (event) =>
      event.tags.some(
        (tag) => tag[0] === "start" && typeof tag[1] === "string",
      ) || contentSchema.safeParse(event.content).success,
    {
      message: `content is below min length of ${CONTENT_MINIMUM_LENGTH}`,
      path: ["content"],
    },
  );

export type Kind30398Event = z.infer<typeof kind30398EventSchema>;
