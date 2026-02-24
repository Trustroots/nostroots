import { z } from "zod";
import { eventSchema } from "@trustroots/nr-common";

export const stryfrLineSchema = z.object({
  type: z.literal("new"),
  event: eventSchema,
  receivedAt: z.number().int(),
  sourceType: z.string(),
  sourceInfo: z.string(),
});
export type StrfryLine = z.infer<typeof stryfrLineSchema>;

export function parseJsonLine(input: string) {
  try {
    const parsedInput = JSON.parse(input);
    const strfryLine = stryfrLineSchema.parse(parsedInput);
    return strfryLine;
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : JSON.stringify(error);
    console.error(`#XfMojS Error parsing line ${errorMessage}: ${input}`);
  }
}
