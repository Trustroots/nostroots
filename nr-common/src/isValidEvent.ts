import {
  MAP_NOTE_KIND,
  MAP_NOTE_REPOST_KIND,
  NOSTROOTS_METRICS_KIND,
  NOTIFICATION_SUBSCRIPTION_KIND,
  TRUSTROOTS_PROFILE_KIND,
} from "../constants.ts";
import { kind30400EventSchema } from "./30400.schema.ts";
import { kind10390EventSchema } from "./10390.schema.ts";
import { kind10395EventSchema } from "./10395.schema.ts";
import { kind30397EventSchema } from "./30397.schema.ts";
import { kind30398EventSchema } from "./30398.schema.ts";
import { baseEventSchema, type Event } from "./base.schema.ts";

export function isValidEvent(event: Event): boolean {
  try {
    switch (event.kind) {
      case TRUSTROOTS_PROFILE_KIND:
        kind10390EventSchema.parse(event);
        return true;
      case NOTIFICATION_SUBSCRIPTION_KIND:
        kind10395EventSchema.parse(event);
        return true;
      case NOSTROOTS_METRICS_KIND:
        kind30400EventSchema.parse(event);
        return true;
      case MAP_NOTE_KIND:
        kind30397EventSchema.parse(event);
        return true;
      case MAP_NOTE_REPOST_KIND:
        kind30398EventSchema.parse(event);
        return true;
      default:
        baseEventSchema.parse(event);
        return true;
    }
  } catch (_error) {
    return false;
  }
}
