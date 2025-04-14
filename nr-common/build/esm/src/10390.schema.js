import { TRUSTROOTS_PROFILE_KIND, TRUSTROOTS_USERNAME_LABEL_NAMESPACE, } from "../constants.js";
import { z } from "../deps.js";
import { baseEventTemplateSchema, finalizedEventFields, } from "./base.schema.js";
import { getCurrentTimestamp, isValidTagsArrayWhereAllLabelsHaveAtLeastOneValue, isValidTagsArrayWithTrustrootsUsername, } from "./utils.js";
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
export const kind10390EventSchema = kind10390EventTemplateSchema.merge(finalizedEventFields);
export function createKind10390EventTemplate(trustrootsUsername) {
    const eventTemplate = {
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
