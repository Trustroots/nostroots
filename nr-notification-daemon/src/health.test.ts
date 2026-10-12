import { assertEquals } from "@std/assert";
import { handleHealthRequest, startHealthServer } from "./health.ts";

Deno.test("health returns 503 until the daemon is ready", async () => {
  const response = handleHealthRequest(
    new Request("http://localhost/health"),
    () => false,
  );
  assertEquals(response.status, 503);
  await response.body?.cancel();
});

Deno.test("health returns 200 once the daemon is ready", async () => {
  const response = handleHealthRequest(
    new Request("http://localhost/health"),
    () => true,
  );
  assertEquals(response.status, 200);
  assertEquals(await response.text(), "ok");
});

Deno.test("health returns 404 for other paths", async () => {
  const response = handleHealthRequest(
    new Request("http://localhost/other"),
    () => true,
  );
  assertEquals(response.status, 404);
  await response.body?.cancel();
});

Deno.test("startHealthServer serves /health over HTTP", async () => {
  const server = startHealthServer(
    { port: 0, hostname: "127.0.0.1" },
    () => true,
  );
  try {
    const response = await fetch(
      `http://127.0.0.1:${server.addr.port}/health`,
    );
    assertEquals(response.status, 200);
    await response.body?.cancel();
  } finally {
    await server.shutdown();
  }
});
