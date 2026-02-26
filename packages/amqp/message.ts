import { z } from "zod";
import { eventSchema } from "@trustroots/nr-common";

export const rabbitMessageSchema = z.object({
  type: z.literal("new"),
  event: eventSchema,
  receivedAt: z.number().int(),
  sourceType: z.string(),
  sourceInfo: z.string(),
});

export type RabbitMessage = z.infer<typeof rabbitMessageSchema>;
