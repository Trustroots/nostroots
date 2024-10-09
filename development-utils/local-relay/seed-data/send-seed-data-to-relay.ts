import { NRelay1 } from "jsr:@nostrify/nostrify@^0.30.0";

import { events } from "./seed-data.ts";

const relay = new NRelay1("ws://localhost:7000");

for (const event of events) {
  await relay.event(event);
}

Deno.exit();
