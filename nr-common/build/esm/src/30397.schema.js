import { z } from "../deps.js";
import { contentSchema, baseEventSchema, tagsIncludingPlusCodeSchema, } from "./base.schema.js";
export const kind30397EventSchema = baseEventSchema.extend({
    kind: z.literal(30397),
    // TODO Enable version check
    tags: tagsIncludingPlusCodeSchema,
    // tags: tagsIncludingPlusCodeSchema.refine(hasVersion, {
    //   message: "no valid kind30397_version",
    // }),
    content: contentSchema,
});
