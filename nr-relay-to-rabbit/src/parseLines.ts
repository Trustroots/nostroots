import { rabbitMessageSchema, type RabbitMessage } from "@trustroots/amqp";

export type StrfryLine = RabbitMessage;

export function parseJsonLine(input: string) {
  try {
    const parsedInput = JSON.parse(input);
    const strfryLine = rabbitMessageSchema.parse(parsedInput);
    return strfryLine;
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : JSON.stringify(error);
    console.error(`#XfMojS Error parsing line ${errorMessage}: ${input}`);
  }
}
