import {
  MAP_NOTE_KIND,
  MAP_NOTE_REPOST_KIND,
  NOSTROOTS_METRICS_KIND,
  NOTIFICATION_SUBSCRIPTION_KIND,
  SERVER_MESSAGE_KIND,
  TRUSTROOTS_PROFILE_KIND,
} from "../constants.ts";
import { z } from "../deps.ts";
import { kind30400EventSchema } from "./30400.schema.ts";
import { kind10390EventSchema } from "./10390.schema.ts";
import { kind10395EventSchema } from "./10395.schema.ts";
import { kind20398EventSchema } from "./20398.schema.ts";
import { kind30397EventSchema } from "./30397.schema.ts";
import { kind30398EventSchema } from "./30398.schema.ts";
import { baseEventSchema } from "./base.schema.ts";

// TODO - Add the generic event filter now

export const kindSpecificEventSchema = z.union([
  kind10390EventSchema,
  kind10395EventSchema,
  kind30400EventSchema,
  kind20398EventSchema,
  kind30397EventSchema,
  kind30398EventSchema,
]);

export const kindsWithSpecificSchema: ReadonlySet<number> = new Set([
  TRUSTROOTS_PROFILE_KIND,
  NOTIFICATION_SUBSCRIPTION_KIND,
  NOSTROOTS_METRICS_KIND,
  SERVER_MESSAGE_KIND,
  MAP_NOTE_KIND,
  MAP_NOTE_REPOST_KIND,
]);

export const eventSchema = kindSpecificEventSchema.or(baseEventSchema);
