import * as amqp from "@nashaddams/amqp";
import { TextLineStream } from "@std/streams";
import { parseJsonLine } from "./parseLines.ts";
import { acceptEvent } from "./strfryResponses.ts";

const EMPTY_AMQP_URL = "amqp://insecure:insecure@localhost:5672";
const EXCHANGE_NAME = "nostrEvents";
// const QUEUE_NAME = "repost";

const amqpUrlActual = EMPTY_AMQP_URL;

// if (amqpUrlActual === EMPTY_AMQP_URL) {
//   console.error("#iQCLLj Missing AMQP_URL");
//   Deno.exit(1);
// }

const url = URL.parse(amqpUrlActual);

if (url === null) {
  console.error("#Nmo5gQ Failed to parse AMQP url");
  Deno.exit(1);
}

// NOTE: This amqp code is copied from `nr-server/src/consume.ts`
const connection = await amqp.connect({
  hostname: url.hostname,
  port: parseInt(url.port),
  username: url.username,
  password: url.password,
});

const channel = await connection.openChannel();

await channel.qos({ prefetchCount: 1 });

await channel.declareExchange({
  exchange: EXCHANGE_NAME,
  durable: true,
  type: "fanout",
});

channel.publish(
  {
    exchange: EXCHANGE_NAME,
  },
  { contentType: "application/json" },
  new TextEncoder().encode(JSON.stringify({ foo: "bar" })),
);

const stdin = await Deno.stdin.readable
  .pipeThrough(new TextDecoderStream())
  .pipeThrough(new TextLineStream());

for await (const jsonLine of stdin) {
  console.log("#yX8ro8 Got a line", jsonLine);

  const strfryLine = parseJsonLine(jsonLine);

  if (typeof strfryLine === "undefined") {
    continue;
  }

  // Accept this line
  acceptEvent(strfryLine);
}
