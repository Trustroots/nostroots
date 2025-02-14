import { NOTIFICATION_SUBSCRIPTION_KIND } from "../constants.js";
import { z } from "../deps.js";
import { baseEventSchema } from "./base.schema.js";
import { filterSchema } from "./filter.schema.js";
export const kind10395SubscriptionFilterSchema = z.object({
    filter: filterSchema,
});
export const kind10395ContentDecodedSchema = z.object({
    tokens: z.object({}), // TODO Define the shape of this
    filters: kind10395SubscriptionFilterSchema,
});
export const kind10395EventSchema = baseEventSchema.extend({
    kind: z.literal(NOTIFICATION_SUBSCRIPTION_KIND),
    // TODO Enable version check
    // tags: tagsIncludingPlusCodeSchema.refine(hasVersion, {
    //   message: "no valid kind30397_version",
    // }),
    content: z.string().refine((content) => {
        try {
            const result = JSON.parse(content);
            kind10395ContentDecodedSchema.parse(result);
        }
        catch {
            return false;
        }
        return true;
    }),
});
