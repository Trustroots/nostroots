import { z } from "zod";
import { OPEN_LOCATION_CODE_LABEL_NAMESPACE } from "./constants.ts";

export const apnsTokenSchema = z.object({
  platform: z.literal("ios"),
  provider: z.literal("apns"),
  token: z.string().min(1),
  topic: z.string().min(1),
  environment: z.union([z.literal("sandbox"), z.literal("production")]),
});

export type APNSToken = z.infer<typeof apnsTokenSchema>;

export const nostrFilterSchema = z.object({
  kinds: z.number().int().array().optional(),
  authors: z.string().array().optional(),
  "#L": z.string().array().optional(),
  "#l": z.string().array().optional(),
}).passthrough();

export type VibeNostrFilter = z.infer<typeof nostrFilterSchema>;

export const vibeSubscriptionPayloadSchema = z.object({
  version: z.literal(1),
  client: z.literal("vibe-browser"),
  tokens: apnsTokenSchema.array(),
  filters: z.object({ filter: nostrFilterSchema }).array(),
});

export type VibeSubscriptionPayload = z.infer<typeof vibeSubscriptionPayloadSchema>;

export function plusCodeFromEvent(event: { tags?: unknown }): string | undefined {
  if (!Array.isArray(event.tags)) return undefined;
  for (const tag of event.tags) {
    if (
      Array.isArray(tag) &&
      tag[0] === "l" &&
      typeof tag[1] === "string" &&
      tag[2] === OPEN_LOCATION_CODE_LABEL_NAMESPACE
    ) {
      return tag[1];
    }
  }
  return undefined;
}
