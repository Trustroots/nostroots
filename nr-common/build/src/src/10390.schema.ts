import { z } from "../deps.js";
import {
  isValidTagsArrayWhereAllLabelsHaveAtLeastOneValue,
  isValidTagsArrayWithTrustrootsUsername,
} from "./utils.js";
import { baseEventSchema } from "./base.schema.js";

export const kind10390EventSchema = baseEventSchema.extend({
  kind: z.literal(10390),
  tags: z
    .array(z.array(z.string()))
    .refine(isValidTagsArrayWhereAllLabelsHaveAtLeastOneValue, {
      message: "All label tags must have a value #2DPf9M",
    })
    .refine(isValidTagsArrayWithTrustrootsUsername, {
      message: "Must have a valid trustroots username #KV4da8",
    }),
});
