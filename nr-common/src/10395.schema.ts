import { NOTIFICATION_SUBSCRIPTION_KIND } from "../constants.ts";
import { z } from "../deps.ts";
import { baseEventSchema } from "./base.schema.ts";
import { filterSchema } from "./filter.schema.ts";

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
  content: z.string().refine((content) => {
    try {
      const result = JSON.parse(content);
      kind10395ContentDecodedSchema.parse(result);
    } catch {
      return false;
    }
    return true;
  }),
});
