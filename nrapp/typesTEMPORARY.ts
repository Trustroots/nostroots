import { z } from "zod";

export const eventSchema = z
  .object({
    id: z.string().length(32),
    pubkey: z.string().length(32),
    kind: z.number(),
    created_at: z.number(),
    tags: z.string().array().array(),
    content: z.string(),
    sig: z.string(),
  })
  .strict();

export type Event = z.infer<typeof eventSchema>;

export const profileEventSchema = eventSchema.extend({
  kind: z.literal(0),
});

export type ProfileEvent = z.infer<typeof profileEventSchema>;
