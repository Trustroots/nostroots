import { z } from "../deps.ts";
import { eventSchema } from "./event.schema.ts";

export const EventNotificationDataSchema = z.object({
  type: z.literal("event"),
  event: eventSchema,
});

export const EventJSONNotificationDataSchema = z.object({
  type: z.literal("eventJSON"),
  event: z.string().refine((input) => {
    try {
      const event = JSON.parse(input);
      eventSchema.parse(event);
      return true;
    } catch {
      return false;
    }
  }, "Event JSON invalid #r48BWE"),
});

export const NotificationDataSchema = z.discriminatedUnion("type", [
  EventNotificationDataSchema,
  EventJSONNotificationDataSchema,
]);
