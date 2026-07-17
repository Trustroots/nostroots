/**
 * @module main
 *
 * Entry point for the nr-bridge server. Reads the `PORT` environment variable
 * (default `8000`) and starts a Deno HTTP server using the Hono application
 * returned by {@link createApp}.
 */
import { createApp } from "./src/server.ts";
import { PORT } from "./src/config.ts";

const app = createApp();
const HOST = Deno.env.get("HOST") ?? "127.0.0.1";

console.log(`#AMogo8 nr-bridge listening on ${HOST}:${PORT}`);
Deno.serve({ hostname: HOST, port: PORT }, app.fetch);
