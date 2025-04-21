import { z } from "../deps.ts";
import { kind10390EventSchema } from "./10390.schema.ts";
import { kind10395EventSchema } from "./10395.schema.ts";
import { kind30397EventSchema } from "./30397.schema.ts";
import { kind30398EventSchema } from "./30398.schema.ts";
import { baseEventSchema } from "./base.schema.ts";

// TODO - Add the generic event filter now

export const kindSpecificEventSchema = z.discriminatedUnion("kind", [
  kind10390EventSchema,
  kind10395EventSchema,
  kind30397EventSchema,
  kind30398EventSchema,
]);

export const eventSchema = kindSpecificEventSchema.or(baseEventSchema);
