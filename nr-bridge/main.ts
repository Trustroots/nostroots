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

console.log(`#AMogo8 nr-bridge listening on port ${PORT}`);
Deno.serve({ port: PORT }, app.fetch);
