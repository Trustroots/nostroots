import { MAP_NOTE_REPOST_KIND } from "../constants.ts";
import {
  MAP_NOTE_KIND,
  NOTIFICATION_SUBSCRIPTION_KIND,
  TRUSTROOTS_PROFILE_KIND,
} from "../constants.ts";
import { kind10390EventSchema } from "./10390.schema.ts";
import { kind10395EventSchema } from "./10395.schema.ts";
import { kind30397EventSchema } from "./30397.schema.ts";
import { kind30398EventSchema } from "./30398.schema.ts";
import { baseEventSchema } from "./base.schema.ts";

// TODO - Improve failures here
export const eventSchema = baseEventSchema
  .refine(
    (event) => {
      const { kind } = event;
      if (kind === TRUSTROOTS_PROFILE_KIND) {
        const { success } = kind10390EventSchema.safeParse(event);
        return success;
      }
      return true;
    },
    { message: "#ORzfDS-kind-10390-schema-failed" }
  )
  .refine(
    (event) => {
      const { kind } = event;
      if (kind === NOTIFICATION_SUBSCRIPTION_KIND) {
        const { success } = kind10395EventSchema.safeParse(event);
        return success;
      }
      return true;
    },
    { message: "#4P6NFR-kind-10395-schema-failed" }
  )
  .refine(
    (event) => {
      const { kind } = event;
      if (kind === MAP_NOTE_KIND) {
        const { success } = kind30397EventSchema.safeParse(event);
        return success;
      }
      return true;
    },
    { message: "#zqKj3t-kind-30397-schema-failed" }
  )
  .refine(
    (event) => {
      const { kind } = event;
      if (kind === MAP_NOTE_REPOST_KIND) {
        const { success } = kind30398EventSchema.safeParse(event);
        return success;
      }
      return true;
    },
    { message: "#1WlNEs-kind-30398-schema-failed" }
  )
  .refine(
    (event) => {
      const { success } = baseEventSchema.safeParse(event);
      return success;
    },
    { message: "#wuKVfX-base-event-schema-failed" }
  );
