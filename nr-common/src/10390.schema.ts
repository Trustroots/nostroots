import {
  TRUSTROOTS_PROFILE_KIND,
  TRUSTROOTS_USERNAME_LABEL_NAMESPACE,
} from "../constants.ts";
import { z } from "../deps.ts";
import {
  baseEventTemplateSchema,
  finalizedEventFields,
} from "./base.schema.ts";
import {
  getCurrentTimestamp,
  isValidTagsArrayWhereAllLabelsHaveAtLeastOneValue,
  isValidTagsArrayWithTrustrootsUsername,
} from "./utils.ts";

/**
 * A kind 10390 event is a trustroots profile on nostr.
 *
 * So it's a nostr event, inspired by kind 0, that stores the trustroots
 * username as a tag value.
 */

export const kind10390EventTemplateSchema = baseEventTemplateSchema.extend({
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
export type Kind10390EventTemplate = z.infer<typeof baseEventTemplateSchema>;

export const kind10390EventSchema =
  kind10390EventTemplateSchema.merge(finalizedEventFields);

export type Kind10390Event = z.infer<typeof kind10390EventSchema>;

export function createKind10390EventTemplate(trustrootsUsername: string) {
  const eventTemplate: Kind10390EventTemplate = {
    kind: TRUSTROOTS_PROFILE_KIND,
    tags: [
      ["L", TRUSTROOTS_USERNAME_LABEL_NAMESPACE],
      ["l", trustrootsUsername, TRUSTROOTS_USERNAME_LABEL_NAMESPACE],
    ],
    content: "",
    created_at: getCurrentTimestamp(),
  };
  return eventTemplate;
}
