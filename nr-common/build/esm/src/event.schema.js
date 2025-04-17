import { z } from "../deps.js";
import { kind10390EventSchema } from "./10390.schema.js";
import { kind10395EventSchema } from "./10395.schema.js";
import { kind30397EventSchema } from "./30397.schema.js";
import { kind30398EventSchema } from "./30398.schema.js";
import { baseEventSchema } from "./base.schema.js";
// TODO - Add the generic event filter now
export const kindSpecificEventSchema = z.discriminatedUnion("kind", [
    kind10390EventSchema,
    kind10395EventSchema,
    kind30397EventSchema,
    kind30398EventSchema,
]);
export const eventSchema = kindSpecificEventSchema.or(baseEventSchema);
