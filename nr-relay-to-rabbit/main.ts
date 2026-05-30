import * as amqp from "@nashaddams/amqp";
import { AMQP_EXCHANGE_NAME, AMQP_EXCHANGE_TYPE } from "@trustroots/nr-common";
import { parseJsonLine } from "./src/parseLines.ts";
import { acceptEvent, rejectEvent } from "./src/strfryResponses.ts";
import { whitelistKinds } from "./src/whitelistKinds.ts";
import { log } from "./src/log.ts";

const amqpUrl = Deno.env.get("AMQP_URL");

if (typeof amqpUrl === "undefined" || amqpUrl.length === 0) {
  log.error("#iQCLLj Missing AMQP_URL");
  Deno.exit(1);
}

const url = URL.parse(amqpUrl);

if (url === null) {
  log.error("#Nmo5gQ Failed to parse AMQP url");
  Deno.exit(1);
}

const connection = await amqp.connect({
  hostname: url.hostname,
  port: parseInt(url.port),
  username: url.username,
  password: url.password,
});

const channel = await connection.openChannel();

await channel.qos({ prefetchCount: 1 });

await channel.declareExchange({
  exchange: AMQP_EXCHANGE_NAME,
  durable: true,
  type: AMQP_EXCHANGE_TYPE,
});

log.info("#kR7mXp Listening on port 80");

Deno.serve({ port: 80, hostname: "0.0.0.0" }, async (request) => {
  if (request.method === "GET" && new URL(request.url).pathname === "/health") {
    return new Response(
      JSON.stringify({ status: "ok", service: "nr-relay-to-rabbit" }),
      { headers: { "content-type": "application/json" } },
    );
  }

  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const body = await request.text();
  log.debug(`#vT3nQw Received ${body.length} bytes`);

  const strfryLine = parseJsonLine(body);

  if (typeof strfryLine === "undefined") {
    return new Response("Failed to parse event", { status: 400 });
  }

  if (!whitelistKinds(strfryLine)) {
    const response = rejectEvent(strfryLine, "403");
    log.info(
      `#fJ9pLs Rejected event ${strfryLine.event.id} (kind ${strfryLine.event.kind})`,
    );
    return new Response(response, {
      headers: { "content-type": "application/json" },
    });
  }

  try {
    await channel.publish(
      { exchange: AMQP_EXCHANGE_NAME },
      { contentType: "application/json" },
      new TextEncoder().encode(JSON.stringify(strfryLine)),
    );
  } catch (error) {
    const errorMessage = error instanceof Error
      ? error.message
      : JSON.stringify(error);
    log.error(`#bW4hNc AMQP publish failed: ${errorMessage}`);
    const response = rejectEvent(
      strfryLine,
      `error: AMQP publish failed: ${errorMessage}`,
    );
    return new Response(response, {
      headers: { "content-type": "application/json" },
    });
  }

  const response = acceptEvent(strfryLine);
  log.info(`#qY6dRv Accepted event ${strfryLine.event.id}`);
  return new Response(response, {
    headers: { "content-type": "application/json" },
  });
});
