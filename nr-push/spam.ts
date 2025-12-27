import { finalizeEvent, SimplePool, type EventTemplate } from "nostr-tools";
import { hexToBytes } from "@noble/hashes/utils";

/**
 * - Define your relays and the event you want to spam here.
 */
// const RELAYS = ["wss://relay.trustroots.org"];
const RELAYS = ["ws://127.0.0.1:7777"];

const SECRET_KEY_HEX =
  process.env.NOSTR_SK_HEX ??
  "2692b8082f6d51f8fb5cb051073cd48e361f5ca5fdd80f0c460c6c0199d9ae01";

const DELAY_MS = 100;

const EVENT_TEMPLATE: Omit<EventTemplate, "created_at"> = {
  kind: 666,
  tags: [["t", "nr-spam"]],
  content:
    "საქართველო — ჩედარის ყველის რეკლამა: გემრიელი ჩედარი და ახალი ნედლი რძე ყოველდღე. შეუკვეთე ახლავე Callum's Farm-დან, ბერლინში!",
};

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

async function main() {
  if (!SECRET_KEY_HEX) {
    throw new Error(
      "Missing secret key: set NOSTR_SK_HEX (64 hex chars) or hardcode SECRET_KEY_HEX in nr-push/spam.ts",
    );
  }

  const secretKey = hexToBytes(SECRET_KEY_HEX);
  if (secretKey.length !== 32) {
    throw new Error("SECRET_KEY_HEX must decode to 32 bytes (64 hex chars)");
  }

  const pool = new SimplePool();
  let stopped = false;
  const closePool = () => {
    try {
      pool.close(RELAYS);
    } catch {
      // ignore
    }
  };

  process.once("SIGINT", () => {
    stopped = true;
    closePool();
    process.exitCode = 130;
  });

  process.once("SIGTERM", () => {
    stopped = true;
    closePool();
    process.exitCode = 143;
  });

  let okCount = 0;
  let failCount = 0;
  let i = 0;

  while (!stopped) {
    const created_at = Math.floor(Date.now() / 1000);
    const event = finalizeEvent(
      {
        ...EVENT_TEMPLATE,
        created_at,
        tags: [...(EVENT_TEMPLATE.tags ?? []), ["nonce", `${created_at}-${i}`]],
        content: `${EVENT_TEMPLATE.content} (#${i + 1})`,
      },
      secretKey,
    );

    const results = await Promise.allSettled(pool.publish(RELAYS, event));

    const relayResults = results.map((r, idx) => {
      const relay = RELAYS[idx] ?? "<unknown>";
      if (r.status === "fulfilled")
        return { relay, ok: true as const, reason: r.value };
      return { relay, ok: false as const, reason: r.reason };
    });

    const okThis = relayResults.filter((r) => r.ok).length;
    const failThis = relayResults.length - okThis;
    okCount += okThis;
    failCount += failThis;

    const summary = relayResults
      .map((r) =>
        r.ok ? `OK ${r.relay}` : `FAIL ${r.relay}: ${String(r.reason)}`,
      )
      .join(" | ");
    console.log(`[${i + 1}] ${event.id} :: ${summary}`);

    i++;
    if (DELAY_MS > 0) await sleep(DELAY_MS);
  }

  closePool();
  console.log(`done: ok=${okCount} fail=${failCount}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? (err.stack ?? err.message) : err);
  process.exitCode = 1;
});
