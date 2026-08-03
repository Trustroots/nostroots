// Mock stack for the Maestro onboarding flows: a fake nr-bridge, a NIP-05
// well-known endpoint, and a minimal relay, all on one port. Test-only.

export const TEST_USERNAME = "e2etester";
export const TEST_PUBKEY_HEX =
  "79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798";
export const TEST_NPUB =
  "npub10xlxvlhemja6c4dqv22uapctqupfhlxm9h8z3k2e72q4k9hcz7vqpkge6d";
export const ACCEPTED_CODE = "123456";

const DEFAULT_PORT = 8787;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function readJsonBody(
  request: Request,
): Promise<Record<string, unknown> | null> {
  try {
    const parsed = await request.json();
    return parsed && typeof parsed === "object"
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function handleRelaySocket(socket: WebSocket) {
  socket.onmessage = (event) => {
    let frame: unknown;
    try {
      frame = JSON.parse(event.data as string);
    } catch {
      return;
    }

    if (!Array.isArray(frame)) return;

    const [type] = frame;

    if (type === "EVENT") {
      const nostrEvent = frame[1] as { id?: string } | undefined;
      socket.send(JSON.stringify(["OK", nostrEvent?.id ?? "", true, ""]));
      return;
    }

    if (type === "REQ") {
      socket.send(JSON.stringify(["EOSE", frame[1]]));
      return;
    }

    if (type === "CLOSE") {
      socket.send(JSON.stringify(["CLOSED", frame[1], ""]));
    }
  };
}

async function handleRequest(request: Request): Promise<Response> {
  if (request.headers.get("upgrade")?.toLowerCase() === "websocket") {
    const { socket, response } = Deno.upgradeWebSocket(request);
    handleRelaySocket(socket);
    return response;
  }

  const url = new URL(request.url);

  if (url.pathname === "/.well-known/nostr.json") {
    const name = url.searchParams.get("name");
    const names =
      name === TEST_USERNAME ? { [TEST_USERNAME]: TEST_PUBKEY_HEX } : {};
    return json({ names });
  }

  if (request.method === "POST" && url.pathname === "/verify_token") {
    const body = await readJsonBody(request);
    if (typeof body?.username !== "string" || !body.username.trim()) {
      return json({ error: "username is required" }, 400);
    }
    return json({ ok: true });
  }

  if (request.method === "POST" && url.pathname === "/authenticate") {
    const body = await readJsonBody(request);
    if (typeof body?.username !== "string" || typeof body?.npub !== "string") {
      return json({ error: "username and npub are required" }, 400);
    }
    if (body.code !== ACCEPTED_CODE) {
      return json({ error: "invalid or expired code" }, 401);
    }
    return json({ ok: true });
  }

  return json({ error: "not found" }, 404);
}

export function startMockStack(port: number = DEFAULT_PORT) {
  const server = Deno.serve({ port, hostname: "127.0.0.1" }, handleRequest);
  return {
    server,
    close: async () => {
      await server.shutdown();
    },
  };
}

if (import.meta.main) {
  const port = Number(Deno.env.get("MOCK_STACK_PORT") ?? DEFAULT_PORT);
  startMockStack(port);
  console.log(`mock stack listening on http://localhost:${port}`);
}
