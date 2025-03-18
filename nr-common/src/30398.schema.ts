import { z } from "../deps.ts";
import {
  contentSchema,
  baseEventSchema,
  tagsIncludingPlusCodeSchema,
} from "./base.schema.ts";

export const kind30398EventSchema = baseEventSchema.extend({
  kind: z.literal(30398),
  // TODO Enable version check
  tags: tagsIncludingPlusCodeSchema,
  // tags: tagsIncludingPlusCodeSchema.refine(hasVersion, {
  //   message: "no valid kind30398_version",
  // }),
  content: contentSchema,
});

export type Kind30398Event = z.infer<typeof kind30398EventSchema>;
