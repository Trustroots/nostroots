import z from "zod";
import { StrfryLine } from "./parseLines.ts";
import { idSchema } from "@trustroots/nr-common";

const acceptResponseSchema = z.object({
  id: idSchema,
  action: z.literal("accept"),
});

export type AcceptResponse = z.infer<typeof acceptResponseSchema>;

const rejectResponseSchema = z.object({
  id: idSchema,
  action: z.literal("reject"),
  msg: z.string(),
});

export type RejectResponse = z.infer<typeof rejectResponseSchema>;

const responseSchema = z.discriminatedUnion("action", [
  acceptResponseSchema,
  rejectResponseSchema,
]);

export type Response = z.infer<typeof responseSchema>;

export function acceptEvent(strfryLine: StrfryLine): string {
  const { id } = strfryLine.event;
  const response: AcceptResponse = {
    id,
    action: "accept",
  };
  return JSON.stringify(response);
}

export function rejectEvent(strfryLine: StrfryLine, message: string): string {
  const { id } = strfryLine.event;
  const response: RejectResponse = {
    id,
    action: "reject",
    msg: message,
  };
  return JSON.stringify(response);
}
