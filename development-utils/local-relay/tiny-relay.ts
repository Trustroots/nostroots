import type { Event, Filter } from "npm:nostr-tools@2.23.5";
import { matchFilter } from "npm:nostr-tools@2.23.5";

import { defaultEvents } from "./fixtures/default.ts";

type RelayMessage =
  | ["EVENT", Event]
  | ["REQ", string, ...Filter[]]
  | ["CLOSE", string];

type AdminAction =
  | { type: "delay-eose"; milliseconds: number }
  | { type: "reject-publishes"; enabled: boolean };

type Subscription = {
  filters: Filter[];
  id: string;
  socket: WebSocket;
};

const hostname = Deno.env.get("HOST") ?? "127.0.0.1";
const port = Number(Deno.env.get("PORT") ?? 7777);
const events: Event[] = [];
const subscriptions = new Map<string, Subscription>();
let delayEoseMilliseconds = 0;
let rejectPublishes = false;

function reset() {
  events.length = 0;
  subscriptions.clear();
  delayEoseMilliseconds = 0;
  rejectPublishes = false;
}

function seed(seedEvents: Event[] = defaultEvents) {
  events.splice(0, events.length, ...seedEvents);
}

function matchingEvents(filters: Filter[]) {
  return events.filter((event) =>
    filters.some((filter) => matchFilter(filter, event)),
  );
}

function send(socket: WebSocket, message: unknown[]) {
  socket.send(JSON.stringify(message));
}

function publish(event: Event) {
  events.push(event);
  for (const subscription of subscriptions.values()) {
    if (subscription.filters.some((filter) => matchFilter(filter, event))) {
      send(subscription.socket, ["EVENT", subscription.id, event]);
    }
  }
}

function handleRelayMessage(socket: WebSocket, raw: string) {
  const message = JSON.parse(raw) as RelayMessage;
  const [type] = message;

  if (type === "EVENT") {
    const [, event] = message;
    if (rejectPublishes) {
      send(socket, ["OK", event.id, false, "blocked: publish rejected by E2E"]);
      return;
    }
    publish(event);
    send(socket, ["OK", event.id, true, ""]);
    return;
  }

  if (type === "REQ") {
    const [, id, ...filters] = message;
    subscriptions.set(id, { filters, id, socket });
    for (const event of matchingEvents(filters)) {
      send(socket, ["EVENT", id, event]);
    }
    setTimeout(() => {
      if (socket.readyState === WebSocket.OPEN) {
        send(socket, ["EOSE", id]);
      }
    }, delayEoseMilliseconds);
    return;
  }

  if (type === "CLOSE") {
    const [, id] = message;
    subscriptions.delete(id);
  }
}

async function json(request: Request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

async function handleAdmin(request: Request, pathname: string) {
  if (pathname === "/__admin/reset" && request.method === "POST") {
    reset();
    return Response.json({ ok: true });
  }

  if (pathname === "/__admin/seed" && request.method === "POST") {
    const body = (await json(request)) as { scenario?: string } | null;
    if (!body?.scenario || body.scenario === "default") {
      seed();
      return Response.json({ count: events.length, ok: true });
    }
    return Response.json(
      { error: `Unknown scenario: ${body.scenario}` },
      { status: 404 },
    );
  }

  if (pathname === "/__admin/events" && request.method === "GET") {
    return Response.json({ events });
  }

  if (pathname === "/__admin/subscriptions" && request.method === "GET") {
    return Response.json({
      subscriptions: Array.from(subscriptions.values()).map(
        ({ filters, id }) => ({ filters, id }),
      ),
    });
  }

  if (pathname === "/__admin/actions" && request.method === "POST") {
    const action = (await json(request)) as AdminAction | null;
    if (action?.type === "delay-eose") {
      delayEoseMilliseconds = action.milliseconds;
      return Response.json({ ok: true });
    }
    if (action?.type === "reject-publishes") {
      rejectPublishes = action.enabled;
      return Response.json({ ok: true });
    }
    return Response.json({ error: "Unknown action" }, { status: 400 });
  }

  return Response.json({ error: "Not found" }, { status: 404 });
}

seed();

Deno.serve({ hostname, port }, (request) => {
  const url = new URL(request.url);

  if (url.pathname.startsWith("/__admin/")) {
    return handleAdmin(request, url.pathname);
  }

  if (request.headers.get("upgrade") !== "websocket") {
    return Response.json({ ok: true, service: "nostroots-tiny-relay" });
  }

  const { response, socket } = Deno.upgradeWebSocket(request);
  socket.onmessage = (event) => handleRelayMessage(socket, String(event.data));
  socket.onclose = () => {
    for (const [id, subscription] of subscriptions.entries()) {
      if (subscription.socket === socket) {
        subscriptions.delete(id);
      }
    }
  };
  return response;
});
