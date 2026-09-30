import { expect } from "jsr:@std/expect@1.0.13";
import type { NostrEvent } from "nostr-tools";
import { sendPushNotifications } from "./push.ts";

const event: NostrEvent = {
  id: "event-id",
  pubkey: "author",
  created_at: 1,
  kind: 30397,
  tags: [],
  content: "Anyone hitching to Berlin tomorrow?",
  sig: "sig",
};

type Sent = { url: string; init: RequestInit };

async function withFetch(
  respond: () => Promise<Response>,
  fn: (sent: Sent[]) => Promise<void>,
) {
  const originalFetch = globalThis.fetch;
  const sent: Sent[] = [];
  globalThis.fetch = (input, init) => {
    sent.push({ url: String(input), init: init ?? {} });
    return respond();
  };
  try {
    await fn(sent);
  } finally {
    globalThis.fetch = originalFetch;
  }
}

const okTickets = (count: number) => () =>
  Promise.resolve(
    Response.json({ data: Array(count).fill({ status: "ok", id: "t" }) }),
  );

function messagesOf(sent: Sent[]) {
  return JSON.parse(String(sent[0].init.body));
}

Deno.test("sendPushNotifications sends one Expo message per token", async () => {
  await withFetch(okTickets(2), async (sent) => {
    await sendPushNotifications(["tok-a", "tok-b"], event, "secret", "alice");

    expect(sent).toHaveLength(1);
    expect(sent[0].url).toBe("https://exp.host/--/api/v2/push/send");
    expect(sent[0].init.method).toBe("POST");
    expect(
      (sent[0].init.headers as Record<string, string>).Authorization,
    ).toBe("Bearer secret");

    const messages = messagesOf(sent);
    expect(messages.map((m: { to: string }) => m.to)).toEqual([
      "tok-a",
      "tok-b",
    ]);
    expect(messages[0]).toEqual({
      to: "tok-a",
      title: "alice posted on the map",
      body: event.content,
      priority: "default",
      data: { type: "eventJSON", event: JSON.stringify(event) },
    });
  });
});

Deno.test("sendPushNotifications falls back to Somebody without a username", async () => {
  await withFetch(okTickets(1), async (sent) => {
    await sendPushNotifications(["tok"], event, "secret");
    expect(messagesOf(sent)[0].title).toBe("Somebody posted on the map");
  });
});

Deno.test("sendPushNotifications truncates long bodies by code point", async () => {
  const exact = "🙂".repeat(80);
  const long = "🙂".repeat(81);
  await withFetch(okTickets(1), async (sent) => {
    await sendPushNotifications(["tok"], { ...event, content: exact }, "s");
    await sendPushNotifications(["tok"], { ...event, content: long }, "s");

    expect(JSON.parse(String(sent[0].init.body))[0].body).toBe(exact);
    expect(JSON.parse(String(sent[1].init.body))[0].body).toBe(
      "🙂".repeat(80) + "...",
    );
  });
});

Deno.test("sendPushNotifications swallows Expo and network failures", async () => {
  await withFetch(
    () => Promise.resolve(new Response("nope", { status: 500 })),
    async () => {
      await sendPushNotifications(["tok"], event, "secret");
    },
  );
  await withFetch(
    () =>
      Promise.resolve(
        Response.json({
          data: [{ status: "error", message: "DeviceNotRegistered" }],
        }),
      ),
    async () => {
      await sendPushNotifications(["tok"], event, "secret");
    },
  );
  await withFetch(
    () => Promise.reject(new TypeError("network down")),
    async () => {
      await sendPushNotifications(["tok"], event, "secret");
    },
  );
});
