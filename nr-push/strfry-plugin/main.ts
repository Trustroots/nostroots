import * as amqp from "@nashaddams/amqp";
import { TextLineStream } from "@std/streams";
import { parseJsonLine, type StrfryLine } from "./src/parseLines.ts";
import { acceptEvent, rejectEvent } from "./src/strfryResponses.ts";
import { whitelistKinds } from "./src/whitelistKinds.ts";

const EXCHANGE_NAME = "nostrEvents";
// const QUEUE_NAME = "repost";

// TODO Read the URL from env
const amqpUrl = Deno.env.get("AMQP_URL");

if (typeof amqpUrl === "undefined" || amqpUrl.length === 0) {
  console.error("#iQCLLj Missing AMQP_URL");
  Deno.exit(1);
}

const url = URL.parse(amqpUrl);

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

const stdin = await Deno.stdin.readable
  .pipeThrough(new TextDecoderStream())
  .pipeThrough(new TextLineStream());

for await (const jsonLine of stdin) {
  const strfryLine = parseJsonLine(jsonLine);

  if (typeof strfryLine === "undefined") {
    // Must respond or strfry reports "internal error". Try to reject with event id if present.
    try {
      const o = JSON.parse(jsonLine);
      const id = o?.event?.id;
      if (typeof id === "string") {
        rejectEvent(
          { event: { id }, receivedAt: 0, sourceType: "", sourceInfo: "" } as StrfryLine,
          "invalid event",
        );
      }
    } catch {
      // No valid id to reject; strfry may still timeout for this line
    }
    continue;
  }

  if (whitelistKinds(strfryLine)) {
    try {
      channel.publish(
        {
          exchange: EXCHANGE_NAME,
        },
        { contentType: "application/json" },
        new TextEncoder().encode(JSON.stringify(strfryLine)),
      );
    } catch (err) {
      console.error("#AMQP publish failed", err);
      // Still accept the event so the relay keeps working; AMQP is best-effort.
    }
    acceptEvent(strfryLine);
  } else {
    rejectEvent(strfryLine, "403");
  }
}
