import { kind10390EventSchema } from "./10390.schema.js";
import { kind10395EventSchema } from "./10395.schema.js";
import { kind30397EventSchema } from "./30397.schema.js";
import { kind30398EventSchema } from "./30398.schema.js";
import { baseEventSchema } from "./base.schema.js";

export const eventSchema = baseEventSchema.refine((event) => {
  const { kind } = event;
  switch (kind) {
    case 10390: {
      const { success } = kind10390EventSchema.safeParse(event);
      return success;
    }
    case 10395: {
      const { success } = kind10395EventSchema.safeParse(event);
      return success;
    }
    case 30397: {
      const { success } = kind30397EventSchema.safeParse(event);
      return success;
    }
    case 30398: {
      const { success } = kind30398EventSchema.safeParse(event);
      return success;
    }
  }

  const { success } = baseEventSchema.safeParse(event);
  return success;
});
